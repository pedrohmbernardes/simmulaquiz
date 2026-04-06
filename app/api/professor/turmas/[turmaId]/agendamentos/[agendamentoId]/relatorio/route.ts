import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { safeApiError } from "@/lib/server-utils";

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

    const agendamento = await prisma.agendamentoSimulado.findUnique({
      where: { id: agendamentoIdInt },
      include: {
        questoes: { 
          include: {
            questao: {
              include: { unidadeCurricular: true, funcao: true }
            }
          }
        },
        entregas: {
          where: { 
             simulado: { isNot: null } 
          },
          include: {
            aluno: { select: { id: true, nome: true, email: true, fotoUrl: true } },
            simulado: {
              include: {
                simuladosQuestoes: {
                  include: {
                    questao: {
                      include: { unidadeCurricular: true, funcao: true }
                    }
                  }
                }
              }
            }
          }
        },
        _count: { select: { entregas: true } }
      }
    });

    if (!agendamento) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    if (agendamento.turmaId !== turmaIdInt) {
      return NextResponse.json({ error: "Inconsistência de dados." }, { status: 400 });
    }

    const entregasConcluidas = agendamento.entregas.filter(e => e.status === "CONCLUIDO" && e.simulado);
    const totalEntregues = entregasConcluidas.length;

    // Conta total de alunos que iniciaram (incluindo em andamento)
    const totalIniciaram = agendamento.entregas.length;

    if (totalEntregues === 0) {
      return NextResponse.json({
        resumo: { 
            mediaAcertos: 0, 
            mediaPercentual: 0,
            totalEntregues: 0,
            totalIniciaram,
            questoesProva: agendamento.qtdeQuestoes,
            melhorNota: 0,
            piorNota: 0,
        },
        kpis: { dificuldade: [], bloom: [], unidade: [] },
        alunos: []
      });
    }

    let somaNotas = 0;
    const statsDificuldade: Record<string, { total: number; acertos: number }> = {};
    const statsBloom: Record<string, { total: number; acertos: number }> = {};
    const statsUnidade: Record<string, { total: number; acertos: number }> = {};

    const listaAlunos = entregasConcluidas.map(entrega => {
      const simulado = entrega.simulado!;

      const nota = simulado.notaAcertos ?? 0;
      somaNotas += nota;

      simulado.simuladosQuestoes.forEach(sq => {
        const q = sq.questao;
        const acertou = sq.correta ? 1 : 0;

        const dif = q.dificuldade || "NAO_DEFINIDO";
        if (!statsDificuldade[dif]) statsDificuldade[dif] = { total: 0, acertos: 0 };
        statsDificuldade[dif].total++;
        statsDificuldade[dif].acertos += acertou;

        const bloom = (q as any).nivelCognitivo || "NAO_DEFINIDO";
        if (!statsBloom[bloom]) statsBloom[bloom] = { total: 0, acertos: 0 };
        statsBloom[bloom].total++;
        statsBloom[bloom].acertos += acertou;

        const uc = q.unidadeCurricular?.nome || "Geral";
        if (!statsUnidade[uc]) statsUnidade[uc] = { total: 0, acertos: 0 };
        statsUnidade[uc].total++;
        statsUnidade[uc].acertos += acertou;
      });

      return {
        id: entrega.aluno.id,
        simuladoId: simulado.id, // ← FIX: necessário para link individual
        nome: entrega.aluno.nome,
        email: entrega.aluno.email,
        fotoUrl: entrega.aluno.fotoUrl,
        nota: nota,
        percentual: simulado.notaPercentual ?? 0,
        tempo: simulado.tempoGastoSegundos ?? 0,
        dataEntrega: entrega.updatedAt
      };
    }).sort((a, b) => b.nota - a.nota);

    const formatKPI = (stats: typeof statsDificuldade) => {
      return Object.entries(stats).map(([key, val]) => ({
        label: key.replace(/_/g, " "),
        percentual: val.total > 0 ? Math.round((val.acertos / val.total) * 100) : 0,
        totalQuestoes: val.total 
      })).sort((a, b) => b.percentual - a.percentual); 
    };

    const mediaAcertos = somaNotas / totalEntregues;
    const mediaPercentual = (mediaAcertos / Math.max(1, agendamento.qtdeQuestoes)) * 100;
    const notas = listaAlunos.map(a => a.nota);

    return NextResponse.json({
      resumo: {
        mediaAcertos: parseFloat(mediaAcertos.toFixed(1)),
        mediaPercentual: parseFloat(mediaPercentual.toFixed(1)),
        totalEntregues,
        totalIniciaram,
        questoesProva: agendamento.qtdeQuestoes,
        melhorNota: Math.max(...notas),
        piorNota: Math.min(...notas),
      },
      kpis: {
        dificuldade: formatKPI(statsDificuldade),
        bloom: formatKPI(statsBloom),
        unidade: formatKPI(statsUnidade)
      },
      alunos: listaAlunos
    });

  } catch (error) {
    return safeApiError(error, "Erro ao gerar relatório");
  }
}
