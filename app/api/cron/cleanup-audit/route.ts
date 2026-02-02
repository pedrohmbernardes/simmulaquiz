// app/api/cron/cleanup-blacklist/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

import { prisma } from '@/lib/prisma';
import { registrarLog } from '@/lib/audit';
import { authRateLimit } from '@/lib/ratelimit';
import { AuditAction } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function noStoreJson(data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.headers.set('Pragma', 'no-cache');
  res.headers.set('Expires', '0');
  return res;
}

function getClientIpFromHeaders(h: Headers): string {
  const xff = h.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() || '127.0.0.1';
  return h.get('x-real-ip') ?? '127.0.0.1';
}

function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function requireCronAuth(req: NextRequest): boolean {
  // A Vercel injeta o valor dessa env var no header Authorization como "Bearer <valor>".
  // Se não estiver configurado, bloqueia por segurança.
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = req.headers.get('authorization');
  const bearer = auth?.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  const headerSecret = (req.headers.get('x-cron-secret') ?? '').trim();

  const token = bearer || headerSecret;
  return token.length > 0 && safeEqual(token, secret);
}

export async function GET(req: NextRequest) {
  try {
    // 0) Auth do cron
    if (!requireCronAuth(req)) {
      return noStoreJson({ error: 'Não autorizado' }, { status: 401 });
    }

    // 1) Rate-limit (bem leve; só serve como “cinto” caso o secret vaze)
    const ip = getClientIpFromHeaders(req.headers);
    const rlKey = `cron:cleanup-blacklist:${ip}`;
    const rl = await authRateLimit.limit(rlKey);

    if (!rl.success) {
      return noStoreJson(
        { error: 'Muitas requisições.' },
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

    const now = new Date();

    // Retenção de auditoria (ajuste conforme sua política)
    const RETENTION_DAYS = 90;
    const auditThreshold = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

    // 2) Limpeza (idempotente)
    const [blacklistCleanup, auditCleanup] = await prisma.$transaction([
      prisma.tokenBlacklist.deleteMany({
        where: {
          expiresAt: {
            lt: now,
          },
        },
      }),
      prisma.logAuditoria.deleteMany({
        where: {
          createdAt: {
            lt: auditThreshold,
          },
        },
      }),
    ]);

    // 3) Auditoria do próprio cron
    await registrarLog({
      acao: AuditAction.CLEANUP_BLACKLIST,
      usuarioId: undefined,
      usuarioNome: 'System Cron',
      ip,
      userAgent: req.headers.get('user-agent') || undefined,
      detalhes: {
        deletedBlacklist: blacklistCleanup.count,
        deletedAuditLogs: auditCleanup.count,
        retentionDays: RETENTION_DAYS,
      },
    }).catch(() => {
      // não falha o cron por erro secundário de auditoria
    });

    return noStoreJson(
      {
        ok: true,
        deletedBlacklist: blacklistCleanup.count,
        deletedAuditLogs: auditCleanup.count,
        retentionDays: RETENTION_DAYS,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erro em cron/cleanup-audit:", error instanceof Error ? error.message : String(error));
    return noStoreJson({ error: 'Erro interno' }, { status: 500 });
  }
}