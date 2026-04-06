import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { safeApiError } from "@/lib/server-utils";
import { verifyCSRFToken } from "@/lib/csrf";
import { registrarLog, AuditAction } from "@/lib/audit";

// Schema para nova resposta
const respostaSchema = z.object({
  conteudo: z.string().min(2, "A resposta não pode estar vazia."),
});

// --- GET: Ler Tópico + Respostas ---
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string; topicoId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ALUNO") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { turmaId, topicoId } = await params;
    const turmaIdInt = Number(turmaId);
    const topicoIdInt = Number(topicoId);
    const alunoId = Number(session.sub);

    if (isNaN(turmaIdInt) || isNaN(topicoIdInt)) {
      return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
    }

    // 1. Validação de Acesso à Turma
    const matricula = await prisma.turmaAluno.findUnique({
      where: { turmaId_alunoId: { turmaId: turmaIdInt, alunoId: alunoId } },
    });

    if (!matricula || matricula.status !== "ATIVO") {
      return NextResponse.json({ error: "Sem acesso à turma." }, { status: 403 });
    }

    // 2. Busca Tópico com Respostas
    const topico = await prisma.topicoForum.findUnique({
      where: {
        id: topicoIdInt,
        turmaId: turmaIdInt // Garante que tópico é desta turma (Anti-IDOR)
      },
      include: {
        autor: {
          select: { nome: true, fotoUrl: true }
        },
        // Busca a resposta marcada como solução (se houver)
        solucaoResposta: {
            include: { 
                autor: { select: { nome: true, fotoUrl: true } }
            }
        },
        // Busca todas as respostas
        respostas: {
          orderBy: { createdAt: "asc" },
          include: {
            autor: {
              select: { nome: true, fotoUrl: true }
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

    // 3. Formatação
    const resultado = {
      id: topico.id,
      titulo: topico.titulo,
      conteudo: topico.conteudo,
      resolvido: topico.resolvido,
      createdAt: topico.createdAt,
      autor: {
        nome: topico.autor.nome,
        avatar: topico.autor.fotoUrl,
      },
      // Contexto (Onde a dúvida surgiu)
      contexto: topico.agendamento ? { tipo: "PROVA", nome: topico.agendamento.titulo } :
                topico.tarefa ? { tipo: "TAREFA", nome: topico.tarefa.titulo } :
                topico.material ? { tipo: "MATERIAL", nome: topico.material.titulo } : null,
      
      // ID da solução para o front destacar
      solucaoId: topico.solucaoRespostaId,

      // Lista de Respostas
      respostas: topico.respostas.map(r => ({
        id: r.id,
        conteudo: r.conteudo,
        createdAt: r.createdAt,
        isSolucao: r.id === topico.solucaoRespostaId, // Flag facilitadora
        autor: {
          nome: r.autor.nome,
          avatar: r.autor.fotoUrl,
          isMe: r.autorId === alunoId // Para permitir editar/excluir (futuro)
        }
      }))
    };

    return NextResponse.json(resultado);

  } catch (error) {
    return safeApiError(error, "Erro ao carregar tópico.");
  }
}

// --- POST: Responder ao Tópico ---
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string; topicoId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ALUNO") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const csrfToken = req.headers.get("x-csrf-token");
    if (!(await verifyCSRFToken(csrfToken))) {
      return NextResponse.json({ error: "Sessão inválida" }, { status: 403 });
    }

    const { turmaId, topicoId } = await params;
    const turmaIdInt = Number(turmaId);
    const topicoIdInt = Number(topicoId);
    const alunoId = Number(session.sub);

    const body = await req.json();
    const validation = respostaSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    // Validação de Existência e Acesso (Anti-IDOR)
    // Precisamos garantir que o tópico existe E pertence à turma onde o aluno tem acesso
    const topico = await prisma.topicoForum.findUnique({
      where: { 
        id: topicoIdInt,
        turmaId: turmaIdInt 
      },
      include: {
        turma: {
            include: {
                alunos: { where: { alunoId } }
            }
        }
      }
    });

    if (!topico) {
      return NextResponse.json({ error: "Tópico não encontrado." }, { status: 404 });
    }

    const matricula = topico.turma.alunos[0];
    if (!matricula || matricula.status !== "ATIVO") {
      return NextResponse.json({ error: "Sem permissão para responder." }, { status: 403 });
    }

    // Criação da Resposta
    const resposta = await prisma.respostaForum.create({
      data: {
        topicoId: topicoIdInt,
        autorId: alunoId,
        conteudo: validation.data.conteudo,
      }
    });

    // Auditoria
    await registrarLog({
      acao: AuditAction.FORUM_RESPONDER, // Criar action se não existir
      usuarioId: alunoId,
      usuarioNome: session.name,
      recurso: `Resposta: ${resposta.id}`,
      detalhes: { topicoId: topicoIdInt }
    });

    return NextResponse.json({ success: true, respostaId: resposta.id }, { status: 201 });

  } catch (error) {
    return safeApiError(error, "Erro ao enviar resposta.");
  }
}