import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { calcularProgressoNivel } from '@/lib/gamificacao/nivel';
import { expensiveOpsRateLimit } from '@/lib/ratelimit';
import { headers } from 'next/headers';
// ----------------------------------------------------------------------
// IMPORTANTE: Ajuste o caminho abaixo se sua função estiver em outro arquivo
import { processarLoginDiario } from '@/lib/gamificacao/engine'; 
// ----------------------------------------------------------------------

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

async function getTituloPorXP(xp: number) {
  if (!Number.isFinite(xp) || xp < 0) xp = 0;

  const t = await prisma.titulo.findFirst({
    where: { minPontos: { lte: xp } },
    orderBy: { minPontos: 'desc' },
    select: { nome: true, nivel: true, minPontos: true },
  });

  return t ?? { nome: 'Iniciante', nivel: 1, minPontos: 0 };
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !session.sub) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const userId = Number(session.sub);
    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });
    }

    // --- RATE LIMIT ---
    if (expensiveOpsRateLimit) {
      const ip = await getClientIp();
      const { success, limit, reset, remaining } =
        await expensiveOpsRateLimit.limit(`dash_summary:${userId}:${ip}`);

      if (!success) {
        return NextResponse.json(
          { error: 'Muitas atualizações. Aguarde um momento para recarregar.' },
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit': String(limit),
              'X-RateLimit-Remaining': String(remaining),
              'X-RateLimit-Reset': String(reset),
            },
          }
        );
      }
    }

    // =====================================================================
    // 🔥 GAMIFICACÃO: STREAK / LOGIN DIÁRIO
    // =====================================================================
    try {
      await processarLoginDiario(userId);
    } catch (error) {
      console.error(`[Dashboard] Falha ao processar streak para user ${userId}:`, error);
    }
    // =====================================================================

    // Agora buscamos os dados (incluindo a contagem de turmas)
    const [
        usuario, 
        estatisticasGerais, 
        ultimosSimulados, 
        rankingGeral,
        totalTurmas // <--- NOVO: Contagem de Turmas
    ] = await Promise.all([
        // 1. Dados do Usuário
        prisma.usuario.findUnique({
          where: { id: userId },
          select: {
            nome: true,
            gamificacao: {
              select: { pontos: true, nivel: true, streakAtual: true },
            },
          },
        }),

        // 2. Estatísticas Gerais (Simulados)
        prisma.simulado.aggregate({
          where: { usuarioId: userId, status: 'CONCLUIDO' },
          _count: { id: true },
          _avg: { notaPercentual: true },
        }),

        // 3. Gráfico de Evolução (Últimos 10)
        prisma.simulado.findMany({
          where: { usuarioId: userId, status: 'CONCLUIDO' },
          orderBy: { createdAt: 'asc' },
          take: 10,
          select: { createdAt: true, notaPercentual: true },
        }),

        // 4. Ranking Geral (Top 3)
        prisma.usuarioGamificacao.findMany({
          take: 3,
          orderBy: { pontos: 'desc' },
          select: {
            pontos: true,
            usuario: { select: { nome: true } },
          },
        }),

        // 5. NOVO: Contagem de Turmas Ativas para o Card
        prisma.turmaAluno.count({
            where: {
                alunoId: userId,
                status: 'ATIVO'
            }
        })
      ]);

    if (!usuario) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    const xpTotal = usuario.gamificacao?.pontos ?? 0;
    const tituloAtual = await getTituloPorXP(xpTotal);
    const progresso = await calcularProgressoNivel(userId);

    const dadosGrafico = ultimosSimulados.map((s) => ({
      data: new Date(s.createdAt).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
      }),
      aproveitamento: Math.round(s.notaPercentual || 0),
    }));

    // Top 3 do ranking formatado
    const topSemana = await Promise.all(
      rankingGeral.map(async (r, index) => {
        const t = await getTituloPorXP(r.pontos);
        return {
          id: index,
          nome: r.usuario.nome.split(' ')[0],
          titulo: t.nome,
          pontos: r.pontos,
        };
      })
    );

    const responseData = {
      usuario: {
        nome: usuario.nome,
      },
      gamificacao: usuario.gamificacao,
      titulo: tituloAtual.nome,
      progresso,
      // Injetamos a contagem de turmas na raiz ou metrics, conforme esperado pelo Front
      turmasAtivas: totalTurmas, 
      metrics: {
        totalSimulados: estatisticasGerais._count.id,
        media: Math.round(estatisticasGerais._avg.notaPercentual || 0),
        grafico: dadosGrafico,
      },
      topSemana,
    };

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'private, max-age=10, stale-while-revalidate=59',
      },
    });
  } catch (error) {
    console.error(
      'Erro crítico no dashboard:',
      error instanceof Error ? error.message : String(error)
    );
    return NextResponse.json({ error: 'Erro ao carregar dashboard.' }, { status: 500 });
  }
}