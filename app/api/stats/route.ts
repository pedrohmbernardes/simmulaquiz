import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { expensiveOpsRateLimit } from "@/lib/ratelimit"; // Limitador para operações pesadas
import { headers } from "next/headers";

export const dynamic = 'force-dynamic';

async function getClientIp() {
  const h = await headers();
  const xff = h.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return (
    h.get('cf-connecting-ip') ??
    h.get('x-real-ip') ??
    h.get('x-client-ip') ??
    '127.0.0.1'
  );
}

export async function GET(request: Request) {
  // 🛡️ 1) SEGURANÇA: Autenticação
  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const userId = Number(session.sub);
  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
  }

  // 🛡️ 2) SEGURANÇA: Rate Limit
  // Estatísticas são pesadas (agregam muitos dados). Protegemos o banco.
  if (expensiveOpsRateLimit) {
    const ip = await getClientIp();
    const { success, limit, reset, remaining } = await expensiveOpsRateLimit.limit(`stats:${userId}:${ip}`);
    
    if (!success) {
      return NextResponse.json(
        { error: "Muitas solicitações ao dashboard. Aguarde um momento." },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': String(remaining),
            'X-RateLimit-Reset': String(reset)
          }
        }
      );
    }
  }

  const { searchParams } = new URL(request.url);
  const ucId = searchParams.get("ucId");

  try {
    if (ucId) {
      // --- LÓGICA PARA UMA UC ESPECÍFICA ---
      
      // Validação básica do ID
      const unidadeCurricularId = Number(ucId);
      if (!Number.isInteger(unidadeCurricularId)) {
        return NextResponse.json({ error: "ID de UC inválido" }, { status: 400 });
      }

      // 🛡️ 3) ISOLAMENTO DE DADOS (Apenas dados do usuário logado)
      const rawStats = await prisma.questaoTentativa.groupBy({
        by: ['correta'],
        where: {
          usuarioId: userId, // <--- CRÍTICO: Filtra pelo usuário
          questao: { unidadeCurricularId: unidadeCurricularId },
        },
        _count: { _all: true },
      });

      const total = rawStats.reduce((acc, curr) => acc + curr._count._all, 0);
      const acertos = rawStats.find((s) => s.correta === true)?._count._all || 0;
      const performance = total > 0 ? ((acertos / total) * 100).toFixed(2) : "0.00";

      return NextResponse.json({
        total,
        acertos,
        erros: total - acertos,
        porcentagemSucesso: Number(performance),
      });

    } else {
      // --- LÓGICA PARA RANKING / DASHBOARD (TODAS AS UCs) ---

      // 🚀 Otimização: Trazemos apenas o necessário e filtramos no DB
      const ucs = await prisma.unidadeCurricular.findMany({
        where: {
            // Opcional: Se quiser mostrar apenas UCs que o aluno tem atividade, descomente:
            // questoes: { some: { historicoTentativas: { some: { usuarioId: userId } } } }
        },
        include: {
          questoes: {
            // Não precisamos trazer todos os campos da questão, só o ID para relacionamento
            select: {
              id: true,
              historicoTentativas: {
                where: { usuarioId: userId }, // <--- CRÍTICO: Filtra tentativas DO USUÁRIO
                select: { correta: true }     // Trazemos apenas se acertou ou não (leve)
              }
            }
          }
        }
      });

      const ranking = ucs.map(uc => {
        let total = 0;
        let acertos = 0;

        // Agregação em memória (agora leve, pois filtramos antes)
        uc.questoes.forEach(q => {
          q.historicoTentativas.forEach(t => {
            total++;
            if (t.correta) acertos++;
          });
        });

        return {
          name: uc.nome,
          aproveitamento: total > 0 ? Number(((acertos / total) * 100).toFixed(2)) : 0,
          total,
          acertos
        };
      })
      .filter(item => item.total > 0) // Remove UCs que o aluno nunca tentou
      .sort((a, b) => b.aproveitamento - a.aproveitamento)
      .slice(0, 5); // Top 5

      return NextResponse.json(ranking);
    }
  } catch (error) {
    console.error("Erro em stats:", error instanceof Error ? error.message : String(error));
    // Resposta genérica em produção para não vazar stack trace
    return NextResponse.json({ error: "Erro ao processar estatísticas." }, { status: 500 });
  }
}