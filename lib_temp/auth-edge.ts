import { jwtVerify } from 'jose';

const SECRET_KEY = process.env.JWT_SECRET;
if (!SECRET_KEY) {
  // Fail-fast: sem secret não existe autenticação confiável.
  throw new Error('FATAL: JWT_SECRET não definido.');
}

export const SECRET = new TextEncoder().encode(SECRET_KEY);

// Mantidos para compatibilidade com o projeto
export const TEMPO_EXPIRACAO = '24h';
export const MAX_AGE_SECONDS = 24 * 60 * 60;

// Importante: `jose` tipa `algorithms` como `string[]` (mutável). Use array mutável.
const JWT_ALGORITHMS: string[] = ['HS256'];

export type UserRole = 'ALUNO' | 'PROFESSOR' | 'SUPER_ADMIN';

// Exportando a interface para uso no Middleware (Edge)
export interface SessionPayload {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  mudancaSenhaObrigatoria?: boolean;

  // 🛡️ Segurança: versionamento do token (usado no Node para invalidar em massa)
  tokenVersion: number;

  // Campos opcionais (normalmente hidratados no getSession do Node)
  nivel?: number;
  pontos?: number;
  streak?: number;
  avatarUrl?: string | null;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function isSafeInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && Number.isFinite(v);
}

function isRole(v: unknown): v is UserRole {
  return v === 'ALUNO' || v === 'PROFESSOR' || v === 'SUPER_ADMIN';
}

function parseSessionPayload(payload: unknown): SessionPayload | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;

  // Claims obrigatórias
  if (!isNonEmptyString(p.sub)) return null;
  if (!isNonEmptyString(p.email)) return null;
  if (!isNonEmptyString(p.name)) return null;
  if (!isRole(p.role)) return null;
  if (!isSafeInt(p.tokenVersion)) return null;

  // Sub precisa ser um id numérico positivo (seu projeto usa Number(session.sub))
  const userId = Number(p.sub);
  if (!Number.isInteger(userId) || userId <= 0) return null;

  // Seu modelo de revogação usa jti; na borda não consultamos blacklist,
  // mas exigimos a presença do jti para rejeitar tokens fora do padrão.
  if (!isNonEmptyString(p.jti)) return null;

  const out: SessionPayload = {
    sub: p.sub,
    email: p.email,
    name: p.name,
    role: p.role,
    tokenVersion: p.tokenVersion,
  };

  if (typeof p.mudancaSenhaObrigatoria === 'boolean') {
    out.mudancaSenhaObrigatoria = p.mudancaSenhaObrigatoria;
  }

  // Opcionais (se vierem no token por algum motivo, só aceitamos tipos válidos)
  if (isSafeInt(p.nivel)) out.nivel = p.nivel;
  if (isSafeInt(p.pontos)) out.pontos = p.pontos;
  if (isSafeInt(p.streak)) out.streak = p.streak;
  if (typeof p.avatarUrl === 'string' || p.avatarUrl === null) out.avatarUrl = p.avatarUrl as any;

  return out;
}

/**
 * Verifica e valida um JWT de sessão no Edge (Middleware).
 * - Não acessa banco (Edge runtime)
 * - Valida assinatura, expiração e tipos mínimos das claims
 */
export async function verifyJWT(token: string): Promise<SessionPayload | null> {
  // micro-blindagem contra tokens absurdamente grandes (DoS simples)
  if (!isNonEmptyString(token) || token.length > 4096) return null;

  try {
    const { payload } = await jwtVerify(token, SECRET, {
      algorithms: JWT_ALGORITHMS,
    });

    return parseSessionPayload(payload);
  } catch {
    return null;
  }
}
