// app/api/simulados/[id]/analise/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { registrarLog, AuditAction } from "@/lib/audit";
import { csrfRateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStoreJson(data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  // Headers agressivos para evitar cache de respostas antigas (útil em dev/testes)
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  res.headers.set("Surrogate-Control", "no-store");
  return res;
}

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function getUserIdFromSession(session: unknown): number | null {
  const s = session as any;
  const candidate = s?.sub ?? s?.userId ?? s?.usuarioId ?? s?.id;
  const n = Number(candidate);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function parsePositiveInt(v: string): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null;
  return n;
}

// -----------------------------
// Compat / Normalização (somente no retorno)
// -----------------------------
function stripAccents(s: string) {
  try {
    return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  } catch {
    return s;
  }
}

type CanonDificuldade = "MUITO_FACIL" | "FACIL" | "MEDIO" | "DIFICIL" | "MUITO_DIFICIL" | "N/A";

function normalizeDificuldade(raw: unknown): CanonDificuldade {
  const txt = String(raw ?? "").trim();
  if (!txt) return "N/A";

  const k = stripAccents(txt)
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_");

  if (k.includes("muito") && k.includes("facil")) return "MUITO_FACIL";
  if (k === "facil") return "FACIL";
  if (k === "medio" || k === "media") return "MEDIO";
  if (k === "dificil") return "DIFICIL";
  if (k.includes("muito") && k.includes("dificil")) return "MUITO_DIFICIL";

  return "N/A";
}

function coerceNumber(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeMetricasResumo(metricasResumo: any) {
  if (!metricasResumo || typeof metricasResumo !== "object") return metricasResumo;

  const mr = metricasResumo;

  // --- simulado: compatibilidade de chaves ---
  if (mr.simulado && typeof mr.simulado === "object") {
    const s = mr.simulado;

    // se veio "nota", espelha em "notaPercentual" (mantém ambos)
    if (s.notaPercentual == null && s.nota != null) {
      s.notaPercentual = s.nota;
    }

    // se não veio tempoMedioSeg, tenta tempoMedioGlobalSeg
    if (s.tempoMedioSeg == null && s.tempoMedioGlobalSeg != null) {
      s.tempoMedioSeg = s.tempoMedioGlobalSeg;
    }

    // percentual cru (se faltar)
    const total = coerceNumber(s.total);
    const acertos = coerceNumber(s.acertos);

    if (s.percentualCru == null && total != null && total > 0 && acertos != null && acertos >= 0) {
      s.percentualCru = Number(((acertos / total) * 100).toFixed(1));
    }
  }

  // --- dificuldade: normaliza "Muito Fácil" -> "MUITO_FACIL" etc (sem alterar o banco) ---
  if (Array.isArray(mr.dificuldade)) {
    const merged = new Map<string, any>();

    for (const item of mr.dificuldade) {
      if (!item || typeof item !== "object") continue;
      const chaveNorm = normalizeDificuldade(item.chave);

      const prev = merged.get(chaveNorm);
      if (!prev) {
        merged.set(chaveNorm, { ...item, chave: chaveNorm });
        continue;
      }

      // merge conservador (soma totais/contagens/tempos)
      prev.total = Number(prev.total ?? 0) + Number(item.total ?? 0);
      prev.acertos = Number(prev.acertos ?? 0) + Number(item.acertos ?? 0);
      prev.erros = Number(prev.erros ?? 0) + Number(item.erros ?? 0);
      prev.naoRespondidas = Number(prev.naoRespondidas ?? 0) + Number(item.naoRespondidas ?? 0);
      // soma tempos se existirem (para recálculo)
      const tPrev = coerceNumber(prev.tempoMedioSeg);
      const tItem = coerceNumber(item.tempoMedioSeg);

      // Se ambos têm tempo médio, é difícil recompor somaTempo. Então, mantemos o que existir.
      // (Como é apenas para UI, preferimos NÃO inventar.)
      if (tPrev == null && tItem != null) prev.tempoMedioSeg = tItem;

      // recalc acuracia se possível
      const respondidas = Number(prev.total ?? 0) - Number(prev.naoRespondidas ?? 0);
      prev.respondidas = respondidas;
      prev.acuracia = respondidas > 0 ? Number(prev.acertos ?? 0) / respondidas : 0;

      merged.set(chaveNorm, prev);
    }

    const order = ["MUITO_FACIL", "FACIL", "MEDIO", "DIFICIL", "MUITO_DIFICIL", "N/A"];
    mr.dificuldade = Array.from(merged.values()).sort((a, b) => {
      const ia = order.indexOf(a.chave);
      const ib = order.indexOf(b.chave);
      if (ia !== -1 && ib !== -1) return ia - ib;
      return String(a.chave).localeCompare(String(b.chave));
    });
  }

  return mr;
}

export async function GET(
  req: NextRequest,
  // Ajuste para Next.js 15+ onde params é Promise, mantendo compatibilidade com 14
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  const session: any = await getSession();
  if (!session) return noStoreJson({ error: "Não autorizado" }, { status: 401 });

  const userId = getUserIdFromSession(session);
  if (!userId) return noStoreJson({ error: "Sessão inválida" }, { status: 401 });

  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent") || undefined;

  // Rate limit de leitura (proteção contra scraping de análises)
  const rl = await csrfRateLimit.limit(`simulado-analise:get:${userId}:${ip}`);
  if (!rl.success) {
    return noStoreJson({ error: "Muitas requisições. Aguarde alguns instantes." }, { status: 429 });
  }

  // Tratamento híbrido para params (Promise ou Objeto)
  const params = await ctx.params;
  const { id } = params;
  const simuladoId = parsePositiveInt(id);

  if (!simuladoId) {
    return noStoreJson({ error: "ID inválido" }, { status: 400 });
  }

  try {
    // Busca a avaliação garantindo que o simulado pertence ao usuário
    const avaliacao = await prisma.avaliacaoSimulado.findFirst({
      where: {
        simuladoId,
        simulado: { usuarioId: userId },
      },
      select: {
        id: true,
        simuladoId: true,
        feedbackGeral: true,
        pontosFortes: true,
        pontosFracos: true,
        recomendacoes: true,

        // Dados fundamentais para os gráficos
        metricasResumo: true,

        // Metadados técnicos
        modeloIA: true,
        tokensTotal: true,
        createdAt: true,
      },
    });

    if (!avaliacao) {
      // Verificação de segurança silenciosa (IDOR check)
      // Se o simulado existe mas não é do usuário, logamos a tentativa
      const simuladoExiste = await prisma.simulado.findUnique({
        where: { id: simuladoId },
        select: { id: true, usuarioId: true },
      });

      if (simuladoExiste && simuladoExiste.usuarioId !== userId) {
        await registrarLog({
          acao: AuditAction.SEGURANCA_IDOR_TENTATIVA,
          usuarioId: userId,
          usuarioNome: session.name,
          recurso: "/api/simulados/[id]/analise",
          ip,
          userAgent,
          detalhes: { alvo: simuladoId },
        }).catch(() => {});
      }

      // Retorna 404 padrão (não revela se o simulado existe ou não para terceiros)
      return noStoreJson({ error: "Análise não encontrada." }, { status: 404 });
    }

    // ✅ Normaliza apenas o payload retornado (não altera DB)
    const normalized = {
      ...avaliacao,
      metricasResumo: normalizeMetricasResumo(avaliacao.metricasResumo as any),
    };

    return noStoreJson({ ok: true, avaliacao: normalized }, { status: 200 });
  } catch (error) {
    console.error("Erro em simulados/[id]/analise:", error instanceof Error ? error.message : String(error));
    return noStoreJson({ error: "Erro ao buscar análise." }, { status: 500 });
  }
}
