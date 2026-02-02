// app/api/cron/ranking-snapshot/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';

import { prisma } from '@/lib/prisma';
import { authRateLimit } from '@/lib/ratelimit';

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
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail-closed

  const auth = req.headers.get('authorization');
  const bearer = auth?.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  const headerSecret = (req.headers.get('x-cron-secret') ?? '').trim();

  const token = bearer || headerSecret;
  return token.length > 0 && safeEqual(token, secret);
}

// ---- Query ----
// Observação: Vercel Cron (vercel.json) não suporta query string no path.
// Então, no default (AUTO), este endpoint gera *tudo* que o ranking precisa.
const QuerySchema = z.object({
  // AUTO: gera todos os períodos/tipos relevantes.
  // SINGLE: gera somente o período/tipo especificados (útil pra debug manual).
  mode: z.enum(['AUTO', 'SINGLE']).optional(),

  periodo: z
    .enum(['GERAL', 'SEMANAL', 'MENSAL', 'ROLLING_90D', 'ROLLING_180D', 'ROLLING_12M'])
    .optional(),

  tipo: z.enum(['XP_GANHO', 'XP_TOTAL', 'STREAK']).optional(),

  // force=1: reprocessa mesmo se já existir snapshot da janela.
  force: z
    .union([z.literal('1'), z.literal('true'), z.literal('0'), z.literal('false')])
    .optional(),
});

type Periodo = 'GERAL' | 'SEMANAL' | 'MENSAL' | 'ROLLING_90D' | 'ROLLING_180D' | 'ROLLING_12M';

type Tipo = 'XP_GANHO' | 'XP_TOTAL' | 'STREAK';

type RankRow = { usuarioId: number; valorInt: number };

function startOfDayUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function startOfWeekUTC(d: Date) {
  // semana começa na segunda (ISO)
  const day = d.getUTCDay(); // 0=Dom,1=Seg..6=Sáb
  const diffToMonday = (day + 6) % 7; // seg=0, dom=6
  const sod = startOfDayUTC(d);
  sod.setUTCDate(sod.getUTCDate() - diffToMonday);
  return sod;
}

function startOfMonthUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

