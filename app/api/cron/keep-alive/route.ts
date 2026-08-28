// app/api/cron/keep-alive/route.ts

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Impede cache da resposta do cron.
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
 * Comparação segura do CRON_SECRET.
 */
function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);

  if (aa.length !== bb.length) return false;

  return crypto.timingSafeEqual(aa, bb);
}

/**
 * Autoriza somente chamadas que possuam o CRON_SECRET correto.
 *
 * A Vercel envia:
 * Authorization: Bearer <CRON_SECRET>
 *
 * Mantemos também x-cron-secret como fallback para testes manuais.
 */
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

/**
 * Keep Alive do Supabase
 *
 * Objetivos:
 * 1. Confirmar comunicação real com o PostgreSQL via Prisma.
 * 2. Confirmar comunicação real com a API/Storage do Supabase.
 * 3. NÃO retornar HTTP 200 se alguma etapa não tiver sido executada.
 * 4. Gerar logs claros para diagnóstico na Vercel.
 */
export async function GET(req: NextRequest) {
  const startedAt = Date.now();
  const timestamp = new Date().toISOString();

  // ---------------------------------------------------------
  // 1. AUTENTICAÇÃO
  // ---------------------------------------------------------

  if (!requireCronAuth(req)) {
    console.warn("[cron/keep-alive] Requisição não autorizada", {
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

  try {
    // ---------------------------------------------------------
    // 2. VALIDAÇÃO DAS VARIÁVEIS DO SUPABASE
    // ---------------------------------------------------------

    const supabaseUrl =
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    /*
     * IMPORTANTE:
     *
     * Na versão anterior, se essas variáveis não existissem,
     * o código simplesmente pulava o Storage e retornava 200.
     *
     * Agora isso é considerado falha real.
     */
    if (!supabaseUrl) {
      throw new Error("SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL não configurada");
    }

    if (!supabaseKey) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY não configurada",
      );
    }

    // ---------------------------------------------------------
    // 3. PING REAL NO POSTGRESQL VIA PRISMA
    // ---------------------------------------------------------

    const dbStartedAt = Date.now();

    const dbResult = await prisma.$queryRaw<Array<{ ok: number }>>`
      SELECT 1::int AS ok
    `;

    /*
     * Não basta a Promise resolver.
     * Validamos também a resposta do PostgreSQL.
     */
    if (!dbResult || dbResult[0]?.ok !== 1) {
      throw new Error(
        "O PostgreSQL respondeu, mas o resultado do health check foi inválido",
      );
    }

    const dbDurationMs = Date.now() - dbStartedAt;

    // ---------------------------------------------------------
    // 4. PING REAL NA API DO SUPABASE / STORAGE
    // ---------------------------------------------------------

    const storageStartedAt = Date.now();

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { error: storageError } = await supabase.storage
      .from("simmulaquiz-perfis")
      .list("", {
        limit: 1,
      });

    /*
     * Este é um dos pontos principais da correção.
     *
     * Supabase normalmente devolve:
     *
     * { data, error }
     *
     * Um "error" não necessariamente lança exceção sozinho.
     *
     * Portanto precisamos verificar explicitamente.
     */
    if (storageError) {
      throw new Error(`Falha no Supabase Storage: ${storageError.message}`);
    }

    const storageDurationMs = Date.now() - storageStartedAt;

    // ---------------------------------------------------------
    // 5. SUCESSO REAL
    // ---------------------------------------------------------

    const durationMs = Date.now() - startedAt;

    console.log("[cron/keep-alive] SUCESSO", {
      timestamp,
      database: "ok",
      storage: "ok",
      dbDurationMs,
      storageDurationMs,
      durationMs,
    });

    return noStoreJson(
      {
        ok: true,

        message: "Keep-alive executado e validado com sucesso.",

        checks: {
          database: {
            ok: true,
            durationMs: dbDurationMs,
          },

          supabaseStorage: {
            ok: true,
            durationMs: storageDurationMs,
          },
        },

        durationMs,
        timestamp,
      },
      { status: 200 },
    );
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error("[cron/keep-alive] FALHA", {
      timestamp,
      durationMs,
      error: errorMessage,
    });

    return noStoreJson(
      {
        ok: false,
        error: "Falha ao executar o keep-alive",
        durationMs,
        timestamp,
      },
      { status: 500 },
    );
  }
}
