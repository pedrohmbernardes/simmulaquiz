// app/api/estudante/caderno-erros/detalhes/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { csrfRateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getClientIp(req: NextRequest) {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const xrip = req.headers.get('x-real-ip')?.trim();
  return xrip || 'unknown';
}

function noStoreJson(data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);

  // Cache hard-disable (API)
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.headers.set('Pragma', 'no-cache');
  res.headers.set('Expires', '0');
  res.headers.set('Vary', 'Cookie');

  // Segurança básica
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'same-origin');

  return res;
}

type Ctx = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    // ✅ Auth
    const sessao = await getSession();
    if (!sessao?.sub) {
      return noStoreJson({ error: 'Não autorizado' }, { status: 401 });
    }

    const usuarioId = Number(sessao.sub);
    if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
      return noStoreJson({ error: 'Sessão inválida' }, { status: 401 });
    }

    // ✅ Params (Next 16: params é Promise)
    const params = await ctx.params;
    const questaoId = Number(params?.id);

    // ✅ Validação de ID (evita lixo, NaN, negativo, etc.)
    if (!Number.isInteger(questaoId) || questaoId <= 0) {
      return noStoreJson({ error: 'ID inválido' }, { status: 400 });
    }

    // ✅ Rate limit (padrão do projeto)
    const ip = getClientIp(request);
    const rlKey = `caderno-erros:detalhes:${usuarioId}:${ip}`;
    const rl = await csrfRateLimit.limit(rlKey);

    if (!rl.success) {
      const res = noStoreJson(
        { error: 'Muitas requisições. Tente novamente em instantes.' },
        { status: 429 }
      );

      // Se seu limiter expõe esses campos, ótimo; se não expor, não quebra.
      if ((rl as any).limit != null) res.headers.set('X-RateLimit-Limit', String((rl as any).limit));
      if ((rl as any).remaining != null) res.headers.set('X-RateLimit-Remaining', String((rl as any).remaining));
      if ((rl as any).reset != null) res.headers.set('X-RateLimit-Reset', String((rl as any).reset));

      return res;
    }

    // ✅ IDOR: busca somente se a questão pertence ao caderno do usuário
    const registroErro = await prisma.questaoErro.findFirst({
      where: {
        usuarioId,
        questaoId,
      },
      select: {
        id: true,
        vezesErrada: true,
        revisada: true,
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
            unidadeCurricular: { select: { id: true, nome: true } },
            imagens: {
              select: { url: true, filename: true, mimeType: true, width: true, height: true },
            },
            dificuldade: true,
            nivelCognitivo: true,
          },
        },
      },
    });

    if (!registroErro || !registroErro.questao) {
      // não revela se a questão existe no banco, só que não está vinculada ao usuário
      return noStoreJson({ error: 'Questão não encontrada no seu caderno.' }, { status: 404 });
    }

    // ✅ Retorno seguro (sem gabarito)
    return noStoreJson({
      id: registroErro.questao.id,
      enunciado: registroErro.questao.enunciado,
      alternativaA: registroErro.questao.alternativaA,
      alternativaB: registroErro.questao.alternativaB,
      alternativaC: registroErro.questao.alternativaC,
      alternativaD: registroErro.questao.alternativaD,
      alternativaE: registroErro.questao.alternativaE,
      imagens: registroErro.questao.imagens,
      unidadeCurricular: registroErro.questao.unidadeCurricular,
      dificuldade: registroErro.questao.dificuldade,
      nivelCognitivo: registroErro.questao.nivelCognitivo,
      vezesErrada: registroErro.vezesErrada,
      revisada: registroErro.revisada,
    });
  } catch (error) {
    console.error(
      'Erro em /api/estudante/caderno-erros/detalhes/[id]:',
      error instanceof Error ? error.message : String(error)
    );
    return noStoreJson({ error: 'Erro interno ao carregar a questão.' }, { status: 500 });
  }
}