function addDaysUTC(d: Date, days: number) {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function addMonthsUTC(d: Date, months: number) {
  const x = new Date(d.getTime());
  x.setUTCMonth(x.getUTCMonth() + months);
  return x;
}

function addYearsUTC(d: Date, years: number) {
  const x = new Date(d.getTime());
  x.setUTCFullYear(x.getUTCFullYear() + years);
  return x;
}

function computeWindow(periodo: Periodo) {
  const now = new Date();

  // Para snapshots: usamos "fim" como o início do período atual (janela fechada),
  // assim o resultado fica estável até o próximo cron.
  if (periodo === 'SEMANAL') {
    const fim = startOfWeekUTC(now); // início da semana atual
    const inicio = addDaysUTC(fim, -7);
    return { inicio, fim };
  }

  if (periodo === 'MENSAL') {
    const fim = startOfMonthUTC(now); // início do mês atual
    const inicio = startOfMonthUTC(addMonthsUTC(fim, -1));
    return { inicio, fim };
  }

  // rolling: fecha em "hoje 00:00 UTC"
  const fim = startOfDayUTC(now);

  if (periodo === 'ROLLING_90D') return { inicio: addDaysUTC(fim, -90), fim };
  if (periodo === 'ROLLING_180D') return { inicio: addDaysUTC(fim, -180), fim };
  if (periodo === 'ROLLING_12M') return { inicio: addYearsUTC(fim, -1), fim };

  // GERAL: janela diária (pra manter snapshots diários de XP_TOTAL e STREAK)
  return { inicio: new Date(Date.UTC(1970, 0, 1, 0, 0, 0, 0)), fim };
}

function calcPercentil(posicao: number, total: number) {
  if (total <= 1) return 100;
  const p = (1 - (posicao - 1) / (total - 1)) * 100;
  return Math.max(0, Math.min(100, Math.round(p * 100) / 100));
}

async function buildXpGanho(tx: any, inicio: Date, fim: Date): Promise<RankRow[]> {
  // inclui todos usuários ativos (pra poder calcular posição do usuário fora do top 50)
  const usuarios = await tx.usuario.findMany({ where: { ativo: true }, select: { id: true } });
  const ids = usuarios.map((u: any) => u.id);
  if (ids.length === 0) return [];

  const agrupado = await tx.historicoPontos.groupBy({
    by: ['usuarioId'],
    _sum: { quantidade: true },
    where: {
      usuarioId: { in: ids },
      data: { gte: inicio, lt: fim },
      quantidade: { gt: 0 }, // XP ganho (ignora débito)
    },
  });

  const byId = new Map<number, number>();
  for (const r of agrupado) byId.set(r.usuarioId, r._sum.quantidade ?? 0);

  const rows: RankRow[] = ids.map((id: number) => ({
    usuarioId: id,
    valorInt: Math.trunc(byId.get(id) ?? 0),
  }));

  rows.sort((a, b) => (b.valorInt - a.valorInt) || (a.usuarioId - b.usuarioId));
  return rows;
}

async function buildXpTotal(tx: any): Promise<RankRow[]> {
  const usuarios = await tx.usuario.findMany({ where: { ativo: true }, select: { id: true } });
  const ids = usuarios.map((u: any) => u.id);
  if (ids.length === 0) return [];

  const gam = await tx.usuarioGamificacao.findMany({
    where: { usuarioId: { in: ids } },
    select: { usuarioId: true, pontos: true },
  });

  const byId = new Map<number, number>();
  for (const g of gam) byId.set(g.usuarioId, g.pontos ?? 0);

  const rows: RankRow[] = ids.map((id: number) => ({
    usuarioId: id,
    valorInt: Math.trunc(byId.get(id) ?? 0),
  }));

  rows.sort((a, b) => (b.valorInt - a.valorInt) || (a.usuarioId - b.usuarioId));
  return rows;
}

async function buildStreak(tx: any): Promise<RankRow[]> {
  const usuarios = await tx.usuario.findMany({ where: { ativo: true }, select: { id: true } });
  const ids = usuarios.map((u: any) => u.id);
  if (ids.length === 0) return [];

  const gam = await tx.usuarioGamificacao.findMany({
    where: { usuarioId: { in: ids } },
    select: { usuarioId: true, streakAtual: true, pontos: true },
  });

  const byId = new Map<number, { streak: number; xp: number }>();
  for (const g of gam) {
    byId.set(g.usuarioId, {
      streak: Math.trunc(g.streakAtual ?? 0),
      xp: Math.trunc(g.pontos ?? 0),
    });
  }

  const rows = ids.map((id: number) => ({
    usuarioId: id,
    valorInt: byId.get(id)?.streak ?? 0,
    _xp: byId.get(id)?.xp ?? 0,
  })) as Array<RankRow & { _xp: number }>;

  rows.sort((a, b) => (b.valorInt - a.valorInt) || (b._xp - a._xp) || (a.usuarioId - b.usuarioId));

  return rows.map(({ usuarioId, valorInt }) => ({ usuarioId, valorInt }));
}

async function upsertSnapshotWithEntries(args: {
  periodo: Periodo;
  tipo: Tipo;
  inicio: Date;
  fim: Date;
  rows: RankRow[];
  force: boolean;
}) {
  const { periodo, tipo, inicio, fim, rows, force } = args;

  return prisma.$transaction(async (tx) => {
    const totalUsuarios = rows.length;

    const existing = await tx.rankingSnapshot.findFirst({
      where: { periodo, tipo, inicio, fim },
      select: { id: true },
    });

    if (existing && !force) {
      const snap = await tx.rankingSnapshot.findUnique({
        where: { id: existing.id },
        select: { id: true, periodo: true, tipo: true, inicio: true, fim: true, totalUsuarios: true },
      });
      return { snapshot: snap, entriesCreated: 0, skipped: true };
    }

    const snapshot = existing
      ? await tx.rankingSnapshot.update({
          where: { id: existing.id },
          data: { totalUsuarios },
          select: { id: true, periodo: true, tipo: true, inicio: true, fim: true, totalUsuarios: true },
        })
      : await tx.rankingSnapshot.create({
          data: { periodo, tipo, inicio, fim, totalUsuarios },
          select: { id: true, periodo: true, tipo: true, inicio: true, fim: true, totalUsuarios: true },
        });

    // Recria entries apenas em modo force (ou quando snapshot é novo).
    // Mantém idempotência e evita briga em caso de re-execução.
    if (existing) {
      await tx.rankingEntry.deleteMany({ where: { snapshotId: snapshot.id } });
    }

    const entries = rows.map((r, idx) => ({
      snapshotId: snapshot.id,
      usuarioId: r.usuarioId,
      posicao: idx + 1,
      valorInt: r.valorInt,
      percentil: calcPercentil(idx + 1, totalUsuarios),
    }));

    const CHUNK = 500;
    for (let i = 0; i < entries.length; i += CHUNK) {
      const slice = entries.slice(i, i + CHUNK);
      if (slice.length) {
        await tx.rankingEntry.createMany({ data: slice, skipDuplicates: true });
      }
    }

    return { snapshot, entriesCreated: entries.length, skipped: false };
  });
}

// ---- Concurrency guard (Postgres advisory lock) ----
// Evita 2 execuções simultâneas (bem importante no Hobby, já que a precisão é por hora).
const LOCK_ID = 89451234; // qualquer inteiro estável; não precisa ser secreto.

async function tryAcquireLock(): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ locked: boolean }>>
    `SELECT pg_try_advisory_lock(${LOCK_ID}) AS locked`;
  return rows?.[0]?.locked === true;
}

