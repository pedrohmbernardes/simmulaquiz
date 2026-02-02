import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { Redis } from "@upstash/redis";
import OpenAI from "openai";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import crypto from "crypto";

import { registrarLog, AuditAction } from "@/lib/audit";
import { verifyCSRFToken } from "@/lib/csrf";
import { expensiveOpsRateLimit } from "@/lib/ratelimit";
import { sanitizeObject, sanitizeString } from "@/lib/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// --- CONFIG ---
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const redis = Redis.fromEnv();

const PROMPT_VERSION = 3;
const LOCK_TTL_SECONDS = 180;

// --- LIMITES ---
// Define o limite diário de análises por usuário (independente do cargo)
const LIMIT_ANALISE_DIARIA = 3;

// -----------------------------
// Helpers
// -----------------------------
function noStoreJson(data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  return res;
}

function getUserIdFromSession(session: unknown): number | null {
  const s = session as any;
  const candidate = s?.sub ?? s?.userId ?? s?.usuarioId ?? s?.id;
  const n = Number(candidate);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function getSaoPauloDay(): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function secondsUntilNextSaoPauloMidnight(): number {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);

    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
    const hh = Number(get("hour"));
    const mm = Number(get("minute"));
    const ss = Number(get("second"));

    const nowSec = hh * 3600 + mm * 60 + ss;
    let remaining = 24 * 3600 - nowSec;
    if (!Number.isFinite(remaining) || remaining <= 0) remaining = 60 * 5;
    if (remaining > 24 * 3600) remaining = 24 * 3600;
    return remaining;
  } catch {
    return 60 * 60 * 24;
  }
}

function normalizeKey(s: string): string {
  const cleaned = sanitizeString(String(s ?? "")).trim();
  if (!cleaned) return "Não informado";
  return cleaned.slice(0, 180);
}

// --- Normalização específica de dificuldade (para evitar mismatch e “0%”) ---
function stripAccents(s: string) {
  try {
    return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  } catch {
    return s;
  }
}

type CanonDificuldade = "MUITO_FACIL" | "FACIL" | "MEDIO" | "DIFICIL" | "MUITO_DIFICIL" | "N/A";

