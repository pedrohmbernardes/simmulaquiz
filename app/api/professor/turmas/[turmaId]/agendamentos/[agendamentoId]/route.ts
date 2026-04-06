import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { registrarLog, AuditAction } from "@/lib/audit";
import { safeApiError, getClientIp } from "@/lib/server-utils";
import { adminContentRateLimit } from "@/lib/ratelimit";
import { sanitizeObject } from "@/lib/sanitize";
import { verifyCSRFToken } from "@/lib/csrf";

// Schema para atualização (PATCH)
const updateAgendamentoSchema = z.object({
  titulo: z.string().min(3).max(100).optional(),
  descricao: z.string().optional(),
  // z.coerce.date() é vital para converter string ISO em Date
  dataInicio: z.coerce.date().optional(),
  dataFim: z.coerce.date().optional(),
  duracaoMinutos: z.number().min(10).optional(),
  status: z.enum(["RASCUNHO", "PUBLICADO", "ENCERRADO", "CANCELADO"]).optional(),
  questaoIds: z.array(z.number()).optional(),
});

// --- GET: Carregar dados ---
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string; agendamentoId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { turmaId, agendamentoId } = await params;
    const turmaIdInt = Number(turmaId);
    const agendamentoIdInt = Number(agendamentoId);

    if (isNaN(turmaIdInt) || isNaN(agendamentoIdInt)) {
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

    // 2. Busca o Agendamento
    const agendamento = await prisma.agendamentoSimulado.findUnique({
      where: {
        id: agendamentoIdInt,
        turmaId: turmaIdInt,
      },
      include: {
        questoes: {
          orderBy: { ordem: 'asc' },
          include: {
            questao: {
              select: {
                id: true,
                enunciado: true,
                dificuldade: true,
                nivelCognitivo: true,
                codigo: true,
                unidadeCurricular: { select: { nome: true } },
                cursoTecnico: { select: { nome: true } }
              }
            }
          }
        },
        _count: {
          select: { entregas: true }
        }
      }
    });

    if (!agendamento) {
      return NextResponse.json({ error: "Agendamento não encontrado." }, { status: 404 });
    }

    return NextResponse.json(agendamento);

  } catch (error) {
    return safeApiError(error, "Erro ao carregar agendamento.");
  }
}

// --- PATCH: Salvar Alterações ---
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string; agendamentoId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // Validação CSRF
    const csrfToken = req.headers.get("x-csrf-token");
    if (!(await verifyCSRFToken(csrfToken))) {
      return NextResponse.json({ error: "Sessão inválida (CSRF)" }, { status: 403 });
    }

    const { turmaId, agendamentoId } = await params;
    const turmaIdInt = Number(turmaId);
    const agendamentoIdInt = Number(agendamentoId);
    const professorId = Number(session.sub);

    // Rate Limit
    const ip = await getClientIp(req);
    const { success } = await adminContentRateLimit.limit(`update_agendamento:${professorId}:${ip}`);
    if (!success) return NextResponse.json({ error: "Muitas requisições." }, { status: 429 });

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
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    // 2. Validação e Sanitização
    const body = await req.json();
    const validation = updateAgendamentoSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Dados inválidos", details: validation.error.flatten() }, { status: 400 });
    }

    // Com o sanitize.ts corrigido, 'dataInicio' (Date) passará intacto aqui
    const data = sanitizeObject(validation.data);

    // 3. Trava de Segurança (Se já iniciado)
    const agendamentoAtual = await prisma.agendamentoSimulado.findUnique({
      where: { id: agendamentoIdInt },
      select: { 
        status: true,
        entregas: {
          where: { status: { not: "PENDENTE" } },
          take: 1
        }
      }
    });

    if (!agendamentoAtual) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    const jaIniciado = agendamentoAtual.entregas.length > 0;

    if (jaIniciado) {
      // Se já iniciou, impede alteração de dados estruturais
      if (data.titulo || data.dataInicio || data.dataFim || data.duracaoMinutos || (data.questaoIds && data.questaoIds.length > 0)) {
        return NextResponse.json({ 
          error: "A prova já foi iniciada por alunos. Você só pode alterar o Status (ex: Encerrar)." 
        }, { status: 409 });
      }
    }

    // 4. Transação de Atualização
    const resultado = await prisma.$transaction(async (tx) => {
      
      // Atualiza metadados
      const agendamentoAtualizado = await tx.agendamentoSimulado.update({
        where: { id: agendamentoIdInt },
        data: {
          titulo: data.titulo,
          descricao: data.descricao,
          dataInicio: data.dataInicio, // Agora chega como Date válido!
          dataFim: data.dataFim,
          duracaoMinutos: data.duracaoMinutos,
          status: data.status,
        },
      });

      // Atualiza questões se fornecidas
      if (data.questaoIds && data.questaoIds.length > 0) {
        await tx.agendamentoSimuladoQuestao.deleteMany({
          where: { agendamentoId: agendamentoIdInt },
        });

        const novasQuestoes = data.questaoIds.map((qId, index) => ({
          agendamentoId: agendamentoIdInt,
          questaoId: qId,
          ordem: index + 1,
          pontos: 1.0, 
        }));

        await tx.agendamentoSimuladoQuestao.createMany({
          data: novasQuestoes,
        });
      }

      return agendamentoAtualizado;
    });

    // 5. Auditoria
    const changesSafe = {
        titulo: data.titulo ?? null,
        dataInicio: data.dataInicio?.toISOString() ?? null,
        dataFim: data.dataFim?.toISOString() ?? null,
        duracaoMinutos: data.duracaoMinutos ?? null,
        status: data.status ?? null,
        questoesCount: data.questaoIds?.length ?? null
    };

    await registrarLog({
      acao: AuditAction.TURMA_EDITAR,
      usuarioId: professorId,
      usuarioNome: session.name,
      recurso: `Agendamento: ${agendamentoIdInt}`,
      detalhes: { 
        changes: changesSafe,
        statusAnterior: agendamentoAtual.status
      }
    });

    return NextResponse.json({ success: true, agendamento: resultado });

  } catch (error) {
    return safeApiError(error, "Erro ao atualizar agendamento.");
  }
}

