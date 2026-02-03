import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Interface comum para permitir fallback local com a mesma assinatura do Upstash.
 * (A resposta do Upstash pode conter campos extras como `pending` e isso não quebra.)
 */
export type LimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  /** Unix timestamp em ms (mesma unidade do Upstash). */
  reset: number;
  /** Upstash pode devolver `pending` em alguns runtimes. Mantemos opcional. */
  pending?: Promise<unknown>;
};

interface Limiter {
  limit: (identifier: string) => Promise<LimitResult>;
}

function parseWindowSeconds(window: `${number} ${'s' | 'm' | 'h' | 'd'}`): number {
  const [nRaw, unit] = window.split(' ') as [string, 's' | 'm' | 'h' | 'd'];
  const n = Number(nRaw);
  if (!Number.isFinite(n) || n <= 0) return 60;

  if (unit === 's') return Math.trunc(n);
  if (unit === 'm') return Math.trunc(n * 60);
  if (unit === 'h') return Math.trunc(n * 60 * 60);
  return Math.trunc(n * 60 * 60 * 24);
}

function normalizeIdentifier(identifier: string): string {
  // remove whitespace boba e limita tamanho de chave (evita abuso)
  const id = identifier.trim().replace(/\s+/g, ' ');
  if (id.length <= 200) return id;
  return id.slice(0, 200);
}

// --- FALLBACK EM MEMÓRIA (dev ou ausência de Upstash) ---
class MemoryLimiter implements Limiter {
  private tokens = new Map<string, { count: number; expiresAt: number; lastSeenAt: number }>();
  private windowMs: number;
  private maxRequests: number;
  private maxKeys: number;
  private cleanupEveryMs: number;
  private lastCleanupAt = 0;

  constructor(
    maxRequests: number,
    windowSeconds: number,
    opts?: { maxKeys?: number; cleanupEverySeconds?: number }
  ) {
    this.windowMs = Math.max(1, windowSeconds) * 1000;
    this.maxRequests = Math.max(1, Math.trunc(maxRequests));
    this.maxKeys = Math.max(1000, Math.trunc(opts?.maxKeys ?? 10_000));
    this.cleanupEveryMs = Math.max(5, Math.trunc(opts?.cleanupEverySeconds ?? 60)) * 1000;
  }

  private cleanup(now: number) {
    // remove expirados
    for (const [k, v] of this.tokens) {
      if (now > v.expiresAt) this.tokens.delete(k);
    }

    // limita crescimento
    if (this.tokens.size <= this.maxKeys) return;

    // prune simples por LRU (lastSeenAt asc)
    const entries = Array.from(this.tokens.entries());
    entries.sort((a, b) => a[1].lastSeenAt - b[1].lastSeenAt);

    const toRemove = this.tokens.size - this.maxKeys;
    for (let i = 0; i < toRemove; i++) {
      this.tokens.delete(entries[i]![0]);
    }
  }

  async limit(identifier: string): Promise<LimitResult> {
    const now = Date.now();
    if (now - this.lastCleanupAt > this.cleanupEveryMs) {
      this.cleanup(now);
      this.lastCleanupAt = now;
    }

    const key = normalizeIdentifier(identifier);
    const record = this.tokens.get(key);

    if (!record || now > record.expiresAt) {
      const expiresAt = now + this.windowMs;
      this.tokens.set(key, { count: 1, expiresAt, lastSeenAt: now });
      return { success: true, limit: this.maxRequests, remaining: this.maxRequests - 1, reset: expiresAt };
    }

    record.lastSeenAt = now;

    if (record.count >= this.maxRequests) {
      return { success: false, limit: this.maxRequests, remaining: 0, reset: record.expiresAt };
    }

    record.count++;
    return {
      success: true,
      limit: this.maxRequests,
      remaining: Math.max(0, this.maxRequests - record.count),
      reset: record.expiresAt,
    };
  }
}

// --- FACTORY ---
function createLimiter(
  requests: number,
  windowDuration: `${number} ${'s' | 'm' | 'h' | 'd'}`,
  prefix: string
): Limiter {
  const hasUpstash = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

  if (hasUpstash) {
    const redis = Redis.fromEnv();
    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(requests, windowDuration),
      analytics: true,
      prefix,
    });

    // Wrapper para normalizar IDs e manter a assinatura do fallback.
    return {
      limit: async (identifier: string) => {
        const id = normalizeIdentifier(identifier);
        // O tipo real inclui campos extras (ex: pending). Mantemos compatível.
        return (await limiter.limit(id)) as unknown as LimitResult;
      },
    };
  }

  // FALLBACK LOCAL
  if (process.env.NODE_ENV === 'production') {
    // Em serverless/multi-region, fallback local perde efetividade (cada instância tem sua memória).
    // Mantemos um alerta bem visível pra não passar despercebido.
    console.warn(
      `⚠️ ALERTA DE SEGURANÇA: Upstash não configurado para ${prefix}. ` +
        `Rate limit operando em fallback local (menos efetivo em produção).`
    );
  }

  const windowSeconds = parseWindowSeconds(windowDuration);
  return new MemoryLimiter(requests, windowSeconds, {
    // Em produção, reduz risco de DoS por growth de keys.
    maxKeys: process.env.NODE_ENV === 'production' ? 50_000 : 10_000,
    cleanupEverySeconds: 60,
  });
}

// --- EXPORTAÇÃO DOS LIMITADORES ---

// 1) Limite RÍGIDO (Login, Register, Alterar Senha)
// Regra: 5 tentativas a cada 30 minutos (Proteção contra Brute Force)
export const authRateLimit = createLimiter(5, '10 m', 'simmula_auth_std');

// 2) Limite ESTRITO para OTP (Verify email / Recuperar Senha)
// Regra: 3 tentativas a cada 10 minutos (Alta segurança para códigos)
export const otpRateLimit = createLimiter(3, '10 m', 'simmula_otp_strict');

// 3) Limite LEVE (Para CSRF e Navegação) - ✅ NOVO
// Regra: 15 requisições a cada 15 segundos.
// Permite navegação rápida do usuário legítimo, mas bloqueia bots/scrapers agressivos.
export const csrfRateLimit = createLimiter(50, '20 s', 'simmula_csrf_nav');

// 4) Limite para Favoritar Questões (Evitar spam de cliques)
// Regra: 25 requisições a cada 15 segundos
export const favoriteRateLimit = createLimiter(30, '15 s', 'simmula_favorite_nav');

// 5) Limite para Operações Caras (Uploads, Geração IA, Ranking)
// Regra: 45 requisições a cada 10 minutos (Proteção de recursos/custo)
export const expensiveOpsRateLimit = createLimiter(45, '10 m', 'simmula_ops_expensive');

// 6) Limite para as requisições em api/admin/options
export const apiRateLimit = createLimiter(15, '2 m', 'simmula_adm_options');

// ✅ NOVO: Admin Content Operations
// Otimizado para fluxo de trabalho intenso de criação/edição por usuários confiáveis (Admins/Professores).
// Permite 60 requisições de salvamento por minuto (1 por segundo em média).
export const adminContentRateLimit = createLimiter(60, '60 s', 'admin-content');