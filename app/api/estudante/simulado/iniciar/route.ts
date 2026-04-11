import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { registrarLog, AuditAction } from "@/lib/audit";
import { verifyCSRFToken } from "@/lib/csrf"; 
import { expensiveOpsRateLimit } from "@/lib/ratelimit"; // ✅ NOVO: Importando o limitador
import { safeApiError } from "@/lib/server-utils";

const iniciarSchema = z.object({
  agendamentoId: z.number().int().positive(),
});

export async function POST(req: NextRequest) {
  try {
    // 1. Autenticação
    const session = await getSession();
    if (!session || session.role !== "ALUNO") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // 2. Rate Limit (Proteção contra cliques duplos/Spam na transação)
    const rlKey = `simulado_iniciar:${session.sub}`;
    const rl = await expensiveOpsRateLimit.limit(rlKey);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Muitas requisições. Aguarde alguns instantes antes de tentar novamente." },
        { status: 429 }
      );
    }

    // 3. CSRF Check
    const csrfToken = req.headers.get("x-csrf-token");
    if (!(await verifyCSRFToken(csrfToken))) {
      return NextResponse.json({ error: "Sessão inválida" }, { status: 403 });
    }

    const body = await req.json();
    const validation = iniciarSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const { agendamentoId } = validation.data;
    const alunoId = Number(session.sub);

    // 4. Busca o Agendamento e Validações de Negócio
    const agendamento = await prisma.agendamentoSimulado.findUnique({
      where: { id: agendamentoId },
      include: {
        questoes: {
          orderBy: { ordem: 'asc' }
        },
        turma: {
           include: {
             alunos: {
               where: { alunoId: alunoId, status: "ATIVO" }
             }
           }
        }
      }
    });

    if (!agendamento) {
      return NextResponse.json({ error: "Agendamento não encontrado." }, { status: 404 });
    }

    // Valida Turma
    if (agendamento.turma.alunos.length === 0) {
      return NextResponse.json({ error: "Você não está matriculado nesta turma." }, { status: 403 });
    }

    // Valida Janela de Tempo
    const agora = new Date();
    if (agora < agendamento.dataInicio) {
      return NextResponse.json({ error: "Este simulado ainda não está aberto." }, { status: 403 });
    }
    if (agora > agendamento.dataFim) {
      return NextResponse.json({ error: "O prazo para este simulado já encerrou." }, { status: 403 });
    }

    // 5. Verifica se já existe um Simulado (Retomar vs Criar)
    const simuladoExistente = await prisma.simulado.findFirst({
      where: {
        agendamentoId: agendamentoId,
        usuarioId: alunoId
      }
    });

    if (simuladoExistente) {
      if (simuladoExistente.status === "CONCLUIDO") {
         return NextResponse.json({ error: "Você já entregou este simulado." }, { status: 409 });
      }
      return NextResponse.json({ simuladoId: simuladoExistente.id, retomada: true });
    }

    // 6. CRIAÇÃO DO SIMULADO (Snapshot)
    const novoSimulado = await prisma.$transaction(async (tx) => {
      
      // A. Cria o Cabeçalho
      // Busca primeiro o ID da entrega para conectar com segurança
      const entrega = await tx.agendamentoEntrega.findFirst({
        where: { agendamentoId: agendamentoId, alunoId: alunoId }
      });

      const simulado = await tx.simulado.create({
        data: {
          usuarioId: alunoId,
          agendamentoId: agendamentoId,
          tipo: "AGENDAMENTO", // ✅ CORREÇÃO: Campo obrigatório adicionado
          dataInicio: agora,
          status: "EM_ANDAMENTO",
          tempoLimiteMinutos: agendamento.duracaoMinutos,
          qtdeQuestoes: agendamento.questoes.length,
          
          // Conecta se encontrou a entrega
          ...(entrega && {
            agendamentoEntrega: {
              connect: { id: entrega.id }
            }
          })
        }
      });

      // B. Copia as Questões (Snapshot das Referências)
      if (agendamento.questoes.length > 0) {
        await tx.simuladosQuestao.createMany({
          data: agendamento.questoes.map(q => ({
            simuladoId: simulado.id,
            questaoId: q.questaoId,
          }))
        });
      }

      // C. Atualiza status na Entrega (LMS)
      // Usamos updateMany como fallback seguro
      await tx.agendamentoEntrega.updateMany({
        where: {
            agendamentoId: agendamentoId,
            alunoId: alunoId
        },
        data: {
            status: "EM_ANDAMENTO",
            iniciadoEm: agora
        }
      });

      return simulado;
    });

    // 7. Auditoria
    await registrarLog({
      acao: AuditAction.SIMULADO_INICIAR,
      usuarioId: alunoId,
      usuarioNome: session.name,
      recurso: `Simulado: ${novoSimulado.id}`,
      detalhes: { agendamento: agendamento.titulo }
    });

    return NextResponse.json({ simuladoId: novoSimulado.id, retomada: false });

  } catch (error) {
    return safeApiError(error, "Erro ao iniciar simulado.");
  }
}