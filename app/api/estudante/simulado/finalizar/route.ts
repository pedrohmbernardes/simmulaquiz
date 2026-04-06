import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { registrarLog } from "@/lib/audit"; // Removemos AuditAction daqui se não tiver a constante
import { verifyCSRFToken } from "@/lib/csrf"; 
import { safeApiError } from "@/lib/server-utils";

const finalizarSchema = z.object({
  simuladoId: z.number().int().positive(),
});

export async function POST(req: NextRequest) {
  try {
    // 1. Autenticação
    const session = await getSession();
    if (!session || session.role !== "ALUNO") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // 2. CSRF Check
    const csrfToken = req.headers.get("x-csrf-token");
    if (!(await verifyCSRFToken(csrfToken))) {
      return NextResponse.json({ error: "Sessão inválida" }, { status: 403 });
    }

    // 3. Validação do Body
    const body = await req.json();
    const validation = finalizarSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const { simuladoId } = validation.data;
    const alunoId = Number(session.sub);

    // 4. Busca Simulado (Leitura antes da Transação)
    const simulado = await prisma.simulado.findUnique({
      where: { 
        id: simuladoId, 
        usuarioId: alunoId // Anti-IDOR
      },
      include: {
        simuladosQuestoes: {
          include: { 
            questao: { 
              select: { alternativaCorreta: true } 
            } 
          }
        },
        // Trazemos também o ID da entrega vinculada para facilitar o update depois
        agendamentoEntrega: {
            select: { id: true }
        }
      }
    });

    if (!simulado) {
      return NextResponse.json({ error: "Simulado não encontrado" }, { status: 404 });
    }

    if (simulado.status === "CONCLUIDO") {
      return NextResponse.json({ message: "Simulado já finalizado anteriormente." });
    }

    // Correção: Uso de createdAt se dataInicio for nulo
    const agora = new Date();
    const dataInicio = simulado.dataInicio ? new Date(simulado.dataInicio) : simulado.createdAt;
    const tempoGastoSegundos = Math.floor((agora.getTime() - dataInicio.getTime()) / 1000);

    // 5. Transação Atômica de Correção
    const resultado = await prisma.$transaction(async (tx) => {
      let acertos = 0;
      let erros = 0;
      let respondidas = 0;

      // A. Processa cada questão (Correção)
      for (const sq of simulado.simuladosQuestoes) {
        let isCorrect = false;

        if (sq.alternativaMarcada) {
          respondidas++;
          // Comparação segura (garante que ambos sejam strings válidas)
          isCorrect = sq.alternativaMarcada === sq.questao.alternativaCorreta;
        } else {
            // Em branco = Erro
            isCorrect = false;
        }

        if (isCorrect) acertos++;
        else erros++; // Em branco conta como erro aqui

        // Atualiza o status da questão no banco
        await tx.simuladosQuestao.update({
          where: { id: sq.id },
          data: { correta: isCorrect }
        });
      }

      // B. Calcula Nota (0 a 100 para percentual)
      // Evita divisão por zero
      const totalQuestoes = simulado.qtdeQuestoes > 0 ? simulado.qtdeQuestoes : 1;
      const notaPercentual = parseFloat(((acertos / totalQuestoes) * 100).toFixed(1));
      
      // Nota absoluta (número de acertos)
      const notaAcertos = acertos;

      // C. Atualiza Simulado
      const simuladoAtualizado = await tx.simulado.update({
        where: { id: simuladoId },
        data: {
          status: "CONCLUIDO",
          dataConclusao: agora,
          acertos,
          erros,
          notaAcertos,      // Int
          notaPercentual,   // Float (0-100)
          tempoGastoSegundos
        }
      });

      // D. Atualiza Entrega (LMS Link)
      // Atualiza o AgendamentoEntrega se houver vinculo
      if (simulado.agendamentoEntrega?.id) {
          await tx.agendamentoEntrega.update({
              where: { id: simulado.agendamentoEntrega.id },
              data: {
                  status: "CONCLUIDO",
                  finalizadoEm: agora,
                  notaPercentual: notaPercentual,
                  notaAcertos: acertos 
              }
          });
      } else if (simulado.agendamentoId) {
          // Fallback: Atualiza via updateMany (mais seguro se o ID da entrega for incerto)
          await tx.agendamentoEntrega.updateMany({
            where: {
                agendamentoId: simulado.agendamentoId,
                alunoId: alunoId
            },
            data: {
                status: "CONCLUIDO",
                finalizadoEm: agora,
                notaPercentual: notaPercentual,
                notaAcertos: acertos 
            }
          });
      }

      return simuladoAtualizado;
    });

    // 6. Auditoria (Usando string literal para evitar erro de Enum faltante no arquivo audit.ts)
    await registrarLog({
      acao: "SIMULADO_FINALIZAR", // Hardcoded para evitar erro de TS se o AuditAction não tiver essa chave
      usuarioId: alunoId,
      usuarioNome: session.name,
      recurso: `Simulado: ${simuladoId}`,
      detalhes: {
        nota: resultado.notaPercentual,
        acertos: resultado.acertos,
        tempo: resultado.tempoGastoSegundos
      }
    });

    return NextResponse.json({ 
      success: true, 
      nota: resultado.notaPercentual,
      redirectUrl: `/estudante/simulado/${simuladoId}/resultado`
    });

  } catch (error) {
    return safeApiError(error, "Erro ao finalizar simulado.");
  }
}