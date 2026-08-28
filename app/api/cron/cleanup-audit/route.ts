// app/api/cron/cleanup-audit/route.ts

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

import { prisma } from "@/lib/prisma";
import { registrarLog, AuditAction } from "@/lib/audit";
import { authRateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RETENTION_DAYS = 90;

/**
 * Evita cache da resposta do cron.
 */
function noStoreJson(data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);

  res.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");

  return res;
}

/**
 * Obtém o IP da chamada para rate limit/auditoria.
 */
function getClientIpFromHeaders(h: Headers): string {
  const xff = h.get("x-forwarded-for");

  if (xff) {
    return xff.split(",")[0]?.trim() || "127.0.0.1";
  }

  return h.get("x-real-ip") ?? "127.0.0.1";
}

/**
 * Comparação segura do CRON_SECRET.
 */
function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);

  if (aa.length !== bb.length) {
    return false;
  }

  return crypto.timingSafeEqual(aa, bb);
}

/**
 * Autoriza a execução do Cron.
 */
function requireCronAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;

  // Fail closed:
  // sem CRON_SECRET configurado, ninguém executa a manutenção.
  if (!secret) {
    return false;
  }

  const auth = req.headers.get("authorization");

  const bearer = auth?.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";

  // Mantido como fallback para eventual teste manual.
  const headerSecret = (req.headers.get("x-cron-secret") ?? "").trim();

  const token = bearer || headerSecret;

  return token.length > 0 && safeEqual(token, secret);
}

/**
 * Manutenção periódica do banco.
 *
 * Responsabilidades:
 *
 * 1. Excluir tokens expirados da blacklist.
 * 2. Excluir logs de auditoria anteriores à política
 *    de retenção definida em RETENTION_DAYS.
 *
 * As duas exclusões são executadas em uma transação.
 */
export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const timestamp = new Date().toISOString();

  try {
    // ---------------------------------------------------------
    // 1. AUTENTICAÇÃO
    // ---------------------------------------------------------

    if (!requireCronAuth(req)) {
      console.warn("[cron/cleanup-audit] Requisição não autorizada", {
        timestamp,
      });

      return noStoreJson(
        {
          ok: false,
          error: "Não autorizado",
          timestamp,
        },
        { status: 401 },
      );
    }

    // ---------------------------------------------------------
    // 2. RATE LIMIT
    // ---------------------------------------------------------

    const ip = getClientIpFromHeaders(req.headers);

    const rlKey = `cron:cleanup-audit:${ip}`;

    const rl = await authRateLimit.limit(rlKey);

    if (!rl.success) {
      console.warn("[cron/cleanup-audit] Rate limit atingido", {
        timestamp,
        ip,
      });

      return noStoreJson(
        {
          ok: false,
          error: "Muitas requisições.",
          timestamp,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(rl.limit),
            "X-RateLimit-Remaining": String(rl.remaining),
            "X-RateLimit-Reset": String(rl.reset),
          },
        },
      );
    }

    // ---------------------------------------------------------
    // 3. DEFINIÇÃO DOS LIMITES
    // ---------------------------------------------------------

    const now = new Date();

    const auditThreshold = new Date(
      now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );

    // ---------------------------------------------------------
    // 4. LIMPEZA ATÔMICA
    // ---------------------------------------------------------

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

    // ---------------------------------------------------------
    // 5. REGISTRO DA PRÓPRIA MANUTENÇÃO
    // ---------------------------------------------------------

    /*
     * Mantemos AuditAction.CLEANUP_BLACKLIST propositalmente.
     *
     * Alterar o enum agora poderia exigir mudanças em outros
     * arquivos/Prisma e não existe necessidade funcional para isso.
     */
    await registrarLog({
      acao: AuditAction.CLEANUP_BLACKLIST,
      usuarioId: undefined,
      usuarioNome: "System Cron",
      ip,
      userAgent: req.headers.get("user-agent") || undefined,

      detalhes: {
        evento: "Manutenção automática do banco",
        deletedBlacklist: blacklistCleanup.count,
        deletedAuditLogs: auditCleanup.count,
        retentionDays: RETENTION_DAYS,
      },
    }).catch((auditError) => {
      /*
       * Falha ao registrar o log secundário não desfaz
       * uma limpeza que já foi executada corretamente.
       */
      console.error(
        "[cron/cleanup-audit] Falha ao registrar auditoria da execução:",
        auditError instanceof Error ? auditError.message : String(auditError),
      );
    });

    // ---------------------------------------------------------
    // 6. SUCESSO
    // ---------------------------------------------------------

    const durationMs = Date.now() - startedAt;

    console.log("[cron/cleanup-audit] SUCESSO", {
      timestamp,
      deletedBlacklist: blacklistCleanup.count,
      deletedAuditLogs: auditCleanup.count,
      retentionDays: RETENTION_DAYS,
      durationMs,
    });

    return noStoreJson(
      {
        ok: true,

        cleanup: {
          deletedBlacklist: blacklistCleanup.count,

          deletedAuditLogs: auditCleanup.count,

          retentionDays: RETENTION_DAYS,
        },

        durationMs,
        timestamp,
      },
      { status: 200 },
    );
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error("[cron/cleanup-audit] FALHA", {
      timestamp,
      durationMs,
      error: errorMessage,
    });

    return noStoreJson(
      {
        ok: false,
        error: "Falha na execução da manutenção",
        durationMs,
        timestamp,
      },
      { status: 500 },
    );
  }
}
