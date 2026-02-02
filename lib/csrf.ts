import { SignJWT, jwtVerify } from 'jose';
import crypto from 'crypto';
import { cookies } from 'next/headers';

const CSRF_COOKIE_NAME = 'csrf-token';

// Usa um segredo específico para CSRF ou fallback para o JWT_SECRET
const SECRET_KEY = process.env.CSRF_SECRET || process.env.JWT_SECRET;
if (!SECRET_KEY) {
  // Em produção, isso deve falhar o build se não tiver chave
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: CSRF_SECRET ou JWT_SECRET não definido.');
  }
  console.warn('⚠️ AVISO: Usando segredo inseguro para CSRF (Ambiente Dev)');
}

// Em dev (sem secret), usamos um fallback fixo só pra não quebrar a DX.
// ⚠️ Não use isso em produção.
const SECRET = new TextEncoder().encode(SECRET_KEY || 'dev-secret-do-not-use');

// Evita downgrade/alg confusion
const JWT_ALGORITHMS: string[] = ['HS256'];

function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

/**
 * Gera um token CSRF seguro e o armazena em cookie httpOnly
 * Deve ser chamado:
 * 1) No login bem-sucedido
 * 2) Ao carregar a aplicação (via endpoint /api/csrf)
 */
export async function generateCSRFToken(): Promise<string> {
  // Payload simples: o importante é a assinatura + expiração + entropia
  const token = await new SignJWT({ csrf: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime('24h') // Token válido por 24 horas
    .sign(SECRET);

  // CORREÇÃO: Adicionado 'await'
  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === 'production';

  // O cookie é a “metade secreta” do Double Submit Pattern
  cookieStore.set(CSRF_COOKIE_NAME, token, {
    httpOnly: true, // JS não lê (protege contra XSS roubar o cookie)
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // MUDANÇA: 24 horas em segundos
  });

  return token;
}

/**
 * Verifica se o token CSRF fornecido no Header bate com o Cookie
 * (Double Submit Pattern) e se a assinatura/expiração é válida.
 */
export async function verifyCSRFToken(tokenHeader: string | null): Promise<boolean> {
  const header = (tokenHeader ?? '').trim();
  if (!header) return false;

  // Blindagem básica: evita payloads gigantes em headers
  if (header.length > 4096) return false;

  try {
    // CORREÇÃO: Adicionado 'await'
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get(CSRF_COOKIE_NAME)?.value;

    // 1) O cookie deve existir
    if (!tokenCookie) {
      console.warn('⚠️ CSRF: Cookie não encontrado.');
      return false;
    }

    // 2) Double Submit Pattern: header deve ser idêntico ao cookie
    if (!safeEqual(tokenCookie, header)) {
      console.warn('⚠️ CSRF: Token do Header difere do Cookie.');
      return false;
    }

    // 3) Assinatura + expiração
    const { payload } = await jwtVerify(header, SECRET, { algorithms: JWT_ALGORITHMS });

    if (payload.csrf !== true) return false;
    if (typeof payload.jti !== 'string' || payload.jti.length < 8) return false;

    return true;
  } catch {
    // Token expirado ou assinatura inválida
    return false;
  }
}