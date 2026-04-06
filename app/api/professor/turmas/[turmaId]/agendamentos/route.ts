import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { registrarLog, AuditAction } from "@/lib/audit";
import { safeApiError, getClientIp } from "@/lib/server-utils";
import { adminContentRateLimit } from "@/lib/ratelimit";
import { verifyCSRFToken } from "@/lib/csrf"; // ✅ CSRF
import { sanitizeObject } from "@/lib/sanitize"; // ✅ XSS

// Schema atualizado: Agora aceita moduloId
const criarAgendamentoSchema = z.object({
  titulo: z.string().min(3).max(100),
  dataInicio: z.coerce.date(),
  dataFim: z.coerce.date(),
  duracaoMinutos: z.number().min(10),
  questaoIds: z.array(z.number()).min(1, "Selecione pelo menos uma questão"),
  config: z.any().optional(),
  
  // ✅ Campo Novo
  moduloId: z.number().optional(), 
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string }> }
) {
  try {
    // 1. Autenticação & RBAC
    const session = await getSession();
    if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // 2. 🛡️ CSRF Check
    const csrfToken = req.headers.get("x-csrf-token");
    if (!(await verifyCSRFToken(csrfToken))) {
      await registrarLog({
        acao: AuditAction.SEGURANCA_CSRF_INVALIDO,
        usuarioId: Number(session.sub),
        recurso: "POST /api/professor/.../agendamentos",
      });
      return NextResponse.json({ error: "Sessão inválida (Token de Segurança)" }, { status: 403 });
    }

    const { turmaId } = await params;
    const turmaIdInt = Number(turmaId);
    const userId = Number(session.sub);

    if (isNaN(turmaIdInt)) {
      return NextResponse.json({ error: "ID de turma inválido" }, { status: 400 });
    }

    // 3. Rate Limit
    const ip = await getClientIp(req);
    const { success } = await adminContentRateLimit.limit(`create_agendamento:${userId}:${ip}`);
    if (!success) return NextResponse.json({ error: "Muitas requisições. Aguarde." }, { status: 429 });

    // 4. Valida Propriedade
    const isOwner = await prisma.turmaProfessor.findUnique({
      where: { turmaId_professorId: { turmaId: turmaIdInt, professorId: userId } },
    });

    if (!isOwner && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Você não administra esta turma." }, { status: 403 });
    }

    // 5. Valida Body
    const body = await req.json();
    const validation = criarAgendamentoSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Dados inválidos", details: validation.error.flatten() }, { status: 400 });
    }

    const { titulo, dataInicio, dataFim, duracaoMinutos, questaoIds, config, moduloId } = validation.data;

    if (dataFim <= dataInicio) {
      return NextResponse.json({ error: "A data final deve ser posterior à data inicial." }, { status: 400 });
    }

    const tituloSanitizado = sanitizeObject(titulo);

    // 8. Transação Atômica (Agendamento + Questões + Entregas + Módulo)
    const resultado = await prisma.$transaction(async (tx) => {
      
      // A. Cria o Agendamento
      const agendamento = await tx.agendamentoSimulado.create({
        data: {
          turmaId: turmaIdInt,
          criadoPorId: userId,
          titulo: tituloSanitizado,
          dataInicio,
          dataFim,
          duracaoMinutos, 
          qtdeQuestoes: questaoIds.length,
          status: "PUBLICADO",
          config: config || {
             origem: "MESA_CRIACAO_MANUAL",
             ids: questaoIds
          }, 
        },
      });

      // B. Cria os Itens (Questões)
      await tx.agendamentoSimuladoQuestao.createMany({
        data: questaoIds.map((qid, idx) => ({
          agendamentoId: agendamento.id,
          questaoId: qid,
          ordem: idx + 1,
        })),
      });

      // C. Distribui para Alunos Ativos
      const alunosAtivos = await tx.turmaAluno.findMany({
        where: { turmaId: turmaIdInt, status: "ATIVO" },
        select: { alunoId: true }
      });

      if (alunosAtivos.length > 0) {
        await tx.agendamentoEntrega.createMany({
          data: alunosAtivos.map(aluno => ({
            turmaId: turmaIdInt,
            agendamentoId: agendamento.id,
            alunoId: aluno.alunoId,
            status: "PENDENTE",
          }))
        });
      }

      // D. ✅ Cria o Vínculo com Módulo (Se moduloId existir)
      if (moduloId) {
        const moduloExiste = await tx.moduloTurma.findFirst({
          where: { id: moduloId, turmaId: turmaIdInt }
        });

        if (moduloExiste) {
          const ultimoItem = await tx.moduloItem.findFirst({
            where: { moduloId },
            orderBy: { ordem: 'desc' },
            select: { ordem: true }
          });
          
          const novaOrdem = (ultimoItem?.ordem ?? 0) + 1;

          await tx.moduloItem.create({
            data: {
              moduloId,
              titulo: agendamento.titulo,
              tipo: "AGENDAMENTO_SIMULADO",
              ordem: novaOrdem,
              agendamentoId: agendamento.id
            }
          });
        }
      }

      return { ...agendamento, totalAlunosDistribuidos: alunosAtivos.length };
    });

    // 9. Auditoria
    await registrarLog({
      acao: AuditAction.AGENDAMENTO_CRIAR,
      usuarioId: userId,
      usuarioNome: session.name,
      recurso: `Agendamento: ${resultado.id}`,
      detalhes: { 
        turmaId: turmaIdInt, 
        moduloId: moduloId ?? null, // Registra vínculo
        titulo: tituloSanitizado, 
        qtdQuestoes: questaoIds.length
      },
    });

    return NextResponse.json(resultado, { status: 201 });

  } catch (error) {
    if ((error as any).code === 'P2003') {
       return NextResponse.json({ error: "Erro de integridade: Questão inválida." }, { status: 400 });
    }
    return safeApiError(error, "Erro ao criar agendamento.");
  }
}

// GET mantido igual (não precisa de alteração)
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
    const userId = Number(session.sub);

    if (isNaN(turmaIdInt)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const isOwner = await prisma.turmaProfessor.findUnique({
      where: { turmaId_professorId: { turmaId: turmaIdInt, professorId: userId } },
    });

    if (!isOwner && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const agendamentos = await prisma.agendamentoSimulado.findMany({
      where: { turmaId: turmaIdInt },
      orderBy: { createdAt: "desc" },
      include: { 
        _count: { select: { entregas: true } }
      },
    });

    return NextResponse.json(agendamentos);
  } catch (error) {
    return safeApiError(error, "Erro ao listar agendamentos.");
  }
}