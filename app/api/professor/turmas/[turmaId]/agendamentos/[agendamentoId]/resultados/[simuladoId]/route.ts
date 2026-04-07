import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { safeApiError } from "@/lib/server-utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ turmaId: string; agendamentoId: string; simuladoId: string }> }
) {
  try {
    // 1. Autenticação e RBAC (Professor)
    const session = await getSession();
    if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const { turmaId, agendamentoId, simuladoId } = await params;
    const turmaIdInt = Number(turmaId);
    const agendamentoIdInt = Number(agendamentoId);
    const simuladoIdInt = Number(simuladoId);

    if (isNaN(turmaIdInt) || isNaN(agendamentoIdInt) || isNaN(simuladoIdInt)) {
      return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
    }

    // 2. SEGURANÇA: Verificar se o Professor é dono da Turma (Anti-IDOR)
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

    // 3. Busca o Simulado + Validação Cruzada
    const simulado = await prisma.simulado.findFirst({
      where: {
        id: simuladoIdInt,
        agendamentoId: agendamentoIdInt,
        agendamentoOrigem: {
            turmaId: turmaIdInt
        }
      },
      include: {
        usuario: {
            select: { nome: true, email: true }
        },
        simuladosQuestoes: {
          include: {
            questao: {
              select: {
                id: true,
                enunciado: true,
                alternativaA: true,
                alternativaB: true,
                alternativaC: true,
                alternativaD: true,
                alternativaE: true,
                alternativaCorreta: true, 
                dificuldade: true,
                unidadeCurricular: {
                  select: { nome: true }
                }
              }
            }
          }
        },
        agendamentoOrigem: {
            select: { titulo: true } 
        }
      }
    });

    if (!simulado) {
      return NextResponse.json({ error: "Simulado não encontrado nesta turma." }, { status: 404 });
    }

    // 4. Formatação
    const acertosSeguros = simulado.acertos ?? 0;
    const errosSeguros = simulado.erros ?? 0;
    const notaSegura = simulado.notaPercentual ?? 0;

    const resultadoFormatado = {
      id: simulado.id,
      titulo: simulado.agendamentoOrigem?.titulo,
      aluno: simulado.usuario?.nome ?? "Aluno Desconhecido", 
      email: simulado.usuario?.email ?? "",
      
      dataConclusao: simulado.dataConclusao,
      status: simulado.status,
      
      desempenho: {
        nota: notaSegura,
        acertos: acertosSeguros,
        erros: errosSeguros,
        totalQuestoes: simulado.qtdeQuestoes,
        tempoGasto: simulado.tempoGastoSegundos,
        aproveitamento: simulado.qtdeQuestoes > 0 
          ? Math.round((acertosSeguros / simulado.qtdeQuestoes) * 100) 
          : 0
      },

      questoes: simulado.simuladosQuestoes.map((sq) => {
        const q = sq.questao;
        return {
          questaoId: q.id,
          enunciado: q.enunciado,
          alternativas: {
            A: q.alternativaA,
            B: q.alternativaB,
            C: q.alternativaC,
            D: q.alternativaD,
            E: q.alternativaE,
          }, 
          suaResposta: sq.alternativaMarcada,
          gabarito: q.alternativaCorreta?.toUpperCase(),
          acertou: sq.correta,
          disciplina: q.unidadeCurricular?.nome,
          dificuldade: q.dificuldade
        };
      })
    };

    return NextResponse.json(resultadoFormatado);

  } catch (error) {
    return safeApiError(error, "Erro ao carregar prova do aluno.");
  }
}