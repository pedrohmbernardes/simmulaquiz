import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { safeApiError } from "@/lib/server-utils";
import { verifyCSRFToken } from "@/lib/csrf";
import { registrarLog, AuditAction } from "@/lib/audit";
import { apiRateLimit, expensiveOpsRateLimit } from "@/lib/ratelimit"; // ✅ NOVO: Importando os limitadores

// Schema para criar tópico
const criarTopicoSchema = z.object({
  titulo: z.string().min(5, "O título deve ser explicativo.").max(100),
  conteudo: z.string().min(10, "Detalhe melhor sua dúvida."),
  
  // Contexto opcional
  agendamentoId: z.number().optional(),
  materialId: z.number().optional(),
  tarefaId: z.number().optional(),
});

// --- GET: Listar Tópicos da Turma ---
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ALUNO") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // ✅ Rate Limit de Leitura (Evita scraping do fórum)
    const rlKey = `forum_lista:${session.sub}`;
    const rl = await apiRateLimit.limit(rlKey);
    if (!rl.success) {
      return NextResponse.json({ error: "Muitas requisições. Aguarde um instante." }, { status: 429 });
    }

    const { turmaId } = await params;
    const turmaIdInt = Number(turmaId);
    const alunoId = Number(session.sub);

    if (isNaN(turmaIdInt)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    // 1. Validação de Acesso
    const matricula = await prisma.turmaAluno.findUnique({
      where: { turmaId_alunoId: { turmaId: turmaIdInt, alunoId: alunoId } },
    });

    if (!matricula || matricula.status !== "ATIVO") {
      return NextResponse.json({ error: "Sem acesso à turma." }, { status: 403 });
    }

    // 2. Busca Tópicos (Feed)
    const topicos = await prisma.topicoForum.findMany({
      where: { turmaId: turmaIdInt },
      orderBy: [
        { resolvido: "asc" },
        { createdAt: "desc" }
      ],
      include: {
        autor: {
          select: { nome: true, fotoUrl: true } 
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
    const resultado = topicos.map((t) => ({
      id: t.id,
      titulo: t.titulo,
      conteudoResumo: t.conteudo.substring(0, 150) + (t.conteudo.length > 150 ? "..." : ""),
      autor: {
        nome: t.autor.nome,
        avatar: t.autor.fotoUrl,
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

// --- POST: Criar Novo Tópico ---
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string }> }
) {
  try {
    // 1. Autenticação
    const session = await getSession();
    if (!session || session.role !== "ALUNO") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // ✅ Rate Limit de Escrita (Impede flood de criação de tópicos - spam)
    const rlKey = `forum_criar_topico:${session.sub}`;
    const rl = await expensiveOpsRateLimit.limit(rlKey);
    if (!rl.success) {
      return NextResponse.json({ error: "Você está criando tópicos rápido demais. Aguarde alguns minutos." }, { status: 429 });
    }

    // 2. CSRF
    const csrfToken = req.headers.get("x-csrf-token");
    if (!(await verifyCSRFToken(csrfToken))) {
      return NextResponse.json({ error: "Sessão inválida" }, { status: 403 });
    }

    const { turmaId } = await params;
    const turmaIdInt = Number(turmaId);
    const alunoId = Number(session.sub);

    // 3. Validação Body
    const body = await req.json();
    const validation = criarTopicoSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({ error: "Dados inválidos", details: validation.error.flatten() }, { status: 400 });
    }

    const { titulo, conteudo, agendamentoId, tarefaId, materialId } = validation.data;

    // 4. Validação de Acesso à Turma
    const matricula = await prisma.turmaAluno.findUnique({
      where: { turmaId_alunoId: { turmaId: turmaIdInt, alunoId: alunoId } },
    });

    if (!matricula || matricula.status !== "ATIVO") {
      return NextResponse.json({ error: "Você não pode postar nesta turma." }, { status: 403 });
    }

    // 5. 🛡️ BLINDAGEM DE CONTEXTO (Segurança Adicional)
    // Garante que o recurso vinculado pertence, de fato, a esta turma.
    if (agendamentoId) {
      const existe = await prisma.agendamentoSimulado.count({ 
        where: { id: agendamentoId, turmaId: turmaIdInt } 
      });
      if (!existe) return NextResponse.json({ error: "Agendamento inválido para esta turma." }, { status: 400 });
    }

    if (tarefaId) {
      const existe = await prisma.tarefa.count({ 
        where: { id: tarefaId, turmaId: turmaIdInt } 
      });
      if (!existe) return NextResponse.json({ error: "Tarefa inválida para esta turma." }, { status: 400 });
    }

    if (materialId) {
      const existe = await prisma.materialTurma.count({ 
        where: { id: materialId, turmaId: turmaIdInt } 
      });
      if (!existe) return NextResponse.json({ error: "Material inválido para esta turma." }, { status: 400 });
    }

    // 6. Criação do Tópico
    const topico = await prisma.topicoForum.create({
      data: {
        turmaId: turmaIdInt,
        autorId: alunoId,
        titulo,
        conteudo,
        agendamentoId: agendamentoId || null,
        tarefaId: tarefaId || null,
        materialId: materialId || null,
      }
    });

    // 7. Auditoria
    await registrarLog({
      acao: AuditAction.FORUM_TOPICO_CRIAR,
      usuarioId: alunoId,
      usuarioNome: session.name,
      recurso: `Tópico: ${topico.id}`,
      detalhes: { turmaId: turmaIdInt, titulo }
    });

    return NextResponse.json({ success: true, topicoId: topico.id }, { status: 201 });

  } catch (error) {
    return safeApiError(error, "Erro ao criar tópico.");
  }
}