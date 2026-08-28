// app/api/cron/manutencao-diaria/route.ts

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);

  if (aa.length !== bb.length) {
    return false;
  }

  return crypto.timingSafeEqual(aa, bb);
}

function requireCronAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return false;
  }

  const auth = req.headers.get("authorization");

  const bearer = auth?.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";

  const headerSecret = (req.headers.get("x-cron-secret") ?? "").trim();

  const token = bearer || headerSecret;

  return token.length > 0 && safeEqual(token, secret);
}

type MaintenanceResult = {
  ok: boolean;
  status?: number;
  data?: unknown;
  error?: string;
};

async function executeInternalCron(
  url: URL,
  secret: string,
): Promise<MaintenanceResult> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secret}`,
      },
      cache: "no-store",
    });

    let data: unknown = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const timestamp = new Date().toISOString();

  // ---------------------------------------------------------
  // 1. AUTENTICAÇÃO
  // ---------------------------------------------------------

  if (!requireCronAuth(req)) {
    console.warn("[cron/manutencao-diaria] Requisição não autorizada", {
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

  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return noStoreJson(
      {
        ok: false,
        error: "CRON_SECRET não configurado",
        timestamp,
      },
      { status: 500 },
    );
  }

  // Utiliza o mesmo host da requisição atual.
  const cleanupUrl = new URL("/api/cron/cleanup-audit", req.url);

  const rankingUrl = new URL("/api/cron/ranking-snapshot", req.url);

  // ---------------------------------------------------------
  // 2. CLEANUP / AUDITORIA
  // ---------------------------------------------------------

  const cleanup = await executeInternalCron(cleanupUrl, secret);

  // ---------------------------------------------------------
  // 3. RANKING SNAPSHOT
  //
  // Executa mesmo se o cleanup tiver falhado.
  // Assim uma rotina não impede a outra.
  // ---------------------------------------------------------

  const ranking = await executeInternalCron(rankingUrl, secret);

  // ---------------------------------------------------------
  // 4. RESULTADO CONSOLIDADO
  // ---------------------------------------------------------

  const success = cleanup.ok && ranking.ok;

  const durationMs = Date.now() - startedAt;

  if (success) {
    console.log("[cron/manutencao-diaria] SUCESSO", {
      timestamp,
      cleanupStatus: cleanup.status,
      rankingStatus: ranking.status,
      durationMs,
    });

    return noStoreJson(
      {
        ok: true,

        maintenance: {
          cleanup,
          ranking,
        },

        durationMs,
        timestamp,
      },
      { status: 200 },
    );
  }

  console.error("[cron/manutencao-diaria] FALHA", {
    timestamp,
    cleanup,
    ranking,
    durationMs,
  });

  /*
   * Retornamos 500 se qualquer uma das duas rotinas falhar.
   *
   * Importante:
   * mesmo assim ambas já foram tentadas.
   */
  return noStoreJson(
    {
      ok: false,

      error: "Uma ou mais etapas da manutenção falharam",

      maintenance: {
        cleanup,
        ranking,
      },

      durationMs,
      timestamp,
    },
    { status: 500 },
  );
}
