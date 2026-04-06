// app/api/simulados/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { csrfRateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip') ?? '127.0.0.1';
}

function noStoreJson(data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.headers.set('Pragma', 'no-cache');
  res.headers.set('Expires', '0');
  res.headers.set('Vary', 'Cookie');
  return res;
}

function withRateLimitHeaders(res: NextResponse, rl: { limit: number; remaining: number; reset: number }) {
  res.headers.set('X-RateLimit-Limit', String(rl.limit));
  res.headers.set('X-RateLimit-Remaining', String(rl.remaining));
  res.headers.set('X-RateLimit-Reset', String(rl.reset));
  return res;
}

function parsePositiveInt(raw: unknown): number | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== 'string' && typeof v !== 'number') return null;

  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isInteger(n) || n <= 0) return null;

  return n;
}

type Ctx = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: NextRequest,
  ctx: Ctx
) {
  try {
    // ✅ params no formato esperado pelo Next 16
    const { id } = await ctx.params;
    const simuladoId = parsePositiveInt(id);
    if (!simuladoId) {
      return noStoreJson({ error: 'ID inválido' }, { status: 400 });
    }

    // ✅ Auth
    const sessao = await getSession();
    if (!sessao?.sub) {
      return noStoreJson({ error: 'Não autorizado' }, { status: 401 });
    }

    const usuarioId = Number(sessao.sub);
    if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
      return noStoreJson({ error: 'Sessão inválida' }, { status: 401 });
    }

    // ✅ Rate limit (padrão do projeto)
    const ip = getClientIp(request);
    const rlKey = `simulados:get:${usuarioId}:${ip}`;
    const rl = await csrfRateLimit.limit(rlKey);
    if (!rl.success) {
      return withRateLimitHeaders(
        noStoreJson({ error: 'Muitas requisições. Tente novamente em instantes.' }, { status: 429 }),
        rl
      );
    }

    // ✅ IDOR: só retorna se o simulado pertence ao usuário
    const simulado = await prisma.simulado.findFirst({
      where: {
        id: simuladoId,
        usuarioId,
      },
      select: {
        id: true,
        tipo: true,
        status: true,
        qtdeQuestoes: true,
        tempoLimiteMinutos: true,
        tempoGastoMinutos: true,
        dataInicio: true,
        dataConclusao: true,

        // ✅ resumo do resultado (seguro: não vaza gabarito)
        notaAcertos: true,
        notaPercentual: true,
        questoesRespondidas: true,
        acertos: true,
        erros: true,
        mediaTempoPorQuestaoSeg: true,

        // ✅ gamificação (pós-finalização)
        gamificacaoProcessadaEm: true,
        xpConcedido: true,

        // ✅ anti-cheat / auditoria
        strikesUsados: true,
        strikesMax: true,
        anuladoMotivo: true,

        simuladosQuestoes: {
          orderBy: { id: 'asc' },
          select: {
            id: true,
            questaoId: true,
            alternativaMarcada: true,
            tempoResposta: true,
            // ❌ NÃO retorna "correta" aqui (isso fica pro /resultado)
            questao: {
              select: {
                id: true,
                enunciado: true,
                alternativaA: true,
                alternativaB: true,
                alternativaC: true,
                alternativaD: true,
                alternativaE: true,
                // ❌ NÃO retornar alternativaCorreta (evita leak do gabarito)
                dificuldade: true,
                nivelCognitivo: true,
                unidadeCurricular: { select: { id: true, nome: true } },
                imagens: { select: { url: true, filename: true, width: true, height: true } },
              },
            },
          },
        },
      },
    });

    if (!simulado) {
      // Não revela se existe; apenas que não é acessível pelo usuário.
      // (Best-effort) loga tentativa de acesso/enumeração.
      try {
        await prisma.logAuditoria.create({
          data: {
            usuarioId,
            usuarioNome: (sessao as any)?.name ?? null,
            ip,
            userAgent: request.headers.get('user-agent') || null,
            acao: 'SIMULADO_GET_NOT_FOUND',
            recurso: `simulado:${simuladoId}`,
            detalhes: { simuladoId },
          },
        });
      } catch {
        // não falha a request por causa de log
      }

      return noStoreJson({ error: 'Simulado não encontrado' }, { status: 404 });
    }

    const jaFinalizado = simulado.status !== 'EM_ANDAMENTO' || !!simulado.dataConclusao;
    const gamificacaoPendente =
      simulado.status === 'CONCLUIDO' && !simulado.gamificacaoProcessadaEm;

    return noStoreJson({
      ...simulado,
      _jaFinalizado: jaFinalizado,
      _gamificacaoPendente: gamificacaoPendente,
    });
  } catch (error) {
    console.error(
      'Erro em /api/simulados/[id] (GET):',
      error instanceof Error ? error.message : String(error)
    );
    return noStoreJson({ error: 'Erro interno ao carregar o simulado.' }, { status: 500 });
  }
}