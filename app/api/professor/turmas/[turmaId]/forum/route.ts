import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { safeApiError } from "@/lib/server-utils";
import { verifyCSRFToken } from "@/lib/csrf";
import { registrarLog, AuditAction } from "@/lib/audit";
import { sanitizeString } from "@/lib/sanitize";

// Schema para criar tópico (mesma regra de negócio)
const criarTopicoSchema = z.object({
  titulo: z.string().min(5, "O título deve ser explicativo.").max(100),
  conteudo: z.string().min(10, "Detalhe melhor a discussão."),
  
  // Contexto opcional
  agendamentoId: z.number().optional(),
  materialId: z.number().optional(),
  tarefaId: z.number().optional(),
});

// --- GET: Listar Tópicos (Visão Professor) ---
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { turmaId } = await params;
    const turmaIdInt = Number(turmaId);

    if (isNaN(turmaIdInt)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    // 1. Validação de Propriedade da Turma (Anti-IDOR)
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

    // 2. Busca Tópicos (Feed)
    // O professor vê exatamente o mesmo feed, talvez com ordenação diferente no futuro
    const topicos = await prisma.topicoForum.findMany({
      where: { turmaId: turmaIdInt },
      orderBy: [
        { resolvido: "asc" },    // Não resolvidos primeiro (prioridade para suporte)
        { createdAt: "desc" }    // Mais recentes
      ],
      include: {
        autor: {
          select: { nome: true, fotoUrl: true, email: true } // Professor vê e-mail
        },
        _count: {
          select: { respostas: true }
        },
        // Contextos
        agendamento: { select: { titulo: true } },
        tarefa: { select: { titulo: true } },
        material: { select: { titulo: true } }
      },
      take: 50
    });

    // 3. Formatação
    const resultado = topicos.map(t => ({
      id: t.id,
      titulo: t.titulo,
      conteudoResumo: t.conteudo.substring(0, 150) + (t.conteudo.length > 150 ? "..." : ""),
      autor: {
        nome: t.autor.nome,
        avatar: t.autor.fotoUrl,
        email: t.autor.email,
        // Removemos isProfessor pois dependia de role, e o professor sabe quem é aluno
      },
      dataCriacao: t.createdAt,
      resolvido: t.resolvido,
      respostasCount: t._count.respostas,
      
      contexto: t.agendamento ? { tipo: "PROVA", nome: t.agendamento.titulo } :
                t.tarefa ? { tipo: "TAREFA", nome: t.tarefa.titulo } :
                t.material ? { tipo: "MATERIAL", nome: t.material.titulo } : null
    }));

    return NextResponse.json(resultado);

  } catch (error) {
    return safeApiError(error, "Erro ao carregar fórum.");
  }
}

// --- POST: Criar Tópico COM SANITIZAÇÃO ---
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string }> }
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

    const { turmaId } = await params;
    const turmaIdInt = Number(turmaId);

    const body = await req.json();
    const validation = criarTopicoSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({ error: "Dados inválidos", details: validation.error.flatten() }, { status: 400 });
    }

    const { titulo, conteudo, agendamentoId, tarefaId, materialId } = validation.data;

    // ✅ SANITIZAÇÃO AQUI
    // Remove scripts, iframes e atributos perigosos antes de salvar
    const tituloSafe = sanitizeString(titulo);
    const conteudoSafe = sanitizeString(conteudo);

    const isOwner = await prisma.turmaProfessor.findUnique({
      where: {
        turmaId_professorId: {
          turmaId: turmaIdInt,
          professorId: Number(session.sub),
        },
      },
    });

    if (!isOwner && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Você não pode postar nesta turma." }, { status: 403 });
    }

    const topico = await prisma.topicoForum.create({
      data: {
        turmaId: turmaIdInt,
        autorId: Number(session.sub),
        titulo: tituloSafe,      // ✅ Usando versão limpa
        conteudo: conteudoSafe,  // ✅ Usando versão limpa
        agendamentoId: agendamentoId || null,
        tarefaId: tarefaId || null,
        materialId: materialId || null,
      }
    });

    await registrarLog({
      acao: AuditAction.FORUM_TOPICO_CRIAR,
      usuarioId: Number(session.sub),
      usuarioNome: session.name,
      recurso: `Tópico Prof: ${topico.id}`,
      detalhes: { turmaId: turmaIdInt, titulo: tituloSafe }
    });

    return NextResponse.json({ success: true, topicoId: topico.id }, { status: 201 });

  } catch (error) {
    return safeApiError(error, "Erro ao criar tópico.");
  }
}