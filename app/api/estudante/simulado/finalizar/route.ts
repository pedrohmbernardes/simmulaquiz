import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { registrarLog } from "@/lib/audit"; 
import { verifyCSRFToken } from "@/lib/csrf"; 
import { safeApiError } from "@/lib/server-utils";
import { getShuffleMap } from "@/lib/utils"; // ── Importando nossa função mágica ──

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
              select: { id: true, alternativaCorreta: true } // Precisamos do ID da questão para a semente
            } 
          }
        },
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

    const agora = new Date();
    const dataInicio = simulado.dataInicio ? new Date(simulado.dataInicio) : simulado.createdAt;
    const tempoGastoSegundos = Math.floor((agora.getTime() - dataInicio.getTime()) / 1000);

    // 5. Transação Atômica de Correção
    const resultado = await prisma.$transaction(async (tx) => {
      let acertos = 0;
      let erros = 0;
      let respondidas = 0;

      // A. Processa cada questão (Correção com Tradução de Mapa)
      for (const sq of simulado.simuladosQuestoes) {
        let isCorrect = false;

        if (sq.alternativaMarcada) {
          respondidas++;
          
          // ── MÁGICA DA CORREÇÃO AQUI ──
          // Pega o mesmo mapa determinístico usado no frontend
          const mapa = getShuffleMap(simuladoId, sq.questao.id);
          
          // 1. Pega a letra que o aluno clicou visualmente na tela dele (ex: "A")
          const letraMarcadaVisivel = sq.alternativaMarcada.toUpperCase();
          
          // 2. Descobre qual é a verdadeira letra do banco de dados (ex: "C")
          const letraRealNoBanco = mapa[letraMarcadaVisivel];

          // 3. Compara a letra traduzida com o gabarito original
          isCorrect = letraRealNoBanco === sq.questao.alternativaCorreta?.toUpperCase();
        } else {
            // Em branco = Erro
            isCorrect = false;
        }

        if (isCorrect) acertos++;
        else erros++; // Em branco conta como erro aqui

        // Atualiza o status da questão no banco (agora sabendo de verdade se acertou)
        await tx.simuladosQuestao.update({
          where: { id: sq.id },
          data: { correta: isCorrect }
        });
      }

      // B. Calcula Nota (0 a 100 para percentual)
      const totalQuestoes = simulado.qtdeQuestoes > 0 ? simulado.qtdeQuestoes : 1;
      const notaPercentual = parseFloat(((acertos / totalQuestoes) * 100).toFixed(1));
      
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

    // 6. Auditoria
    await registrarLog({
      acao: "SIMULADO_FINALIZAR", 
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