// --- DELETE: Excluir Agendamento ---
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string; agendamentoId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { turmaId, agendamentoId } = await params;
    const turmaIdInt = Number(turmaId);
    const agendamentoIdInt = Number(agendamentoId);

    // Anti-IDOR
    const isOwner = await prisma.turmaProfessor.findUnique({
      where: { turmaId_professorId: { turmaId: turmaIdInt, professorId: Number(session.sub) } },
    });

    if (!isOwner && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    // --- TRAVA DE EXCLUSÃO ---
    const agendamento = await prisma.agendamentoSimulado.findUnique({
      where: { id: agendamentoIdInt },
      include: {
        // Busca APENAS entregas que NÃO são pendentes (ou seja, iniciadas/finalizadas)
        entregas: {
          where: { status: { not: "PENDENTE" } },
          select: { id: true }
        }
      }
    });

    if (!agendamento || agendamento.turmaId !== turmaIdInt) {
      return NextResponse.json({ error: "Agendamento não encontrado." }, { status: 404 });
    }

    // Se array > 0, significa que alguém já começou
    if (agendamento.entregas.length > 0) {
      return NextResponse.json({ 
        error: "Não é possível excluir. Alunos já iniciaram a prova. Utilize 'Encerrar Agora' para fechar o acesso." 
      }, { status: 409 });
    }

    // Transação de Exclusão Limpa
    await prisma.$transaction(async (tx) => {
      // 1. Remove os vínculos de questões
      await tx.agendamentoSimuladoQuestao.deleteMany({
        where: { agendamentoId: agendamentoIdInt }
      });

      // 2. Remove as entregas "fantasmas" (PENDENTE)
      await tx.agendamentoEntrega.deleteMany({
        where: { agendamentoId: agendamentoIdInt }
      });

      // 3. Remove o agendamento
      await tx.agendamentoSimulado.delete({
        where: { id: agendamentoIdInt },
      });
    });

    await registrarLog({
      acao: AuditAction.TURMA_EDITAR,
      usuarioId: Number(session.sub),
      usuarioNome: session.name,
      recurso: `Agendamento: ${agendamentoIdInt}`,
      detalhes: { acao: "EXCLUSAO_FISICA", titulo: agendamento.titulo },
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    return safeApiError(error, "Erro ao excluir agendamento.");
  }
}