// app/api/estudante/caderno-erros/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { csrfRateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getClientIp(req: NextRequest) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const xrip = req.headers.get("x-real-ip")?.trim();
  return xrip || "127.0.0.1";
}

function noStoreJson(data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  res.headers.set("Vary", "Cookie");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "same-origin");
  return res;
}

// Validação de query params (blindagem + evita NaN/abuso)
const QuerySchema = z.object({
  ucId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.coerce.number().int().positive().optional(),
});

export async function GET(req: NextRequest) {
  // ✅ Auth
  const sessao = await getSession();
  if (!sessao?.sub) {
    return noStoreJson({ error: "Não autorizado" }, { status: 401 });
  }

  const usuarioId = Number(sessao.sub);
  if (!Number.isFinite(usuarioId) || usuarioId <= 0) {
    return noStoreJson({ error: "Sessão inválida" }, { status: 401 });
  }

  // ✅ Rate-limit (padrão do projeto)
  const ip = getClientIp(req);
  const rlKey = `caderno-erros:listar:${ip}:${usuarioId}`;
  const rl = await csrfRateLimit.limit(rlKey);

  if (!rl.success) {
    const res = noStoreJson(
      { error: "Muitas requisições. Aguarde e tente novamente." },
      { status: 429 }
    );

    // se seu limiter fornece esses campos, ótimo
    if ((rl as any).limit != null) res.headers.set("X-RateLimit-Limit", String((rl as any).limit));
    if ((rl as any).remaining != null) res.headers.set("X-RateLimit-Remaining", String((rl as any).remaining));
    if ((rl as any).reset != null) res.headers.set("X-RateLimit-Reset", String((rl as any).reset));

    return res;
  }

  // ✅ Query params validation
  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    ucId: searchParams.get("ucId") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    cursor: searchParams.get("cursor") ?? undefined,
  });

  if (!parsed.success) {
    return noStoreJson(
      { error: "Parâmetros inválidos", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { ucId, limit, cursor } = parsed.data;

  try {
    const erros = await prisma.questaoErro.findMany({
      where: {
        usuarioId,
        revisada: false,
        ...(cursor ? { id: { lt: cursor } } : {}),
        ...(ucId
          ? {
              questao: {
                // formato compatível para relação 1 (QuestaoErro -> Questao)
                is: { unidadeCurricularId: ucId },
              },
            }
          : {}),
      },
      orderBy: { id: "desc" },
      take: limit,
      select: {
        id: true,
        questaoId: true,
        vezesErrada: true,
        ultimoErro: true,
        revisada: true,
        proximaRevisao: true,
        questao: {
          select: {
            id: true,
            enunciado: true,
            dificuldade: true,
            nivelCognitivo: true,
            unidadeCurricular: { select: { id: true, nome: true } },
            imagens: {
              select: { url: true, filename: true, width: true, height: true },
            },
          },
        },
      },
    });

    const nextCursor = erros.length > 0 ? erros[erros.length - 1].id : null;

    return noStoreJson({
      items: erros,
      nextCursor,
      limit,
      filtro: { ucId: ucId ?? null },
    });
  } catch (error) {
    console.error(
      "Erro em /api/estudante/caderno-erros:",
      error instanceof Error ? error.message : String(error)
    );
    return noStoreJson({ error: "Erro ao carregar caderno de erros" }, { status: 500 });
  }
}
