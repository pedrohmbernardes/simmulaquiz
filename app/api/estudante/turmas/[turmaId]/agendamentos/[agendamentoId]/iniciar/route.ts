import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { registrarLog, AuditAction } from "@/lib/audit";
import { safeApiError, getClientIp } from "@/lib/server-utils";
import { verifyCSRFToken } from "@/lib/csrf"; 
import { expensiveOpsRateLimit } from "@/lib/ratelimit"; 

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string; agendamentoId: string }> }
) {
  try {
    // 1. Autenticação e RBAC
    const session = await getSession();
    if (!session || session.role !== "ALUNO") {
      return NextResponse.json({ error: "Apenas alunos podem iniciar avaliações." }, { status: 403 });
    }

    // 2. 🛡️ CSRF Check
    const csrfToken = req.headers.get("x-csrf-token");
    if (!(await verifyCSRFToken(csrfToken))) {
      await registrarLog({
        acao: AuditAction.SEGURANCA_CSRF_INVALIDO,
        usuarioId: Number(session.sub),
        recurso: "POST .../iniciar",
      });
      return NextResponse.json({ error: "Sessão inválida (Token de Segurança)" }, { status: 403 });
    }

    const { turmaId, agendamentoId } = await params;
    const turmaIdInt = Number(turmaId);
    const agendamentoIdInt = Number(agendamentoId);
    const alunoId = Number(session.sub);

    if (isNaN(turmaIdInt) || isNaN(agendamentoIdInt)) {
      return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
    }

    // 3. Rate Limit (Operação Pesada: Clonagem de Banco)
    const ip = await getClientIp(req);
    const { success, reset } = await expensiveOpsRateLimit.limit(`start_simulado:${alunoId}:${ip}`);
    
    if (!success) {
      return NextResponse.json(
        { error: "Você está tentando iniciar muitas vezes. Aguarde um momento." },
        { status: 429, headers: { "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString() } }
      );
    }

    // 4. Busca Validação (Leitura Leve antes da Transação)
    const validacao = await prisma.agendamentoSimulado.findUnique({
      where: {
        id: agendamentoIdInt,
        turmaId: turmaIdInt, // Garante integridade referencial
      },
      include: {
        turma: {
          select: {
            alunos: {
              where: { alunoId: alunoId },
              select: { status: true },
            },
          },
        },
        entregas: {
          where: { alunoId: alunoId },
        },
      },
    });

    if (!validacao) {
      return NextResponse.json({ error: "Agendamento não encontrado." }, { status: 404 });
    }

    // 4.1 Verifica Matrícula Ativa
    const matricula = validacao.turma.alunos[0];
    if (!matricula || matricula.status !== "ATIVO") {
      return NextResponse.json({ error: "Você não é membro ativo desta turma." }, { status: 403 });
    }

    // 4.2 Verifica Status do Agendamento
    if (validacao.status !== "PUBLICADO") {
      return NextResponse.json({ error: "Avaliação não disponível." }, { status: 403 });
    }

    // 4.3 Verifica Janela de Tempo
    const agora = new Date();
    // No schema atual, os campos são dataInicio e dataFim
    if (agora < validacao.dataInicio) return NextResponse.json({ error: "Prova ainda não iniciou." }, { status: 403 });
    if (agora > validacao.dataFim) return NextResponse.json({ error: "Prazo encerrado." }, { status: 403 });

    // 4.4 Verifica Entregas Anteriores
    const entregaExistente = validacao.entregas[0];
    if (entregaExistente) {
      if (["CONCLUIDO", "ANULADO", "ABANDONADO"].includes(entregaExistente.status)) {
        return NextResponse.json(
          { error: "Avaliação já finalizada.", simuladoId: entregaExistente.simuladoId },
          { status: 409 }
        );
      }
      // Retomada (Idempotência)
      if (entregaExistente.status === "EM_ANDAMENTO" && entregaExistente.simuladoId) {
        return NextResponse.json({ 
          message: "Retomando avaliação...", 
          simuladoId: entregaExistente.simuladoId 
        });
      }
    }

    // 5. Busca Template de Questões (Preservando Ordem)
    const questoesTemplate = await prisma.agendamentoSimuladoQuestao.findMany({
      where: { agendamentoId: agendamentoIdInt },
      orderBy: { ordem: "asc" },
      select: { questaoId: true },
    });

    if (questoesTemplate.length === 0) {
      return NextResponse.json({ error: "Erro de configuração: Prova sem questões." }, { status: 500 });
    }

    // 6. Transação Atômica (Start Exam)
    const novoSimulado = await prisma.$transaction(async (tx) => {
      // A. Cria Simulado (Cronômetro inicia aqui)
      const simulado = await tx.simulado.create({
        data: {
          tipo: "TURMA",
          usuarioId: alunoId,
          agendamentoId: agendamentoIdInt,
          qtdeQuestoes: validacao.qtdeQuestoes,
          // CORREÇÃO AQUI: duracaoMinutos ao invés de tempoLimiteMin
          tempoLimiteMinutos: validacao.duracaoMinutos, 
          status: "EM_ANDAMENTO",
          dataInicio: new Date(),
          alertasTempo: [Math.floor(validacao.duracaoMinutos / 2), 10, 5],
        },
      });

      // B. Clona Questões (Snapshot da prova)
      // Mapeia corretamente
      const questoesParaInserir = questoesTemplate.map((q) => ({
          simuladoId: simulado.id,
          questaoId: q.questaoId,
          alternativaMarcada: null,
          correta: null,
          tempoResposta: 0,
      }));

      await tx.simuladosQuestao.createMany({
        data: questoesParaInserir,
      });

      // C. Vincula ao LMS (AgendamentoEntrega)
      // Usa upsert para garantir que se houver race condition, não quebre
      // Mas a lógica do AgendamentoEntrega pede @@unique([agendamentoId, alunoId])
      await tx.agendamentoEntrega.upsert({
        where: {
          agendamentoId_alunoId: {
            agendamentoId: agendamentoIdInt,
            alunoId: alunoId,
          },
        },
        update: {
          status: "EM_ANDAMENTO",
          iniciadoEm: new Date(),
          simuladoId: simulado.id,
        },
        create: {
          agendamentoId: agendamentoIdInt,
          turmaId: turmaIdInt,
          alunoId: alunoId,
          status: "EM_ANDAMENTO",
          iniciadoEm: new Date(),
          simuladoId: simulado.id,
        },
      });

      return simulado;
    });

    // 7. Auditoria
    await registrarLog({
      acao: AuditAction.SIMULADO_INICIAR,
      usuarioId: alunoId,
      usuarioNome: session.name,
      recurso: `Simulado: ${novoSimulado.id}`,
      detalhes: {
        origem: "TURMA",
        agendamentoId: agendamentoIdInt,
        questoes: questoesTemplate.length
      },
    });

    return NextResponse.json({ simuladoId: novoSimulado.id }, { status: 201 });

  } catch (error) {
    return safeApiError(error, "Erro ao iniciar avaliação.");
  }
}