import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { safeApiError } from "@/lib/server-utils";
import { verifyCSRFToken } from "@/lib/csrf";
import { registrarLog, AuditAction } from "@/lib/audit";
import { sanitizeString } from "@/lib/sanitize";

// Schema para responder
const respostaSchema = z.object({
  conteudo: z.string().min(2, "A resposta não pode estar vazia."),
});

// Schema para ações de PATCH (Toggle Solução)
const patchSchema = z.object({
  respostaId: z.number().int().positive(),
  acao: z.literal("TOGGLE_SOLUCAO"),
});

// --- GET: Ler Tópico (Visão Professor) ---
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string; topicoId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { turmaId, topicoId } = await params;
    const turmaIdInt = Number(turmaId);
    const topicoIdInt = Number(topicoId);

    if (isNaN(turmaIdInt) || isNaN(topicoIdInt)) {
      return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
    }

    // 1. Validação de Propriedade
    const isOwner = await prisma.turmaProfessor.findUnique({
      where: {
        turmaId_professorId: {
          turmaId: turmaIdInt,
          professorId: Number(session.sub),
        },
      },
    });

    if (!isOwner && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Você não administra esta turma." }, { status: 403 });
    }

    // 2. Busca Tópico
    const topico = await prisma.topicoForum.findUnique({
      where: {
        id: topicoIdInt,
        turmaId: turmaIdInt
      },
      include: {
        autor: {
          select: { nome: true, fotoUrl: true, email: true, tipo: true }
        },
        respostas: {
          orderBy: { createdAt: "asc" },
          include: {
            autor: {
              select: { nome: true, fotoUrl: true, tipo: true } 
            }
          }
        },
        // Contextos
        agendamento: { select: { titulo: true } },
        tarefa: { select: { titulo: true } },
        material: { select: { titulo: true } }
      }
    });

    if (!topico) {
      return NextResponse.json({ error: "Tópico não encontrado." }, { status: 404 });
    }

    // 3. Formatação para resposta JSON
    const resultado = {
      id: topico.id,
      titulo: topico.titulo,
      conteudo: topico.conteudo,
      resolvido: topico.resolvido,
      createdAt: topico.createdAt,
      solucaoRespostaId: topico.solucaoRespostaId,
      
      autor: {
        nome: topico.autor.nome,
        avatar: topico.autor.fotoUrl,
        email: topico.autor.email,
        tipo: topico.autor.tipo
      },
      
      contexto: topico.agendamento ? { tipo: "PROVA", nome: topico.agendamento.titulo } :
                topico.tarefa ? { tipo: "TAREFA", nome: topico.tarefa.titulo } :
                topico.material ? { tipo: "MATERIAL", nome: topico.material.titulo } : null,
      
      respostas: topico.respostas.map((r) => ({
        id: r.id,
        conteudo: r.conteudo,
        createdAt: r.createdAt,
        isSolucao: r.id === topico.solucaoRespostaId,
        autor: {
          nome: r.autor.nome,
          avatar: r.autor.fotoUrl,
          tipo: r.autor.tipo
        }
      }))
    };

    return NextResponse.json(resultado);

  } catch (error) {
    return safeApiError(error, "Erro ao carregar tópico.");
  }
}

// --- POST: Responder ao Tópico COM SANITIZAÇÃO ---
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string; topicoId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const csrfToken = req.headers.get("x-csrf-token");
    if (!(await verifyCSRFToken(csrfToken))) {
      return NextResponse.json({ error: "Sessão inválida" }, { status: 403 });
    }

    const { turmaId, topicoId } = await params;
    const turmaIdInt = Number(turmaId);
    const topicoIdInt = Number(topicoId);
    
    const body = await req.json();
    const validation = respostaSchema.safeParse(body);
    if (!validation.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

    const isOwner = await prisma.turmaProfessor.findUnique({
      where: {
        turmaId_professorId: {
          turmaId: turmaIdInt,
          professorId: Number(session.sub),
        },
      },
    });
    if (!isOwner && session.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

    // ✅ SANITIZAÇÃO AQUI
    const conteudoSafe = sanitizeString(validation.data.conteudo);

    const resposta = await prisma.respostaForum.create({
      data: {
        topicoId: topicoIdInt,
        autorId: Number(session.sub),
        conteudo: conteudoSafe, // ✅ Usando versão limpa
      }
    });

    await registrarLog({
      acao: AuditAction.FORUM_RESPONDER,
      usuarioId: Number(session.sub),
      usuarioNome: session.name,
      recurso: `Resposta Prof: ${resposta.id}`,
      detalhes: { topicoId: topicoIdInt }
    });

    return NextResponse.json({ success: true, respostaId: resposta.id }, { status: 201 });

  } catch (error) {
    return safeApiError(error, "Erro ao enviar resposta.");
  }
}

// --- PATCH: Toggle Solução (Sem texto, não precisa de sanitização de string) ---
// (O PATCH permanece igual, pois ele só lida com IDs, que o Zod já valida como number)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string; topicoId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const csrfToken = req.headers.get("x-csrf-token");
    if (!(await verifyCSRFToken(csrfToken))) return NextResponse.json({ error: "Sessão inválida" }, { status: 403 });

    const { turmaId, topicoId } = await params;
    const turmaIdInt = Number(turmaId);
    const topicoIdInt = Number(topicoId);

    const body = await req.json();
    const validation = patchSchema.safeParse(body);
    if (!validation.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

    const { respostaId, acao } = validation.data;

    // 1. Validação de Dono
    const isOwner = await prisma.turmaProfessor.findUnique({
      where: { turmaId_professorId: { turmaId: turmaIdInt, professorId: Number(session.sub) } },
    });
    if (!isOwner && session.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Acesso negado." }, { status: 403 });

    // 2. Busca o tópico e a resposta para validar contexto
    const topico = await prisma.topicoForum.findUnique({
      where: { id: topicoIdInt },
      select: { solucaoRespostaId: true }
    });

    const respostaAlvo = await prisma.respostaForum.findUnique({
      where: { id: respostaId },
      select: { topicoId: true }
    });

    if (!topico || !respostaAlvo || respostaAlvo.topicoId !== topicoIdInt) {
      return NextResponse.json({ error: "Contexto inválido." }, { status: 400 });
    }

    if (acao === "TOGGLE_SOLUCAO") {
      const isCurrentlySolution = topico.solucaoRespostaId === respostaId;

      await prisma.$transaction(async (tx) => {
        if (isCurrentlySolution) {
          await tx.respostaForum.update({ where: { id: respostaId }, data: { ehSolucao: false } });
          await tx.topicoForum.update({ 
            where: { id: topicoIdInt }, 
            data: { solucaoRespostaId: null, resolvido: false } 
          });
        } else {
          if (topico.solucaoRespostaId) {
            await tx.respostaForum.update({ 
              where: { id: topico.solucaoRespostaId }, 
              data: { ehSolucao: false } 
            });
          }
          await tx.respostaForum.update({ where: { id: respostaId }, data: { ehSolucao: true } });
          await tx.topicoForum.update({ 
            where: { id: topicoIdInt }, 
            data: { solucaoRespostaId: respostaId, resolvido: true } 
          });
        }
      });
    }

    await registrarLog({
      acao: AuditAction.FORUM_RESPONDER,
      usuarioId: Number(session.sub),
      usuarioNome: session.name,
      recurso: `Tópico: ${topicoIdInt}`,
      detalhes: { solucaoId: respostaId, acao }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    return safeApiError(error, "Erro ao atualizar tópico.");
  }
}