function normalizeDificuldade(raw: unknown): CanonDificuldade {
  const txt = sanitizeString(String(raw ?? "")).trim();
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

const PESOS_DIFICULDADE: Record<Exclude<CanonDificuldade, "N/A">, number> = {
  MUITO_FACIL: 0.75,
  FACIL: 1.0,
  MEDIO: 1.25,
  DIFICIL: 1.5,
  MUITO_DIFICIL: 1.75,
};

type Stat = {
  total: number;
  acertos: number;
  erros: number;
  naoRespondidas: number;
  somaTempo: number;
};

function emptyStat(): Stat {
  return { total: 0, acertos: 0, erros: 0, naoRespondidas: 0, somaTempo: 0 };
}

function addToStat(
  map: Map<string, Stat>,
  key: string,
  correta: boolean | null | undefined,
  tempoResposta: number | null | undefined
) {
  const k = normalizeKey(key);
  const cur = map.get(k) ?? emptyStat();

  cur.total += 1;

  if (tempoResposta != null && Number.isFinite(tempoResposta)) {
    cur.somaTempo += Number(tempoResposta);
  }

  if (correta === true) cur.acertos += 1;
  else if (correta === false) cur.erros += 1;
  else cur.naoRespondidas += 1;

  map.set(k, cur);
}

function finalizeStats(map: Map<string, Stat>) {
  const arr = Array.from(map.entries()).map(([chave, s]) => {
    const respondidas = s.total - s.naoRespondidas;
    const acuracia = respondidas > 0 ? s.acertos / respondidas : 0;
    const tempoMedio = respondidas > 0 ? s.somaTempo / respondidas : null;

    return {
      chave,
      total: s.total,
      respondidas,
      acertos: s.acertos,
      erros: s.erros,
      naoRespondidas: s.naoRespondidas,
      acuracia,
      tempoMedioSeg: tempoMedio,
    };
  });

  arr.sort((a, b) => b.total - a.total);
  return arr;
}

function getAllStats(items: ReturnType<typeof finalizeStats>) {
  return items.sort((a, b) => {
    const order = ["MUITO_FACIL", "FACIL", "MEDIO", "DIFICIL", "MUITO_DIFICIL"];
    const idxA = order.indexOf(a.chave);
    const idxB = order.indexOf(b.chave);
    if (idxA > -1 && idxB > -1) return idxA - idxB;
    return a.acuracia - b.acuracia;
  });
}

function pickTopBottom(
  items: ReturnType<typeof finalizeStats>,
  opts?: { minTotal?: number; topN?: number; bottomN?: number }
) {
  const minTotal = opts?.minTotal ?? 1;
  const topN = opts?.topN ?? 6;
  const bottomN = opts?.bottomN ?? 6;

  const filtered = items.filter((x) => x.total >= minTotal);
  const top = [...filtered].sort((a, b) => b.acuracia - a.acuracia).slice(0, topN);
  const bottom = [...filtered].sort((a, b) => a.acuracia - b.acuracia).slice(0, bottomN);

  return { top, bottom, amostraConsiderada: filtered.length };
}

function calcHashEntrada(metricasResumo: unknown): string {
  const json = JSON.stringify(metricasResumo);
  return crypto.createHash("sha256").update(json).digest("hex");
}

function randomLockValue(): string {
  return crypto.randomBytes(16).toString("hex");
}

const analiseSchema = z.object({
  simuladoId: z.coerce
    .number({ message: "ID do simulado deve ser um número válido" })
    .int()
    .positive("ID inválido"),
});

const iaSchema = z.object({
  feedbackGeral: z.string().min(80).max(1000),
  pontosFortes: z.string().optional().nullable(),
  pontosFracos: z.string().optional().nullable(),
  recomendacoes: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  let redisQuotaKey: string | null = null;
  let shouldRefundQuota = false;

  let lockKey: string | null = null;
  let lockValue: string | null = null;
  let lockAcquired = false;

  let headersToReturn: Headers | undefined;

  // Limite fixo de 3 para todos
  const roleLimit = LIMIT_ANALISE_DIARIA;
  let currentUsage = 0;

  try {
    if (!process.env.OPENAI_API_KEY) {
      return noStoreJson({ error: "Serviço de análise indisponível no momento." }, { status: 503 });
    }

    // 1) auth
    const session = await getSession();
    if (!session) return noStoreJson({ error: "Sessão inválida ou expirada" }, { status: 401 });

    const userId = getUserIdFromSession(session);
    if (!userId) return noStoreJson({ error: "Sessão inválida" }, { status: 401 });

    const ip = getClientIp(req);
    const userAgent = req.headers.get("user-agent") ?? undefined;

    // 2) CSRF
    const csrfHeader = req.headers.get("x-csrf-token");
    const csrfOk = await verifyCSRFToken(csrfHeader);
    if (!csrfOk) {
      return noStoreJson({ error: "Token de segurança inválido." }, { status: 403 });
    }

    // 3) rate limit (burst)
    const burst = await expensiveOpsRateLimit.limit(`ai:analise:${userId}:${ip}`);
    if (!burst.success) {
      return noStoreJson({ error: "Muitas requisições. Tente novamente em alguns minutos." }, { status: 429 });
    }

    // 4) body validation
    const bodyRaw = await req.json().catch(() => ({}));
    const validation = analiseSchema.safeParse(bodyRaw);
    if (!validation.success) {
      return noStoreJson({ error: "Dados inválidos", details: validation.error.flatten() }, { status: 400 });
    }
    const { simuladoId } = validation.data;

    // 5) busca simulado
    const simuladoBase = await prisma.simulado.findFirst({
      where: { id: simuladoId, usuarioId: userId },
      select: {
        id: true,
        status: true,
        tipo: true,
        tempoGastoMinutos: true,
        tempoGastoSegundos: true,        // ✅ para fallback de tempo
        mediaTempoPorQuestaoSeg: true,   // ✅ para fallback de tempo
        notaPercentual: true,
        avaliacaoIA: { select: { id: true } },
      },
    });

    if (!simuladoBase) {
      return noStoreJson({ error: "Simulado não encontrado." }, { status: 404 });
    }

    if (simuladoBase.status === "EM_ANDAMENTO") {
      return noStoreJson({ error: "Simulado ainda está em andamento." }, { status: 409 });
    }

    // 6) Cache Check (Se já existe, retorna cache sem gastar cota)
    if (simuladoBase.avaliacaoIA) {
      const cached = await prisma.avaliacaoSimulado.findFirst({ where: { simuladoId: simuladoBase.id } });
      return noStoreJson({ data: cached, cached: true }, { status: 200 });
    }

    // 7) VERIFICAÇÃO DE COTA DIÁRIA (ANTES DA IA)
    const today = getSaoPauloDay();
    redisQuotaKey = `rate_limit:analise_ai:${userId}:${today}`;

    // Incrementa atômico
    currentUsage = await redis.incr(redisQuotaKey);

    // Se for o primeiro uso, define expiração
    if (currentUsage === 1) await redis.expire(redisQuotaKey, secondsUntilNextSaoPauloMidnight());

    // Prepara headers de limite
    const headers = new Headers();
    headers.set("X-RateLimit-Limit", String(roleLimit));
    headers.set("X-RateLimit-Remaining", String(Math.max(0, roleLimit - currentUsage)));
    headersToReturn = headers;

    // Se estourou limite
    if (currentUsage > roleLimit) {
      return noStoreJson({ error: `Limite diário atingido (${roleLimit} análises).` }, { status: 429, headers });
    }

    // Marca para reembolso se der erro depois disso
    shouldRefundQuota = true;

    // 8) lock (Anti-Duplo Clique)
    lockKey = `lock:ai:analise:${simuladoBase.id}`;
    lockValue = randomLockValue();
    try {
      const setOk = await redis.set(lockKey, lockValue, { nx: true, ex: LOCK_TTL_SECONDS });
      lockAcquired = Boolean(setOk);
    } catch {
      lockAcquired = false;
    }

    if (!lockAcquired) {
      // Se não conseguiu lock, devolve a cota pois nem iniciou análise
      try {
        if (redisQuotaKey) await redis.decr(redisQuotaKey);
      } catch {}
      shouldRefundQuota = false;
      return noStoreJson({ error: "Análise já em processamento." }, { status: 409, headers });
    }

    // 9) Busca Questões
    const questoes = await prisma.simuladosQuestao.findMany({
      where: { simuladoId: simuladoBase.id },
      select: {
        correta: true,
        tempoResposta: true,
        questao: {
          select: {
            dificuldade: true,
            nivelCognitivo: true,
            cursoTecnico: { select: { nome: true } },
            unidadeCurricular: { select: { nome: true } },
            funcao: { select: { nome: true } },
            subfuncao: { select: { nome: true } },
            capacidade: { select: { sigla: true, descricao: true } },
            conhecimento: { select: { nome: true } },
            subConhecimento: { select: { nome: true } },
          },
        },
      },
    });

    const totalQuestoes = questoes.length;

    if (totalQuestoes === 0) {
      try {
        if (redisQuotaKey) await redis.decr(redisQuotaKey);
      } catch {}
      shouldRefundQuota = false;
      return noStoreJson({ error: "Sem questões para analisar." }, { status: 409 });
    }

    // Fallback de tempo médio global (evita 0s quando tempoResposta não existe)
    const fallbackTempoMedioGlobalSeg =
      typeof simuladoBase.mediaTempoPorQuestaoSeg === "number" &&
      Number.isFinite(simuladoBase.mediaTempoPorQuestaoSeg) &&
      simuladoBase.mediaTempoPorQuestaoSeg > 0
        ? simuladoBase.mediaTempoPorQuestaoSeg
        : typeof simuladoBase.tempoGastoSegundos === "number" &&
          Number.isFinite(simuladoBase.tempoGastoSegundos) &&
          simuladoBase.tempoGastoSegundos > 0
        ? simuladoBase.tempoGastoSegundos / Math.max(1, totalQuestoes)
        : null;

    // ... (Cálculo de Estatísticas - Mantido igual, com normalização de dificuldade) ...
    const byBloom = new Map<string, Stat>();
    const byDificuldade = new Map<string, Stat>();
    const byCurso = new Map<string, Stat>();
    const byUC = new Map<string, Stat>();
    const byFuncao = new Map<string, Stat>();
    const bySubfuncao = new Map<string, Stat>();
    const byCapacidade = new Map<string, Stat>();
    const byObjeto = new Map<string, Stat>();
    let acertos = 0;

    // Score ponderado (evita 0% por cálculo quebrado no front)
    let somaPesosTotal = 0;
    let somaPesosAcertos = 0;

    for (const sq of questoes) {
      const correta = sq.correta;
      const tempo = sq.tempoResposta ?? null;
      if (correta === true) acertos++;

      const q = sq.questao;

      addToStat(byBloom, q.nivelCognitivo ?? "N/A", correta, tempo);

      const difKey = normalizeDificuldade(q.dificuldade);
      addToStat(byDificuldade, difKey, correta, tempo);

      // Ponderação: sempre soma um peso (mesmo se dificuldade vier desconhecida)
      if (difKey !== "N/A") {
        const w = PESOS_DIFICULDADE[difKey];
        somaPesosTotal += w;
        if (correta === true) somaPesosAcertos += w;
      } else {
        // fallback: peso 1.0 para desconhecido
        somaPesosTotal += 1;
        if (correta === true) somaPesosAcertos += 1;
      }

      addToStat(byCurso, q.cursoTecnico?.nome ?? "Não informado", correta, tempo);
      addToStat(byUC, q.unidadeCurricular?.nome ?? "Não informado", correta, tempo);
      addToStat(byFuncao, q.funcao?.nome ?? "Não informado", correta, tempo);
      addToStat(bySubfuncao, q.subfuncao?.nome ?? "Não informado", correta, tempo);
      addToStat(byCapacidade, q.capacidade ? `${q.capacidade.sigla} - ${q.capacidade.descricao}` : "Não informado", correta, tempo);
      addToStat(byObjeto, q.conhecimento?.nome ?? "Não informado", correta, tempo);
    }

    // Finaliza dificuldade e aplica fallback de tempo médio quando não houver tempoResposta
    const dificuldadeStatsBase = getAllStats(finalizeStats(byDificuldade));
    const dificuldadeStats = dificuldadeStatsBase.map((d) => ({
      ...d,
      tempoMedioSeg:
        d.tempoMedioSeg == null && fallbackTempoMedioGlobalSeg != null
          ? Number(fallbackTempoMedioGlobalSeg.toFixed(1))
          : d.tempoMedioSeg,
    }));

    const percentualCru =
      totalQuestoes > 0 ? Number(((acertos / totalQuestoes) * 100).toFixed(1)) : null;

    const scorePonderado =
      somaPesosTotal > 0 ? Number(((somaPesosAcertos / somaPesosTotal) * 100).toFixed(1)) : null;

    const metricasResumo = {
      simulado: {
        tipo: simuladoBase.tipo,
        nota: simuladoBase.notaPercentual,
        notaPercentual: simuladoBase.notaPercentual,
        total: totalQuestoes,
        acertos: acertos,
        percentualCru,
        scorePonderado,
        tempoMedioGlobalSeg:
          fallbackTempoMedioGlobalSeg != null ? Number(fallbackTempoMedioGlobalSeg.toFixed(1)) : null,
        tempoMedioSeg:
          fallbackTempoMedioGlobalSeg != null ? Number(fallbackTempoMedioGlobalSeg.toFixed(1)) : null,
      },
      bloom: getAllStats(finalizeStats(byBloom)),
      dificuldade: dificuldadeStats,
      uc: pickTopBottom(finalizeStats(byUC)),
      capacidades: pickTopBottom(finalizeStats(byCapacidade)),
      objetos: pickTopBottom(finalizeStats(byObjeto)),
      funcoes: pickTopBottom(finalizeStats(byFuncao)),
      cursoTecnico: pickTopBottom(finalizeStats(byCurso)),
    };

    // Sanitiza objeto para hashing, IA e persistência (agora sanitizeObject é efetivamente usado)
    const metricasResumoSan = sanitizeObject(metricasResumo);

    const hashEntrada = calcHashEntrada(metricasResumoSan);

    // 10) CHAMADA IA (Só acontece se passar pelo Rate Limit)
    const systemPrompt = `
Você é um Coordenador Pedagógico especialista em avaliação. Receberá um único objeto JSON chamado "metricasResumo" contendo estatísticas de um simulado (totais, acertos, nota percentual, distribuições por dificuldade, nível cognitivo, unidade curricular, capacidade, função, objeto/conhecimento, curso técnico, tempos médios e amostras top/bottom). Use apenas esses dados para sua análise.

1) Valide o JSON de entrada. Se faltar dado essencial, retorne um JSON válido com explicação nas mesmas chaves.

2) Calcule para cada agrupamento: total de questões, acertos, erros, acurácia em porcentagem (1 casa decimal) e tempo médio de resposta em segundos (1 casa decimal) quando disponível.

3) Identifique e descreva:
   - Pontos fortes (2–6 itens) com números e interpretação.
   - Pontos fracos (2–6 itens) com números e interpretação.
   - Áreas de atenção relacionadas a tempos de resposta atípicos.

4) Priorize recomendações por impacto (alto, médio, baixo) e forneça um plano de ação prático e mensurável contendo:
   - Objetivos SMART,
   - Atividades concretas (ex.: número de questões por dia, sessões cronometradas),
   - Alocação de tempo por tópico,
   - Tipos de recursos recomendados (leitura, exercícios, vídeos, simulados),
   - Exemplo de frases motivacionais curtas para o professor.

5) Seja preciso: cite contagens e porcentagens (ex.: "3 de 5 — 60%"). Não invente números.

6) Tom: profissional, empático e motivador. Linguagem: português claro.

7) Saída obrigatória: **um único objeto JSON válido** com exatamente estas quatro chaves (strings):
   - feedbackGeral (min 80 chars, max 1000),
   - pontosFortes,
   - pontosFracos,
   - recomendacoes.

Cada campo deve mencionar números extraídos do metricasResumo. Não retorne texto fora do JSON. Se dados insuficientes, explique brevemente em cada campo.

Use este formato estrito e gere a análise com base estrita nos dados recebidos.

Saída (exemplo sintético — apenas para ilustrar formato; é altamente importante: o texto real deve ser gerado a partir dos dados):
{
  "feedbackGeral": "Você respondeu 20 questões e acertou 12 (60%). Bom desempenho geral, mas há espaço para melhorar em temas específicos. A média de tempo por questão foi 45.3s; em tópicos X e Y o tempo foi significativamente maior, indicando hesitação. Mantenha a rotina de estudos e foque nas recomendações abaixo.",
  "pontosFortes": "Capacidade 'A' — 8/10 acertos (80%); Unidade Curricular 'Redes' — 6/7 acertos (85.7%); Nível cognitivo 'MUITO_FACIL' — 15/16 respondidas corretas (93.8%).",
  "pontosFracos": "Capacidade 'B' — 2/5 acertos (40%); Unidade Curricular 'Sensores' — 1/4 acertos (25%); Dificuldade 'DIFICIL' — 3/6 acertos (50%). Tempo médio em 'Sensores' 78.2s (muito acima da média).",
  "recomendacoes": "Prioridade 1 (2 semanas): Revisar Capacidade 'B' com 6 sessões de 40 min; resolver 20 questões cronometradas sobre 'Sensores' em 4 dias; usar flashcards para conceitos-chave (15 min/dia). Prioridade 2: consolidar 'Redes' com 3 simulados cronometrados. Objetivo SMART: aumentar acurácia em 'Sensores' de 25% para 60% em 4 semanas, medido por 2 simulados de 20 questões."
}
`.trim();

    const model = process.env.OPENAI_MODEL_ANALISE_DESEMPENHO || "gpt-4o-mini";
    const start = Date.now();

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(metricasResumoSan) },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2000,
      temperature: 0.2,
    });

    const tempoGeracaoMs = Date.now() - start;
    const raw = completion.choices?.[0]?.message?.content ?? "{}";

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("IA retornou JSON inválido.");
    }

    // Validação de saída da IA (evita salvar payload quebrado)
    const out = iaSchema.safeParse(parsed);
    if (!out.success) {
      throw new Error("IA retornou JSON fora do schema esperado.");
    }

    const tokensTotal = completion.usage?.total_tokens ?? 0;

    // 11) Persistência
    let novaAvaliacao;
    try {
      novaAvaliacao = await prisma.avaliacaoSimulado.create({
        data: {
          simuladoId: simuladoBase.id,
          feedbackGeral: sanitizeString(out.data.feedbackGeral),
          pontosFortes: sanitizeString(out.data.pontosFortes),
          pontosFracos: sanitizeString(out.data.pontosFracos),
          recomendacoes: sanitizeString(out.data.recomendacoes),
          modeloIA: model,
          versaoPrompt: PROMPT_VERSION,
          tokensTotal,
          tempoGeracaoMs,
          metricasResumo: metricasResumoSan as any,
          hashEntrada,
        },
      });
    } catch (e: any) {
      if (e.code === "P2002") {
        novaAvaliacao = await prisma.avaliacaoSimulado.findFirst({ where: { simuladoId: simuladoBase.id } });
      } else {
        throw e;
      }
    }

    // Sucesso! Não reembolsa.
    shouldRefundQuota = false;

    await registrarLog({
      acao: AuditAction.IA_ANALISE_DESEMPENHO,
      usuarioId: userId,
      usuarioNome: (session as any)?.name ?? null,
      recurso: "/api/ai/analise-desempenho",
      ip,
      userAgent,
      detalhes: { simuladoId: simuladoBase.id, tokens: tokensTotal, tempoGeracaoMs },
    }).catch(() => {});

    return noStoreJson(
      { data: novaAvaliacao, cached: false, usage: { current: currentUsage, limit: roleLimit } },
      { status: 200, headers: headersToReturn }
    );
  } catch (error: any) {
    // 🔄 Reembolso de Cota em caso de erro
    if (shouldRefundQuota && redisQuotaKey) {
      try {
        await redis.decr(redisQuotaKey);
        console.log(`[AI] Cota de análise reembolsada para usuário.`);
      } catch (e) {
        console.error("Erro em ai/analise-desempenho:", e instanceof Error ? e.message : String(e));
      }
    }

    console.error("Erro Crítico [IA Analise]:", error);

    return noStoreJson(
      {
        error: "Falha ao processar análise inteligente.",
        details: error?.error?.message || error.message,
      },
      { status: 500 }
    );
  } finally {
    if (lockAcquired && lockKey && lockValue) {
      try {
        const cur = await redis.get(lockKey);
        if (cur === lockValue) await redis.del(lockKey);
      } catch {}
    }
  }
}
