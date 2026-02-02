// app/api/estudante/caderno-erros/revisar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { csrfRateLimit } from "@/lib/ratelimit";
import { verifyCSRFToken } from "@/lib/csrf";
import { registrarLog, AuditAction } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getClientIpFromHeaders(h: Headers): string {
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "127.0.0.1";
  return h.get("x-real-ip") ?? "127.0.0.1";
}

function getUserIdFromSession(session: unknown): number | null {
  const s = session as any;
  const candidate = s?.sub ?? s?.userId ?? s?.usuarioId ?? s?.id;
  const n = Number(candidate);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

const RevisarSchema = z.object({
  questaoId: z.number().int().positive(),
  alternativaMarcada: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .transform((v) => v.toLowerCase())
    .refine((v) => /[abcde]/.test(v), "Alternativa inválida"),
});

function normalizeAlt(v: unknown): "a" | "b" | "c" | "d" | "e" | null {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  const m = s.match(/[abcde]/);
  return (m?.[0] as any) ?? null;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export async function POST(request: NextRequest) {
  // ✅ Auth
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
  }

  const userId = getUserIdFromSession(session);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Sessão inválida" }, { status: 401 });
  }

  // ✅ Rate-limit
  const ip = getClientIpFromHeaders(request.headers);
  const rlKey = `caderno_revisar:${userId}:${ip}`;
  const rl = await csrfRateLimit.limit(rlKey);

  if (!rl.success) {
    return NextResponse.json(
      { ok: false, error: "Muitas requisições. Tente novamente em instantes." },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(rl.limit),
          "X-RateLimit-Remaining": String(rl.remaining),
          "X-RateLimit-Reset": String(rl.reset),
          "Cache-Control": "no-store",
        },
      }
    );
  }

  // ✅ CSRF obrigatório (POST)
  const csrfHeader = request.headers.get("x-csrf-token") || "";
  const csrfOk = await verifyCSRFToken(csrfHeader);
  if (!csrfOk) {
    const acao = ((AuditAction as any)?.SISTEMA_ERRO ?? "SISTEMA_ERRO") as any;
    try {
      await registrarLog({
        acao,
        usuarioId: userId,
        usuarioNome: (session as any)?.name ?? null,
        detalhes: { motivo: "CSRF inválido (POST caderno revisar)", ip },
      });
    } catch {}
    return NextResponse.json({ ok: false, error: "CSRF inválido" }, { status: 403 });
  }

  // ✅ Body + validação
  let raw: unknown = null;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const parsed = RevisarSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Dados inválidos", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { questaoId, alternativaMarcada } = parsed.data;
  const altMarcada = normalizeAlt(alternativaMarcada);
  if (!altMarcada) {
    return NextResponse.json({ ok: false, error: "Alternativa inválida" }, { status: 400 });
  }

  // ✅ IDOR: só permite revisar se a questão estiver no caderno do próprio usuário
  const qe = await prisma.questaoErro.findFirst({
    where: { usuarioId: userId, questaoId },
    select: { id: true, vezesErrada: true, revisada: true },
  });

  if (!qe) {
    // não entrega informação (evita enumeração)
    return NextResponse.json({ ok: false, error: "Questão não encontrada" }, { status: 404 });
  }

  // Busca gabarito (sem vazar)
  const questao = await prisma.questao.findFirst({
    where: { id: questaoId, ativa: true },
    select: {
      id: true,
      alternativaCorreta: true,
      alternativaA: true,
      alternativaB: true,
      alternativaC: true,
      alternativaD: true,
      alternativaE: true,
    },
  });

  if (!questao) {
    return NextResponse.json({ ok: false, error: "Questão não encontrada" }, { status: 404 });
  }

  // ✅ Julgamento robusto
  const altCorreta = normalizeAlt(questao.alternativaCorreta);
  let correta = false;

  if (altCorreta) {
    correta = altMarcada === altCorreta;
  } else {
    // fallback: se alguém gravou "alternativaA" / texto completo etc.
    const g = String(questao.alternativaCorreta ?? "").trim().toLowerCase();
    const mapaTexto: Record<"a" | "b" | "c" | "d" | "e", string> = {
      a: String(questao.alternativaA).trim().toLowerCase(),
      b: String(questao.alternativaB).trim().toLowerCase(),
      c: String(questao.alternativaC).trim().toLowerCase(),
      d: String(questao.alternativaD).trim().toLowerCase(),
      e: String(questao.alternativaE).trim().toLowerCase(),
    };

    if (/(alternativa\s*)?a/.test(g)) correta = altMarcada === "a";
    else if (/(alternativa\s*)?b/.test(g)) correta = altMarcada === "b";
    else if (/(alternativa\s*)?c/.test(g)) correta = altMarcada === "c";
    else if (/(alternativa\s*)?d/.test(g)) correta = altMarcada === "d";
    else if (/(alternativa\s*)?e/.test(g)) correta = altMarcada === "e";
    else correta = mapaTexto[altMarcada] === g;
  }

  // ✅ Persistência (tentativa + atualização do caderno)
  const now = new Date();
  const origem = "CADERNO_ERROS";

  // regra simples de próxima revisão ao acertar:
  // quanto mais você errou no passado, mais cedo revisa de novo
  const dias =
    qe.vezesErrada >= 3 ? 1 : qe.vezesErrada === 2 ? 3 : 7;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.questaoTentativa.create({
        data: {
          usuarioId: userId,
          questaoId,
          alternativaMarcada: altMarcada,
          correta,
          origem,
        },
      });

      if (correta) {
        await tx.questaoErro.update({
          where: { usuarioId_questaoId: { usuarioId: userId, questaoId } },
          data: {
            revisada: true,
            proximaRevisao: addDays(now, dias),
          },
        });
      } else {
        await tx.questaoErro.update({
          where: { usuarioId_questaoId: { usuarioId: userId, questaoId } },
          data: {
            vezesErrada: { increment: 1 },
            ultimoErro: now,
            revisada: false,
            proximaRevisao: null,
          },
        });
      }
    });
  } catch (e) {
    const acao = ((AuditAction as any)?.SISTEMA_ERRO ?? "SISTEMA_ERRO") as any;
    try {
      await registrarLog({
        acao,
        usuarioId: userId,
        usuarioNome: (session as any)?.name ?? null,
        detalhes: { motivo: "Falha ao salvar revisão", questaoId, correta, ip },
      });
    } catch {}
    return NextResponse.json(
      { ok: false, error: "Erro ao processar revisão." },
      { status: 500 }
    );
  }

  // ✅ Auditoria (best-effort)
  const acaoOk = ((AuditAction as any)?.CADERNO_ERROS_REVISAR ?? "CADERNO_ERROS_REVISAR") as any;
  try {
    await registrarLog({
      acao: acaoOk,
      usuarioId: userId,
      usuarioNome: (session as any)?.name ?? null,
      detalhes: { questaoId, correta, ip },
    });
  } catch {}

  return NextResponse.json(
    { ok: true, correta, revisada: correta ? true : undefined },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "same-origin",
      },
    }
  );
}
