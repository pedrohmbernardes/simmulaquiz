import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { generateCSRFToken } from '@/lib/csrf';
import { getSession } from '@/lib/auth';
import { csrfRateLimit } from '@/lib/ratelimit'; 

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getClientIpFromHeaders(h: Headers): string {
  const xff = h.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() || '127.0.0.1';
  return h.get('x-real-ip') ?? '127.0.0.1';
}

function noStoreJson(data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.headers.set('Pragma', 'no-cache');
  res.headers.set('Expires', '0');
  res.headers.set('Vary', 'Cookie');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  return res;
}

export async function GET(request: NextRequest) {
  try {
    // 1) Autenticação Opcional (Permite visitantes pegarem token para formulários públicos)
    const session = await getSession();
    const ip = getClientIpFromHeaders(request.headers);
    
    // Chave de rate-limit padrão para visitantes (não logados)
    let rlKey = `csrf:get:public:${ip}`; 
    
    // Se estiver logado, usa uma chave de rate-limit atrelada ao ID do usuário
    if (session?.sub) {
      const usuarioId = Number(session.sub);
      if (Number.isInteger(usuarioId) && usuarioId > 0) {
        rlKey = `csrf:get:${usuarioId}:${ip}`; 
      }
    }

    // 2) Rate-limit (Mantido: Proteção Anti-Scraping/DoS)
    const rl = await csrfRateLimit.limit(rlKey);

    if (!rl.success) {
      return noStoreJson(
        { error: 'Muitas requisições. Tente novamente em instantes.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(rl.limit),
            'X-RateLimit-Remaining': String(rl.remaining),
            'X-RateLimit-Reset': String(rl.reset),
          },
        }
      );
    }

    // 3) LÓGICA DE CORREÇÃO (Idempotência)
    // Antes de gerar um novo, verificamos se o usuário JÁ TEM um token válido no cookie.
    const cookieStore = await cookies();
    const existingToken = cookieStore.get('csrf-token')?.value;

    if (existingToken) {
      // Se já existe, devolvemos o mesmo token.
      return noStoreJson(
        {
          token: existingToken,
          expiresIn: 7200, // 2 horas (estimativa, já que foi reutilizado)
          reused: true     // Flag útil para debug
        },
        { status: 200 }
      );
    }

    // 4) Gera novo token + cookie (Apenas se não existia nenhum)
    // A função generateCSRFToken cuida de setar o Set-Cookie no header da resposta
    const token = await generateCSRFToken();

    return noStoreJson(
      {
        token,
        expiresIn: 7200, // 2 horas
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Erro ao gerar token CSRF:', error instanceof Error ? error.message : String(error));
    return noStoreJson({ error: 'Erro interno ao gerar token de segurança' }, { status: 500 });
  }
}