import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';

import { logout, getSession } from '@/lib/auth';
import { registrarLog, AuditAction } from '@/lib/audit';
import { verifyCSRFToken } from '@/lib/csrf';
import { csrfRateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ✅ nomes reais dos cookies no seu projeto (confirmado nos anexos)
const AUTH_COOKIE = 'auth-token';
const CSRF_COOKIE = 'csrf-token';

async function getClientIpAsync() {
  const h = await headers();
  const xff = h.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() || '127.0.0.1';
  return h.get('x-real-ip') ?? h.get('cf-connecting-ip') ?? '127.0.0.1';
}

function noStoreJson(data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.headers.set('Pragma', 'no-cache');
  res.headers.set('Expires', '0');

  // “Botão nuclear” pro cliente limpar cookies/storage desse domínio
  res.headers.set('Clear-Site-Data', '"cookies", "storage"');

  return res;
}

function forceDeleteCookie(res: NextResponse, name: string) {
  // ✅ reforço: seta cookie expirado no path raiz
  // (mais garantido do que depender só do cookieStore.delete)
  res.cookies.set({
    name,
    value: '',
    path: '/',
    expires: new Date(0),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

export async function POST(request: Request) {
  const ip = await getClientIpAsync();
  const userAgent = (request.headers.get('user-agent') || 'unknown').slice(0, 250);

  try {
    // 1) Rate limit
    if (csrfRateLimit) {
      const { success } = await csrfRateLimit.limit(`logout:${ip}`);
      if (!success) {
        return noStoreJson({ error: 'Muitas requisições. Tente novamente.' }, { status: 429 });
      }
    }

    // 2) Se existir cookie de auth, exige CSRF válido (anti “logout forçado” por site malicioso)
    const cookieStore = await cookies();
    const authToken = cookieStore.get(AUTH_COOKIE)?.value;
    const hasAuthCookie = !!authToken;

    if (hasAuthCookie) {
      const csrfHeader = request.headers.get('x-csrf-token');
      const csrfOk = await verifyCSRFToken(csrfHeader);

      if (!csrfOk) {
        await registrarLog({
          acao: AuditAction.SEGURANCA_CSRF_INVALIDO,
          recurso: 'Sessão',
          detalhes: { erro: 'CSRF inválido em logout', ip, rota: '/api/auth/logout' },
          ip,
          userAgent,
        });

        // Mesmo falhando CSRF, não limpa cookies (pra não permitir logout CSRF)
        return noStoreJson(
          { error: 'Token de segurança inválido ou expirado. Recarregue a página.' },
          { status: 403 }
        );
      }
    }

    // 3) Recupera sessão antes de destruir (auditoria)
    const session = await getSession();

    // 4) Logout real (blacklist + apaga auth-token via lib/auth.logout)
    await logout();

    // 5) Remove cookies (auth + csrf + fluxos auxiliares)
    try {
      cookieStore.delete(AUTH_COOKIE);
      cookieStore.delete(CSRF_COOKIE);
      cookieStore.delete('pending_email_change');
    } catch {
      // ignora se não existir
    }

    // 6) Auditoria
    if (session) {
      await registrarLog({
        acao: AuditAction.LOGOUT_SUCESSO, // se não existir LOGOUT no enum, mantém, mas detalha no payload
        usuarioId: Number(session.sub),
        usuarioNome: session.name,
        recurso: 'Sessão',
        detalhes: {
          acao: 'LOGOUT',
          motivo: 'Solicitação do usuário',
          ip,
          rota: '/api/auth/logout',
        },
        ip,
        userAgent,
      });
    }

    // ✅ resposta + reforço “expira cookie”
    const res = noStoreJson({ success: true });
    forceDeleteCookie(res, AUTH_COOKIE);
    forceDeleteCookie(res, CSRF_COOKIE);

    // cookies auxiliares (não precisa httpOnly necessariamente, mas mantém consistente)
    forceDeleteCookie(res, 'pending_email_change');

    return res;
  } catch (error) {
    console.error('Erro em auth/logout:', error instanceof Error ? error.message : String(error));

    // ✅ Mesmo em erro, tenta limpar cookies e retorna sucesso (não prende o usuário)
    const res = noStoreJson({ success: true });

    try {
      const cs = await cookies();
      cs.delete(AUTH_COOKIE);
      cs.delete(CSRF_COOKIE);
      cs.delete('pending_email_change');
    } catch {}

    forceDeleteCookie(res, AUTH_COOKIE);
    forceDeleteCookie(res, CSRF_COOKIE);
    forceDeleteCookie(res, 'pending_email_change');

    return res;
  }
}
