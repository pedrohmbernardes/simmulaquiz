import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { csrfRateLimit } from "@/lib/ratelimit";
import { registrarLog, AuditAction } from "@/lib/audit";
import { headers } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Helper para IP (Consistência com outros arquivos)
async function getClientIp() {
  const h = await headers();
  const xff = h.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return (
    h.get('cf-connecting-ip') ??
    h.get('x-real-ip') ??
    h.get('x-client-ip') ??
    '127.0.0.1'
  );
}

function normalizeAlternativa(raw: unknown): "a" | "b" | "c" | "d" | "e" | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  const m = s.match(/[abcde]/);
  const letter = m?.[0] ?? null;
  return letter ? (letter as any) : null;
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const ip = await getClientIp();

  // 🛡️ 1) SEGURANÇA: Auth
  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const userId = Number(session.sub);
  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
  }

  // ✅ Params
  const { id } = await ctx.params;
  const simuladoId = Number(id);
  if (!Number.isFinite(simuladoId) || simuladoId <= 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  // 🛡️ 2) SEGURANÇA: Rate-limit
  // Protege o banco contra scraping de resultados (queries com JOIN são pesadas)
  if (csrfRateLimit) {
    const { success, limit, reset, remaining } = await csrfRateLimit.limit(`simulado_res:${userId}:${ip}`);
    if (!success) {
      return NextResponse.json(
        { error: "Muitas requisições. Tente novamente em instantes." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Remaining": String(remaining),
            "X-RateLimit-Reset": String(reset),
          },
        }
      );
    }
  }

  try {
    // 🛡️ 3) SEGURANÇA: Anti-IDOR (Acesso Indevido)
    // O filtro `usuarioId: userId` garante que o aluno só veja SEUS PRÓPRIOS simulados.
    const simulado = await prisma.simulado.findFirst({
      where: { id: simuladoId, usuarioId: userId },
      select: {
        id: true,
        tipo: true,
        status: true,
        qtdeQuestoes: true,
        tempoLimiteMinutos: true,
        tempoGastoMinutos: true,
        dataInicio: true,
        dataConclusao: true,
        notaAcertos: true,
        notaPercentual: true,
        strikesUsados: true,
        strikesMax: true,
        anuladoMotivo: true,
        simuladosQuestoes: {
          orderBy: { id: "asc" },
          select: {
            id: true,
            questaoId: true,
            alternativaMarcada: true,
            correta: true,
            tempoResposta: true,
          },
        },
      },
    });

    if (!simulado) {
      await registrarLog({
        acao: AuditAction.SISTEMA_ERRO, // Ou criar SEGURANCA_IDOR_TENTATIVA se preferir
        usuarioId: userId,
        usuarioNome: session.name,
        detalhes: { motivo: "Tentativa de acesso a resultado inexistente ou de terceiros", simuladoId },
      }).catch(() => {});
      return NextResponse.json({ error: "Simulado não encontrado" }, { status: 404 });
    }

    // 🛡️ 4) SEGURANÇA: Anti-Cola (Checagem de Status)
    // Impede acesso ao gabarito se a prova não estiver terminada.
    if (simulado.status === "EM_ANDAMENTO") {
      return NextResponse.json(
        { error: "Simulado ainda está em andamento. Finalize para ver o resultado." },
        { status: 409 }
      );
    }

    const total = simulado.qtdeQuestoes ?? simulado.simuladosQuestoes.length ?? 0;

    // Cenário: ANULADO/ABANDONADO (Resumo simples, sem gabarito detalhado)
    if (simulado.status === "ANULADO" || simulado.status === "ABANDONADO") {
      return NextResponse.json(
        {
          ok: true,
          simulado: {
            id: simulado.id,
            tipo: simulado.tipo,
            status: simulado.status,
            total,
            acertos: simulado.notaAcertos ?? 0,
            notaPercentual: simulado.notaPercentual ?? 0,
            tempoGastoMinutos: simulado.tempoGastoMinutos ?? null,
            dataConclusao: simulado.dataConclusao ?? null,
            strikesUsados: simulado.strikesUsados ?? 0,
            strikesMax: simulado.strikesMax ?? 3,
            anuladoMotivo: simulado.anuladoMotivo ?? null,
          },
          detalhamento: { acertadas: [], erradas: [] },
        },
        { status: 200 }
      );
    }

    // Cenário: CONCLUIDO (Montagem do Gabarito Seguro)
    
    // Fallback: Se o backend antigo não salvou booleanos, calcula agora
    const precisaComputar = simulado.simuladosQuestoes.some((sq) => sq.correta === null);
    const corretasSet = new Set<number>();
    const erradasSet = new Set<number>();

    if (!precisaComputar) {
      for (const sq of simulado.simuladosQuestoes) {
        if (sq.correta === true) corretasSet.add(sq.questaoId);
        else erradasSet.add(sq.questaoId);
      }
    } else {
      // Cálculo Legacy (apenas leitura)
      const ids = simulado.simuladosQuestoes.map((sq) => sq.questaoId);
      const gabaritos = await prisma.questao.findMany({
        where: { id: { in: ids } },
        select: { id: true, alternativaCorreta: true },
      });

      const corretaById = new Map<number, string>();
      for (const q of gabaritos) {
        corretaById.set(q.id, normalizeAlternativa(q.alternativaCorreta) ?? "");
      }

      for (const sq of simulado.simuladosQuestoes) {
        const marcada = normalizeAlternativa(sq.alternativaMarcada);
        const correta = corretaById.get(sq.questaoId) ?? "";
        if (!!marcada && marcada === correta) corretasSet.add(sq.questaoId);
        else erradasSet.add(sq.questaoId);
      }
    }

    // Busca detalhes APENAS das questões ACERTADAS
    // (Pedagogia: Questões erradas vão para o caderno de erros, aqui mostra "Revisar")
    const acertadasIds = Array.from(corretasSet);
    const questoesAcertadas = acertadasIds.length
      ? await prisma.questao.findMany({
          where: { id: { in: acertadasIds } },
          select: {
            id: true,
            enunciado: true,
            alternativaA: true,
            alternativaB: true,
            alternativaC: true,
            alternativaD: true,
            alternativaE: true,
            dificuldade: true,
            nivelCognitivo: true,
            unidadeCurricular: { select: { id: true, nome: true } },
            // Imagens, etc...
            imagens: { select: { url: true, width: true, height: true } }
          },
        })
      : [];

    const questaoAcertadaById = new Map<number, any>();
    for (const q of questoesAcertadas) questaoAcertadaById.set(q.id, q);

    const erradasIds = Array.from(erradasSet);
    // Link com Caderno de Erros
    const erros = erradasIds.length
      ? await prisma.questaoErro.findMany({
          where: { usuarioId: userId, questaoId: { in: erradasIds } },
          select: { id: true, questaoId: true },
        })
      : [];
    const erroIdByQuestaoId = new Map<number, number>();
    for (const e of erros) erroIdByQuestaoId.set(e.questaoId, e.id);

    // Montagem Final
    const acertadas = simulado.simuladosQuestoes
      .filter((sq) => corretasSet.has(sq.questaoId))
      .map((sq) => ({
        questaoId: sq.questaoId,
        alternativaMarcada: normalizeAlternativa(sq.alternativaMarcada),
        tempoResposta: typeof sq.tempoResposta === "number" ? sq.tempoResposta : null,
        questao: questaoAcertadaById.get(sq.questaoId) ?? null,
      }))
      .filter((x) => x.questao);

    const erradas = simulado.simuladosQuestoes
      .filter((sq) => erradasSet.has(sq.questaoId))
      .map((sq) => ({
        questaoId: sq.questaoId,
        status: "REVISAR" as const,
        questaoErroId: erroIdByQuestaoId.get(sq.questaoId) ?? null,
      }));

    // 🛡️ 5) RESPOSTA COM CACHE PRIVADO
    return NextResponse.json(
      {
        ok: true,
        simulado: {
          id: simulado.id,
          tipo: simulado.tipo,
          status: simulado.status,
          total,
          acertos: simulado.notaAcertos ?? acertadas.length,
          notaPercentual: simulado.notaPercentual ?? null,
          tempoGastoMinutos: simulado.tempoGastoMinutos ?? null,
          dataConclusao: simulado.dataConclusao ?? null,
          strikesUsados: simulado.strikesUsados ?? 0,
          strikesMax: simulado.strikesMax ?? 3,
          anuladoMotivo: simulado.anuladoMotivo ?? null,
        },
        detalhamento: {
          acertadas,
          erradas,
        },
      },
      { 
        status: 200,
        headers: {
            // Permite cache no navegador por 30s, mas APENAS para este usuário (private)
            // Evita que proxies compartilhados vazem notas
            'Cache-Control': 'private, max-age=30, stale-while-revalidate=60'
        }
      }
    );
  } catch (err) {
    console.error("Erro simulados result:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: "Erro interno ao carregar resultado." },
      { status: 500 }
    );
  }
}