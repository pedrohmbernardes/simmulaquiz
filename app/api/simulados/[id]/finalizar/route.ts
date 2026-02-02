// app/api/simulados/[id]/finalizar/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { verifyCSRFToken } from '@/lib/csrf';
import { expensiveOpsRateLimit } from '@/lib/ratelimit'; // ✅ Alterado para limitador de ops pesadas
import { processarGamificacaoSimulado } from '@/lib/gamificacao/engine';
import { enviarEmailSimuladoConcluido } from '@/lib/mail';
import { AuditAction } from '@/lib/audit'; // ✅ Importação para padronização

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getClientIpFromHeaders(h: Headers): string {
  const xff = h.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() || '127.0.0.1';
  return h.get('x-real-ip') ?? '127.0.0.1';
}

function normalizeAlternativa(raw: unknown): 'a' | 'b' | 'c' | 'd' | 'e' | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  const m = s.match(/[abcde]/);
  const letter = m?.[0] ?? null;
  return letter ? (letter as any) : null;
}

const BodySchema = z
  .object({
    respostas: z.record(z.string(), z.any()).optional(),
    temposResposta: z
      .record(z.string(), z.coerce.number().int().min(0).max(60 * 60))
      .optional(),
  })
  .default({});

// ============================
// Eventos (para Toasts no Front)
// ============================
type GamificationEvent =
  | { type: 'XP_EARNED'; amount: number; label?: string }
  | { type: 'LEVEL_UP'; from: number; to: number }
  | { type: 'TITLE_UNLOCKED'; title: string }
  | { type: 'ACHIEVEMENT_UNLOCKED'; name: string; rarity?: string; points?: number }
  | { type: 'STREAK_UPDATED'; current: number; best?: number };