async function releaseLock(): Promise<void> {
  await prisma.$executeRaw`SELECT pg_advisory_unlock(${LOCK_ID})`;
}

async function handler(req: NextRequest) {
  // 0) Auth do cron
  if (!requireCronAuth(req)) {
    return noStoreJson({ error: 'Não autorizado' }, { status: 401 });
  }

  // 1) Rate-limit (bem leve)
  const ip = getClientIpFromHeaders(req.headers);
  const rlKey = `cron:ranking-snapshot:${ip}`;
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

  // 2) Lock (evita overlap)
  const locked = await tryAcquireLock();
  if (!locked) {
    return noStoreJson({ ok: true, skipped: 'locked' }, { status: 202 });
  }

  try {
    // 3) Query
    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      mode: searchParams.get('mode') ?? undefined,
      periodo: searchParams.get('periodo') ?? undefined,
      tipo: searchParams.get('tipo') ?? undefined,
      force: searchParams.get('force') ?? undefined,
    });

    if (!parsed.success) {
      return noStoreJson({ error: 'Parâmetros inválidos', details: parsed.error.flatten() }, { status: 400 });
    }

    const mode = (parsed.data.mode ?? 'AUTO') as 'AUTO' | 'SINGLE';
    const force = parsed.data.force === '1' || parsed.data.force === 'true';

    const results: Array<{
      periodo: Periodo;
      tipo: Tipo;
      inicio: Date;
      fim: Date;
      totalUsuarios: number;
      entriesCreated: number;
      skipped: boolean;
    }> = [];

    const jobs: Array<{ periodo: Periodo; tipo: Tipo }> = [];

    if (mode === 'SINGLE') {
      const periodo = (parsed.data.periodo ?? 'GERAL') as Periodo;
      const tipo = (parsed.data.tipo ?? 'XP_TOTAL') as Tipo;
      jobs.push({ periodo, tipo });
    } else {
      // AUTO: gera tudo que o /api/ranking consome sem precisar de query string no vercel.json
      jobs.push({ periodo: 'GERAL', tipo: 'XP_TOTAL' });
      jobs.push({ periodo: 'GERAL', tipo: 'STREAK' });

      const rollingPeriods: Periodo[] = ['SEMANAL', 'MENSAL', 'ROLLING_90D', 'ROLLING_180D', 'ROLLING_12M'];
      for (const p of rollingPeriods) jobs.push({ periodo: p, tipo: 'XP_GANHO' });
    }

    for (const job of jobs) {
      const { inicio, fim } = computeWindow(job.periodo);

      let rows: RankRow[] = [];

      if (job.tipo === 'XP_GANHO') {
        rows = await prisma.$transaction(async (tx) => buildXpGanho(tx, inicio, fim));
      } else if (job.tipo === 'XP_TOTAL') {
        rows = await prisma.$transaction(async (tx) => buildXpTotal(tx));
      } else if (job.tipo === 'STREAK') {
        rows = await prisma.$transaction(async (tx) => buildStreak(tx));
      }

      const out = await upsertSnapshotWithEntries({
        periodo: job.periodo,
        tipo: job.tipo,
        inicio,
        fim,
        rows,
        force,
      });

      results.push({
        periodo: out.snapshot?.periodo ?? job.periodo,
        tipo: out.snapshot?.tipo ?? job.tipo,
        inicio: out.snapshot?.inicio ?? inicio,
        fim: out.snapshot?.fim ?? fim,
        totalUsuarios: out.snapshot?.totalUsuarios ?? rows.length,
        entriesCreated: out.entriesCreated,
        skipped: out.skipped,
      });
    }

    return noStoreJson({ ok: true, results }, { status: 200 });
  } finally {
    await releaseLock().catch(() => {});
  }
}

export async function GET(req: NextRequest) {
  try {
    return await handler(req);
  } catch (error) {
    console.error('Erro cron ranking-snapshot:', error instanceof Error ? error.message : String(error));
    return noStoreJson({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    return await handler(req);
  } catch (error) {
    console.error('Erro cron ranking-snapshot (POST):', error instanceof Error ? error.message : String(error));
    return noStoreJson({ error: 'Erro interno' }, { status: 500 });
  }
}