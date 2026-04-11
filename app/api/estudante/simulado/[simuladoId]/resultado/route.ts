import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { safeApiError } from "@/lib/server-utils";
import { apiRateLimit } from "@/lib/ratelimit"; // ✅ NOVO: Importando o limitador padrão de API

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ simuladoId: string }> }
) {
  try {
    // 1. Autenticação e RBAC
    const session = await getSession();
    if (!session || session.role !== "ALUNO") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // 2. Rate Limit (Proteção contra Scraping / Carga no Banco)
    const rlKey = `simulado_resultado:${session.sub}`;
    const rl = await apiRateLimit.limit(rlKey);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Muitas requisições. Aguarde alguns instantes antes de atualizar a página." }, 
        { status: 429 }
      );
    }

    const { simuladoId } = await params;
    const simuladoIdInt = Number(simuladoId);
    const alunoId = Number(session.sub);

    if (isNaN(simuladoIdInt)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    // 3. Busca o Simulado + Respostas + Gabarito
    const simulado = await prisma.simulado.findUnique({
      where: {
        id: simuladoIdInt,
      },
      include: {
        // Relação 1: Questões do Simulado
        simuladosQuestoes: {
          include: {
            questao: {
              select: {
                id: true,
                enunciado: true,
                // Colunas individuais de alternativas
                alternativaA: true,
                alternativaB: true,
                alternativaC: true,
                alternativaD: true,
                alternativaE: true,
                
                alternativaCorreta: true, 
                dificuldade: true,
                unidadeCurricular: {
                  select: { nome: true }
                },
                
                // ⚠️ CORREÇÃO 1: Removi 'comentario' pois causava erro. 
                // Se a coluna existir com outro nome (ex: explicacao), descomente e ajuste:
                // explicacao: true, 
              }
            }
          }
        },
        // ⚠️ CORREÇÃO 2: Ajustado para 'agendamentoOrigem' (nome provável no seu schema)
        agendamentoOrigem: {
            select: { titulo: true } 
        }
      }
    });

    if (!simulado) {
      return NextResponse.json({ error: "Simulado não encontrado." }, { status: 404 });
    }

    // 4. SEGURANÇA: Anti-IDOR
    if (simulado.usuarioId !== alunoId) {
      return NextResponse.json({ error: "Você não tem permissão para ver este resultado." }, { status: 403 });
    }

    // 5. SEGURANÇA CRÍTICA: Anti-Cola
    if (simulado.status !== "CONCLUIDO") {
      return NextResponse.json({ 
        error: "O resultado só fica disponível após finalizar a prova." 
      }, { status: 403 });
    }

    const acertosSeguros = simulado.acertos ?? 0;
    const errosSeguros = simulado.erros ?? 0;
    const notaSegura = simulado.notaPercentual ?? 0;

    // 6. Formatação do Retorno
    // ⚠️ CORREÇÃO 3: Uso de agendamentoOrigem e simuladosQuestoes agora funcionará
    // pois o erro de select acima foi resolvido.
    const resultadoFormatado = {
      id: simulado.id,
      titulo: simulado.agendamentoOrigem?.titulo || "Simulado Prático",
      dataConclusao: simulado.dataConclusao,
      
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
          gabarito: q.alternativaCorreta,
          acertou: sq.correta,
          
          // explicacao: q.comentario, // Removido até confirmar o nome da coluna
          disciplina: q.unidadeCurricular?.nome,
          dificuldade: q.dificuldade
        };
      })
    };

    return NextResponse.json(resultadoFormatado);

  } catch (error) {
    return safeApiError(error, "Erro ao carregar resultado.");
  }
}