function buildGamificationEvents(input: {
  before: { nivel: number; pontos: number; streakAtual: number; maiorStreak: number };
  after: { nivel: number; pontos: number; streakAtual: number; maiorStreak: number } | null;
  engineData: any | null;
}): GamificationEvent[] {
  const events: GamificationEvent[] = [];
  const { before, after, engineData } = input;

  // 1) XP ganho
  const xp = Number(engineData?.xpGanhoTotal ?? engineData?.xpConcedido ?? 0);
  if (Number.isFinite(xp) && xp > 0) {
    events.push({ type: 'XP_EARNED', amount: xp, label: 'Simulado finalizado' });
  }

  // 2) Level up (diff antes/depois)
  if (after && Number.isFinite(after.nivel) && after.nivel > before.nivel) {
    events.push({ type: 'LEVEL_UP', from: before.nivel, to: after.nivel });
  }

  // 3) Título novo
  if (engineData?.tituloNovo && typeof engineData.tituloNovo === 'string') {
    events.push({ type: 'TITLE_UNLOCKED', title: engineData.tituloNovo });
  }

  // 4) Conquistas desbloqueadas
  if (Array.isArray(engineData?.conquistas)) {
    for (const c of engineData.conquistas) {
      if (!c) continue;
      const name = String(c.nome ?? c.name ?? 'Conquista desbloqueada');
      const rarity = c.raridade ?? c.rarity;
      const points = typeof c.pontosReais === 'number' ? c.pontosReais : typeof c.points === 'number' ? c.points : undefined;

      events.push({
        type: 'ACHIEVEMENT_UNLOCKED',
        name,
        rarity: typeof rarity === 'string' ? rarity : undefined,
        points,
      });
    }
  }

  // 5) Streak
  if (after && after.streakAtual !== before.streakAtual) {
    events.push({
      type: 'STREAK_UPDATED',
      current: after.streakAtual,
      best: typeof after.maiorStreak === 'number' ? after.maiorStreak : undefined,
    });
  }

  return events;
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  // 1) Sessão
  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const userId = Number(session.sub);
  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });
  }

  // 2) Rate-limit (Operações Caras)
  // Finalizar simulado é pesado (cálculo + email + transação). Usamos limite mais estrito de frequência.
  const ip = getClientIpFromHeaders(request.headers);
  const rlKey = `simulado_finalizar:${userId}:${ip}`;
  const rl = await expensiveOpsRateLimit.limit(rlKey);

  if (!rl.success) {
    return NextResponse.json(
      { error: 'Processando... Aguarde antes de tentar novamente.' },
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

  // 3) CSRF
  const csrfHeader = request.headers.get('x-csrf-token');
  const csrfOk = await verifyCSRFToken(csrfHeader);
  if (!csrfOk) {
    return NextResponse.json({ error: 'CSRF inválido' }, { status: 403 });
  }

  // 4) Params
  const { id } = await ctx.params;
  const simuladoId = Number(id);
  if (!Number.isFinite(simuladoId) || simuladoId <= 0) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  // 5) Body Parsing
  let body: z.infer<typeof BodySchema> = {};
  try {
    const ct = request.headers.get('content-type') ?? '';
    if (ct && !ct.includes('application/json')) {
      return NextResponse.json(
        { error: 'Content-Type inválido. Envie application/json.' },
        { status: 415 }
      );
    }
    const json = await request.json().catch(() => ({}));
    body = BodySchema.parse(json);
  } catch {
    body = {};
  }

  try {
    const now = new Date();

    // ======================================================
    // 6) A TRANSAÇÃO PRINCIPAL (com lock do simulado)
    // ======================================================
    const result = await prisma.$transaction(async (tx) => {
      // 🔒 Lock Pessimista: Garante que ninguém altere este simulado simultaneamente
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "Simulado" WHERE id = ${simuladoId} AND "usuarioId" = ${userId} FOR UPDATE`
      );

      // Carrega simulado
      const simulado = await tx.simulado.findFirst({
        where: { id: simuladoId, usuarioId: userId },
        select: {
          id: true,
          tipo: true,
          status: true,
          qtdeQuestoes: true,
          tempoLimiteMinutos: true,
          dataInicio: true,
          createdAt: true,
          strikesUsados: true,
          strikesMax: true,
          anuladoMotivo: true,
          usuario: {
            select: { email: true, nome: true },
          },
          simuladosQuestoes: {
            select: {
              questaoId: true,
              alternativaMarcada: true,
              tempoResposta: true,
            },
          },
        },
      });

      if (!simulado) return { kind: 'not_found' as const };

      // Se já não estiver em andamento, retorna status atual sem erro (idempotência)
      if (simulado.status !== 'EM_ANDAMENTO') {
        return {
          kind: 'already_done' as const,
          status: simulado.status,
        };
      }

      const inicio = simulado.dataInicio ?? simulado.createdAt ?? now;
      const elapsedSec = Math.max(
        0,
        Math.floor((now.getTime() - new Date(inicio).getTime()) / 1000)
      );
      const limiteSec = Math.max(0, (simulado.tempoLimiteMinutos ?? 0) * 60);
      const GRACE_SEC = 15; // Tolerância de rede

      // Anti-cheat: Tempo
      if (limiteSec > 0 && elapsedSec > limiteSec + GRACE_SEC) {
        await tx.simulado.update({
          where: { id: simulado.id },
          data: {
            status: 'ANULADO',
            dataConclusao: now,
            tempoGastoMinutos: Math.round(elapsedSec / 60),
            tempoGastoSegundos: elapsedSec,
            anuladoMotivo: 'Tempo limite excedido.',
          },
        });

        await tx.logAuditoria.create({
          data: {
            usuarioId: userId,
            usuarioNome: (session as any)?.name ?? null,
            ip,
            userAgent: request.headers.get('user-agent') || null,
            acao: 'SIMULADO_ANULADO_FRAUDE' as any, // Ajuste conforme seu enum
            recurso: `simulado:${simuladoId}`,
            detalhes: { elapsedSec, limiteSec, motivo: 'Tempo excedido' },
          },
        });

        return { kind: 'anulado_tempo' as const };
      }

      // Anti-cheat: Strikes
      const strikesUsados = Number(simulado.strikesUsados ?? 0);
      const strikesMax = Number(simulado.strikesMax ?? 3);
      if (strikesUsados >= strikesMax) {
        await tx.simulado.update({
          where: { id: simulado.id },
          data: {
            status: 'ANULADO',
            dataConclusao: now,
            tempoGastoMinutos: Math.round(elapsedSec / 60),
            tempoGastoSegundos: elapsedSec,
            anuladoMotivo: simulado.anuladoMotivo ?? 'Strikes excedidos.',
          },
        });

        await tx.logAuditoria.create({
          data: {
            usuarioId: userId,
            usuarioNome: (session as any)?.name ?? null,
            ip,
            userAgent: request.headers.get('user-agent') || null,
            acao: AuditAction.SIMULADO_ANULADO_FRAUDE,
            recurso: `simulado:${simuladoId}`,
            detalhes: { strikesUsados, strikesMax },
          },
        });

        return { kind: 'anulado_strike' as const };
      }

      // Aplica respostas enviadas
      const respostas = body.respostas ?? {};
      const temposResposta = body.temposResposta ?? {};
      const allowed = new Set(simulado.simuladosQuestoes.map((sq) => sq.questaoId));
      const updates: Array<{
        questaoId: number;
        alternativa: 'a' | 'b' | 'c' | 'd' | 'e';
        tempoResposta?: number;
      }> = [];

      // Anti-DoS: limita volume de updates
      const maxUpdates = Math.max(0, Math.min(simulado.qtdeQuestoes ?? 0, 300));
      let updateCount = 0;

      for (const [k, v] of Object.entries(respostas)) {
        if (updateCount >= maxUpdates) break;

        const questaoId = Number(k);
        if (!Number.isFinite(questaoId) || questaoId <= 0) continue;
        if (!allowed.has(questaoId)) continue; // Impede update em questão fora da prova

        const alt = normalizeAlternativa(v);
        if (!alt) continue;

        const t = temposResposta[k];
        const tempo = Number.isFinite(t) ? Math.max(0, Math.min(3600, Number(t))) : undefined;

        updates.push({ questaoId, alternativa: alt, tempoResposta: tempo });
        updateCount += 1;
      }

      if (updates.length) {
        await Promise.all(
          updates.map((u) =>
            tx.simuladosQuestao.updateMany({
              where: { simuladoId: simulado.id, questaoId: u.questaoId },
              data: {
                alternativaMarcada: u.alternativa,
                ...(typeof u.tempoResposta === 'number' ? { tempoResposta: u.tempoResposta } : {}),
              },
            })
          )
        );
      }

      // Recarrega join para correção (após updates)
      const sqs = await tx.simuladosQuestao.findMany({
        where: { simuladoId: simulado.id },
        select: { questaoId: true, alternativaMarcada: true, tempoResposta: true },
      });

      const questaoIds = sqs.map((s) => s.questaoId);
      const questoes = await tx.questao.findMany({
        where: { id: { in: questaoIds } },
        select: { id: true, alternativaCorreta: true },
      });

      const corretaById = new Map<number, string>();
      for (const q of questoes) {
        corretaById.set(q.id, normalizeAlternativa(q.alternativaCorreta) ?? '');
      }

      let acertos = 0;
      const erradas: number[] = [];
      const corrigidas: Array<{
        questaoId: number;
        correta: boolean;
        alternativaMarcada: string;
        tempoResposta: number | null;
      }> = [];

      for (const sq of sqs) {
        const marcada = normalizeAlternativa(sq.alternativaMarcada);
        const correta = corretaById.get(sq.questaoId) ?? '';
        const isCorreta = !!marcada && marcada === correta;

        if (isCorreta) acertos += 1;
        else erradas.push(sq.questaoId);

        corrigidas.push({
          questaoId: sq.questaoId,
          correta: isCorreta,
          alternativaMarcada: marcada ?? 'NA',
          tempoResposta: typeof sq.tempoResposta === 'number' ? sq.tempoResposta : null,
        });
      }

      const total = sqs.length;
      const respondidas = corrigidas.reduce((acc, c) => acc + (c.alternativaMarcada !== 'NA' ? 1 : 0), 0);
      const notaPercentual = total > 0 ? Math.round((acertos / total) * 100) : 0;
      const tempoGastoMinutos = Math.round(elapsedSec / 60);
      const mediaTempoPorQuestaoSeg = total > 0 ? Number((elapsedSec / total).toFixed(2)) : null;

      // Persiste correção (isCorreta) no banco
      await Promise.all(
        corrigidas.map((c) =>
          tx.simuladosQuestao.updateMany({
            where: { simuladoId: simulado.id, questaoId: c.questaoId },
            data: { correta: c.correta },
          })
        )
      );

      // Conclui simulado (Status FINAL)
      await tx.simulado.update({
        where: { id: simulado.id },
        data: {
          status: 'CONCLUIDO',
          dataConclusao: now,
          tempoGastoMinutos,
          tempoGastoSegundos: elapsedSec,
          notaAcertos: acertos,
          notaPercentual,
          questoesRespondidas: respondidas,
          acertos,
          erros: total - acertos,
          mediaTempoPorQuestaoSeg: mediaTempoPorQuestaoSeg ?? undefined,
        },
      });

      // Registra no histórico de tentativas
      await tx.questaoTentativa.createMany({
        data: corrigidas.map((c) => ({
          usuarioId: userId,
          questaoId: c.questaoId,
          alternativaMarcada: c.alternativaMarcada,
          correta: c.correta,
          tempoResposta: c.tempoResposta,
          origem: `SIMULADO:${simulado.id}`,
        })),
        skipDuplicates: false,
      });

      // Atualiza Caderno de Erros
      if (erradas.length) {
        await Promise.all(
          erradas.map((questaoId) =>
            tx.questaoErro.upsert({
              where: { usuarioId_questaoId: { usuarioId: userId, questaoId } },
              create: {
                usuarioId: userId,
                questaoId,
                vezesErrada: 1,
                ultimoErro: now,
                revisada: false,
              },
              update: {
                vezesErrada: { increment: 1 },
                ultimoErro: now,
                revisada: false,
              },
            })
          )
        );
      }

      // Auditoria de Sucesso
      await tx.logAuditoria.create({
        data: {
          usuarioId: userId,
          usuarioNome: (session as any)?.name ?? null,
          ip,
          userAgent: request.headers.get('user-agent') || null,
          acao: AuditAction.SIMULADO_FINALIZAR,
          recurso: `simulado:${simuladoId}`,
          detalhes: {
            acertos,
            total,
            notaPercentual,
            tempoGastoMinutos,
          },
        },
      });

      return {
        kind: 'ok' as const,
        status: 'CONCLUIDO' as const,
        acertos,
        total,
        respondidas,
        notaPercentual,
        tempoGastoMinutos,
        tipoSimulado: simulado.tipo,
        usuario: simulado.usuario,
      };
    });

    // ======================================================
    // 7) TRATAMENTO DE RETORNO FORA DA TRANSAÇÃO
    // ======================================================
    if (result.kind === 'not_found') {
      return NextResponse.json({ error: 'Simulado não encontrado' }, { status: 404 });
    }

    if (result.kind === 'already_done') {
      return NextResponse.json({ ok: true, status: result.status }, { status: 200 });
    }

    if (result.kind === 'anulado_tempo') {
      return NextResponse.json(
        { ok: true, status: 'ANULADO', anuladoMotivo: 'Tempo limite excedido.' },
        { status: 200 }
      );
    }

    if (result.kind === 'anulado_strike') {
      return NextResponse.json(
        { ok: true, status: 'ANULADO', anuladoMotivo: 'Strikes excedidos.' },
        { status: 200 }
      );
    }

    // ======================================================
    // 8) PÓS-PROCESSAMENTO (Gamificação + Email)
    // ======================================================
    // Snapshot BEFORE (para gerar delta visual pro usuário)
    const before = await prisma.usuarioGamificacao.findUnique({
      where: { usuarioId: userId },
      select: { nivel: true, pontos: true, streakAtual: true, maiorStreak: true },
    });

    const beforeState = {
      nivel: before?.nivel ?? 1,
      pontos: before?.pontos ?? 0,
      streakAtual: before?.streakAtual ?? 0,
      maiorStreak: before?.maiorStreak ?? 0,
    };

    let dadosGamificacao: any = null;
    let events: GamificationEvent[] = [];

    try {
      // Engine calcula XP, Nivel, Conquistas
      const resultadoGamificacao = await processarGamificacaoSimulado(simuladoId);
      if (resultadoGamificacao?.success) {
        dadosGamificacao = resultadoGamificacao.data;
      }

      // Snapshot AFTER
      const after = await prisma.usuarioGamificacao.findUnique({
        where: { usuarioId: userId },
        select: { nivel: true, pontos: true, streakAtual: true, maiorStreak: true },
      });

      const afterState = after
        ? {
            nivel: after.nivel ?? 1,
            pontos: after.pontos ?? 0,
            streakAtual: after.streakAtual ?? 0,
            maiorStreak: after.maiorStreak ?? 0,
          }
        : null;

      if (Array.isArray(dadosGamificacao?.events)) {
        events = dadosGamificacao.events as GamificationEvent[];
      } else {
        events = buildGamificationEvents({ before: beforeState, after: afterState, engineData: dadosGamificacao });
      }
    } catch (engineError) {
      console.error(
        'Erro Gamificação:',
        engineError instanceof Error ? engineError.message : String(engineError)
      );
      // Fallback gracioso (não falha a prova se o sistema de XP der erro)
      dadosGamificacao = null;
      events = [];
    }

    // Envio de Email (Assíncrono)
    if (result.kind === 'ok' && result.usuario?.email) {
      const tipo = String(result.tipoSimulado ?? '').toUpperCase();
      const tituloEmail = `Simulado de ${tipo === 'SAEP' ? 'SAEP' : 'Treino Geral'}`;

      enviarEmailSimuladoConcluido(
        result.usuario.email,
        result.usuario.nome,
        tituloEmail,
        simuladoId,
        {
          acertos: result.acertos,
          total: result.total,
          xpGanho: Number(dadosGamificacao?.xpGanhoTotal ?? 0) || 0,
          tempo: `${result.tempoGastoMinutos} min`,
        }
      ).catch((err) => console.error('Falha email:', err));
    }

    return NextResponse.json(
      {
        ...result,
        gamificacao: dadosGamificacao,
        events, 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      'Erro Critical Finalizar:',
      error instanceof Error ? error.message : String(error)
    );
    return NextResponse.json({ error: 'Erro interno ao finalizar simulado' }, { status: 500 });
  }
}