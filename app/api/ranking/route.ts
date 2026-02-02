// app/api/ranking/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { RankingPeriodo, RankingTipo } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { resolveFotoUrl } from '@/lib/storage/supabase';
import { getSession } from '@/lib/auth';
import { csrfRateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getClientIpFromHeaders(h: Headers): string {
  const xff = h.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() || '127.0.0.1';
  return h.get('x-real-ip') ?? '127.0.0.1';
}

function noStoreJson(data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.headers.set('Pragma', 'no-cache');
  res.headers.set('Expires', '0');
  return res;
}

type ResRankingItem = {
  posicao: number;
  usuarioId: number;
  nome: string;
  fotoUrl: string | null;
  valor: number;
  valorLabel: 'XP' | 'dias';
  nivel: number;
  titulo: string;
  xpTotal?: number;
  percentil?: number | null;
  isMe: boolean;
  _foraTop50?: boolean;
};

async function withSignedFotoUrl(items: ResRankingItem[]): Promise<ResRankingItem[]> {
  return Promise.all(
    items.map(async (it) => ({
      ...it,
      // mantém URLs legadas; assina quando for path (bucket privado de perfis)
      fotoUrl: await resolveFotoUrl(it.fotoUrl, 60 * 60),
    }))
  );
}

const QuerySchema = z.object({
  periodo: z.string().trim().max(40).optional(),
  tipo: z.string().trim().max(40).optional(),
});

type PeriodoEnum = RankingPeriodo;

type TipoEnum = RankingTipo;

function mapPeriodo(raw: string | null): { periodoEnum: PeriodoEnum; cutoff: Date | null } {
  const p = (raw ?? 'all').trim().toLowerCase();

  // ✅ compat (antigos)
  if (p === 'all' || p === 'geral') return { periodoEnum: 'GERAL', cutoff: null };
  if (p === '7d') return { periodoEnum: 'SEMANAL', cutoff: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
  if (p === '30d') return { periodoEnum: 'MENSAL', cutoff: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
  if (p === '90d') return { periodoEnum: 'ROLLING_90D', cutoff: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) };
  if (p === '180d') return { periodoEnum: 'ROLLING_180D', cutoff: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) };
  if (p === '1y') {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return { periodoEnum: 'ROLLING_12M', cutoff: d };
  }

  // ✅ novos
  if (p === 'semanal' || p === 'weekly') return { periodoEnum: 'SEMANAL', cutoff: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
  if (p === 'mensal' || p === 'monthly') return { periodoEnum: 'MENSAL', cutoff: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
  if (p === 'rolling_90d' || p === 'ultimos90dias' || p === 'last90days')
    return { periodoEnum: 'ROLLING_90D', cutoff: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) };
  if (p === 'rolling_180d' || p === 'ultimos180dias' || p === 'last180days')
    return { periodoEnum: 'ROLLING_180D', cutoff: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) };
  if (p === 'rolling_12m' || p === '12m' || p === '12meses' || p === 'last12months') {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return { periodoEnum: 'ROLLING_12M', cutoff: d };
  }

  // fallback seguro
  return { periodoEnum: 'GERAL', cutoff: null };
}

function mapTipo(rawTipo: string | null, periodoEnum: PeriodoEnum): TipoEnum {
  const t = (rawTipo ?? 'XP').trim().toUpperCase();

  if (t === 'STREAK') return 'STREAK';
  if (t === 'XP_TOTAL') return 'XP_TOTAL';
  if (t === 'XP_GANHO') return 'XP_GANHO';

  // compat: tipo=XP (default)
  if (periodoEnum === 'GERAL') return 'XP_TOTAL';
  return 'XP_GANHO';
}

function calcPercentilAprox(posicao: number, totalUsuarios: number): number | null {
  if (!Number.isFinite(posicao) || posicao <= 0) return null;
  if (!Number.isFinite(totalUsuarios) || totalUsuarios <= 0) return null;
  if (totalUsuarios === 1) return 100;
  const p = (1 - (posicao - 1) / (totalUsuarios - 1)) * 100;
  return Math.max(0, Math.min(100, Math.round(p * 100) / 100));
}

export async function GET(request: NextRequest) {
  try {
    // 1) Auth
    const session = await getSession();
    if (!session?.sub) return noStoreJson({ error: 'Não autorizado' }, { status: 401 });

    const usuarioId = Number(session.sub);
    if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
      return noStoreJson({ error: 'Sessão inválida' }, { status: 401 });
    }

    // 2) Rate-limit
    const ip = getClientIpFromHeaders(request.headers);
    const rlKey = `ranking:get:${usuarioId}:${ip}`;
    const rl = await csrfRateLimit.limit(rlKey);

    if (!rl.success) {
      return noStoreJson(
        { error: 'Muitas requisições. Tente novamente em instantes.' },
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

    // 3) Query params
    const { searchParams } = new URL(request.url);
    const parsed = QuerySchema.parse({
      periodo: searchParams.get('periodo') ?? undefined,
      tipo: searchParams.get('tipo') ?? undefined,
    });

    const { periodoEnum, cutoff } = mapPeriodo(parsed.periodo ?? null);
    const tipoEnum = mapTipo(parsed.tipo ?? null, periodoEnum);

    // XP_TOTAL não depende de período: força GERAL
    const effectivePeriodo: PeriodoEnum = tipoEnum === 'XP_TOTAL' ? 'GERAL' : periodoEnum;

    // 4) Pré-carrega títulos (pra calcular o título por XP total)
    const todosTitulos = await prisma.titulo.findMany({
      orderBy: { minPontos: 'desc' },
      select: { nivel: true, minPontos: true, nome: true },
    });

    const getTituloPorXP = (xp: number) =>
      todosTitulos.find((t) => xp >= t.minPontos) ?? todosTitulos[todosTitulos.length - 1] ?? null;

    const take = 50;
    const takeRaw = 200; // pega mais e filtra usuários inativos sem “quebrar” o top50

    // =====================================================
    // A) XP TOTAL (vitalício) — prioriza snapshot
    // =====================================================
    if (tipoEnum === 'XP_TOTAL') {
      const snapshot = await prisma.rankingSnapshot.findFirst({
        where: { periodo: 'GERAL', tipo: 'XP_TOTAL' },
        orderBy: { fim: 'desc' },
        include: {
          entries: {
            orderBy: { posicao: 'asc' },
            take: takeRaw,
            include: {
              usuario: {
                select: {
                  id: true,
                  nome: true,
                  fotoUrl: true,
                  ativo: true,
                  gamificacao: { select: { pontos: true } },
                },
              },
            },
          },
        },
      });

      if (snapshot) {
        const activeEntries = snapshot.entries.filter((e) => e.usuario?.ativo);
        const top: ResRankingItem[] = activeEntries.slice(0, take).map((e) => {
          const xpTotal = e.usuario.gamificacao?.pontos ?? e.valorInt ?? 0;
          const tituloInfo = getTituloPorXP(xpTotal);

          return {
            posicao: e.posicao,
            usuarioId: e.usuarioId,
            nome: e.usuario.nome ?? 'Usuário',
            fotoUrl: e.usuario.fotoUrl ?? null,
            valor: e.valorInt,
            valorLabel: 'XP',
            nivel: tituloInfo?.nivel ?? 1,
            titulo: tituloInfo?.nome ?? 'Iniciante',
            xpTotal,
            percentil: e.percentil ?? calcPercentilAprox(e.posicao, snapshot.totalUsuarios),
            isMe: e.usuarioId === usuarioId,
          };
        });

        if (!top.some((x) => x.isMe)) {
          const me = await prisma.rankingEntry.findFirst({
            where: { snapshotId: snapshot.id, usuarioId },
            include: {
              usuario: {
                select: {
                  id: true,
                  nome: true,
                  fotoUrl: true,
                  ativo: true,
                  gamificacao: { select: { pontos: true } },
                },
              },
            },
          });

          if (me?.usuario?.ativo && me.posicao > take) {
            const xpTotal = me.usuario.gamificacao?.pontos ?? me.valorInt ?? 0;
            const tituloInfo = getTituloPorXP(xpTotal);

            top.push({
              posicao: me.posicao,
              usuarioId: me.usuarioId,
              nome: me.usuario.nome ?? 'Usuário',
              fotoUrl: me.usuario.fotoUrl ?? null,
              valor: me.valorInt,
              valorLabel: 'XP',
              nivel: tituloInfo?.nivel ?? 1,
              titulo: tituloInfo?.nome ?? 'Iniciante',
              xpTotal,
              percentil: me.percentil ?? calcPercentilAprox(me.posicao, snapshot.totalUsuarios),
              isMe: true,
              _foraTop50: true,
            });
          }
        }

        return noStoreJson(await withSignedFotoUrl(top), { status: 200 });
      }

      // fallback live (se cron ainda não rodou)
      const totalUsuarios = await prisma.usuarioGamificacao.count({ where: { usuario: { ativo: true } } });

      const rows = await prisma.usuarioGamificacao.findMany({
        take,
        where: { usuario: { ativo: true } },
        orderBy: [{ pontos: 'desc' }, { usuarioId: 'asc' }],
        include: {
          usuario: { select: { id: true, nome: true, fotoUrl: true, ativo: true } },
        },
      });

      const top: ResRankingItem[] = rows.map((r, idx) => {
        const tituloInfo = getTituloPorXP(r.pontos);
        return {
          posicao: idx + 1,
          usuarioId: r.usuarioId,
          nome: r.usuario?.nome ?? 'Usuário',
          fotoUrl: r.usuario?.fotoUrl ?? null,
          valor: r.pontos,
          valorLabel: 'XP',
          nivel: tituloInfo?.nivel ?? 1,
          titulo: tituloInfo?.nome ?? 'Iniciante',
          xpTotal: r.pontos,
          percentil: calcPercentilAprox(idx + 1, totalUsuarios),
          isMe: r.usuarioId === usuarioId,
        };
      });

      if (!top.some((x) => x.isMe)) {
        const meGam = await prisma.usuarioGamificacao.findUnique({
          where: { usuarioId },
          select: { pontos: true, usuario: { select: { nome: true, fotoUrl: true, ativo: true } } },
        });

        if (meGam?.usuario?.ativo) {
          const myXp = meGam.pontos ?? 0;
          const better = await prisma.usuarioGamificacao.count({
            where: { usuario: { ativo: true }, pontos: { gt: myXp } },
          });
          const pos = better + 1;
          const tituloInfo = getTituloPorXP(myXp);

          top.push({
            posicao: pos,
            usuarioId,
            nome: meGam.usuario.nome ?? 'Usuário',
            fotoUrl: meGam.usuario.fotoUrl ?? null,
            valor: myXp,
            valorLabel: 'XP',
            nivel: tituloInfo?.nivel ?? 1,
            titulo: tituloInfo?.nome ?? 'Iniciante',
            xpTotal: myXp,
            percentil: calcPercentilAprox(pos, totalUsuarios),
            isMe: true,
            _foraTop50: true,
          });
        }
      }

      return noStoreJson(await withSignedFotoUrl(top), { status: 200 });
    }

    // =====================================================
    // B) STREAK (atual) — prioriza snapshot
    // =====================================================
    if (tipoEnum === 'STREAK') {
      const snapshot = await prisma.rankingSnapshot.findFirst({
        where: { periodo: 'GERAL', tipo: 'STREAK' },
        orderBy: { fim: 'desc' },
        include: {
          entries: {
            orderBy: { posicao: 'asc' },
            take: takeRaw,
            include: {
              usuario: {
                select: {
                  id: true,
                  nome: true,
                  fotoUrl: true,
                  ativo: true,
                  gamificacao: { select: { pontos: true } },
                },
              },
            },
          },
        },
      });

      if (snapshot) {
        const activeEntries = snapshot.entries.filter((e) => e.usuario?.ativo);
        const top: ResRankingItem[] = activeEntries.slice(0, take).map((e) => {
          const xpTotal = e.usuario.gamificacao?.pontos ?? 0;
          const tituloInfo = getTituloPorXP(xpTotal);

          return {
            posicao: e.posicao,
            usuarioId: e.usuarioId,
            nome: e.usuario.nome ?? 'Usuário',
            fotoUrl: e.usuario.fotoUrl ?? null,
            valor: e.valorInt,
            valorLabel: 'dias',
            nivel: tituloInfo?.nivel ?? 1,
            titulo: tituloInfo?.nome ?? 'Iniciante',
            xpTotal,
            percentil: e.percentil ?? calcPercentilAprox(e.posicao, snapshot.totalUsuarios),
            isMe: e.usuarioId === usuarioId,
          };
        });

        if (!top.some((x) => x.isMe)) {
          const me = await prisma.rankingEntry.findFirst({
            where: { snapshotId: snapshot.id, usuarioId },
            include: {
              usuario: {
                select: {
                  id: true,
                  nome: true,
                  fotoUrl: true,
                  ativo: true,
                  gamificacao: { select: { pontos: true } },
                },
              },
            },
          });

          if (me?.usuario?.ativo && me.posicao > take) {
            const xpTotal = me.usuario.gamificacao?.pontos ?? 0;
            const tituloInfo = getTituloPorXP(xpTotal);

            top.push({
              posicao: me.posicao,
              usuarioId: me.usuarioId,
              nome: me.usuario.nome ?? 'Usuário',
              fotoUrl: me.usuario.fotoUrl ?? null,
              valor: me.valorInt,
              valorLabel: 'dias',
              nivel: tituloInfo?.nivel ?? 1,
              titulo: tituloInfo?.nome ?? 'Iniciante',
              xpTotal,
              percentil: me.percentil ?? calcPercentilAprox(me.posicao, snapshot.totalUsuarios),
              isMe: true,
              _foraTop50: true,
            });
          }
        }

        return noStoreJson(await withSignedFotoUrl(top), { status: 200 });
      }

      // fallback live (se cron ainda não rodou)
      const totalUsuarios = await prisma.usuarioGamificacao.count({ where: { usuario: { ativo: true } } });

      const raw = await prisma.usuarioGamificacao.findMany({
        take,
        where: { usuario: { ativo: true } },
        orderBy: [{ streakAtual: 'desc' }, { pontos: 'desc' }, { usuarioId: 'asc' }],
        include: { usuario: { select: { id: true, nome: true, fotoUrl: true, ativo: true } } },
      });

      const top: ResRankingItem[] = raw.map((r, idx) => {
        const tituloInfo = getTituloPorXP(r.pontos);
        return {
          posicao: idx + 1,
          usuarioId: r.usuarioId,
          nome: r.usuario?.nome ?? 'Usuário',
          fotoUrl: r.usuario?.fotoUrl ?? null,
          valor: r.streakAtual,
          valorLabel: 'dias',
          nivel: tituloInfo?.nivel ?? 1,
          titulo: tituloInfo?.nome ?? 'Iniciante',
          xpTotal: r.pontos,
          percentil: calcPercentilAprox(idx + 1, totalUsuarios),
          isMe: r.usuarioId === usuarioId,
        };
      });

      return noStoreJson(await withSignedFotoUrl(top), { status: 200 });
    }

    // =====================================================
    // C) XP GANHO NO PERÍODO — prioriza snapshot
    // =====================================================
    const snapshot = await prisma.rankingSnapshot.findFirst({
      where: { periodo: effectivePeriodo, tipo: 'XP_GANHO' },
      orderBy: { fim: 'desc' },
      include: {
        entries: {
          orderBy: { posicao: 'asc' },
          take: takeRaw,
          include: {
            usuario: {
              select: {
                id: true,
                nome: true,
                fotoUrl: true,
                ativo: true,
                gamificacao: { select: { pontos: true } },
              },
            },
          },
        },
      },
    });

    if (snapshot) {
      const activeEntries = snapshot.entries.filter((e) => e.usuario?.ativo);
      const top: ResRankingItem[] = activeEntries.slice(0, take).map((e) => {
        const xpTotal = e.usuario.gamificacao?.pontos ?? 0;
        const tituloInfo = getTituloPorXP(xpTotal);

        return {
          posicao: e.posicao,
          usuarioId: e.usuarioId,
          nome: e.usuario.nome ?? 'Usuário',
          fotoUrl: e.usuario.fotoUrl ?? null,
          valor: e.valorInt,
          valorLabel: 'XP',
          nivel: tituloInfo?.nivel ?? 1,
          titulo: tituloInfo?.nome ?? 'Iniciante',
          xpTotal,
          percentil: e.percentil ?? calcPercentilAprox(e.posicao, snapshot.totalUsuarios),
          isMe: e.usuarioId === usuarioId,
        };
      });

      if (!top.some((x) => x.isMe)) {
        const me = await prisma.rankingEntry.findFirst({
          where: { snapshotId: snapshot.id, usuarioId },
          include: {
            usuario: {
              select: {
                id: true,
                nome: true,
                fotoUrl: true,
                ativo: true,
                gamificacao: { select: { pontos: true } },
              },
            },
          },
        });

        if (me?.usuario?.ativo && me.posicao > take) {
          const xpTotal = me.usuario.gamificacao?.pontos ?? 0;
          const tituloInfo = getTituloPorXP(xpTotal);

          top.push({
            posicao: me.posicao,
            usuarioId: me.usuarioId,
            nome: me.usuario.nome ?? 'Usuário',
            fotoUrl: me.usuario.fotoUrl ?? null,
            valor: me.valorInt,
            valorLabel: 'XP',
            nivel: tituloInfo?.nivel ?? 1,
            titulo: tituloInfo?.nome ?? 'Iniciante',
            xpTotal,
            percentil: me.percentil ?? calcPercentilAprox(me.posicao, snapshot.totalUsuarios),
            isMe: true,
            _foraTop50: true,
          });
        }
      }

      return noStoreJson(await withSignedFotoUrl(top), { status: 200 });
    }

    // fallback dinâmico (se cron ainda não rodou)
    const corte = cutoff ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // limita para usuários ativos pra evitar ranking de contas desativadas
    const idsAtivos = await prisma.usuario.findMany({
      where: { ativo: true },
      select: { id: true },
    });
    const ids = idsAtivos.map((u) => u.id);

    if (ids.length === 0) return noStoreJson([], { status: 200 });

    const agrupado = await prisma.historicoPontos.groupBy({
      by: ['usuarioId'],
      _sum: { quantidade: true },
      where: {
        usuarioId: { in: ids },
        data: { gte: corte },
        quantidade: { gt: 0 }, // XP ganho (ignora débito)
      },
      orderBy: { _sum: { quantidade: 'desc' } },
      take,
    });

    const userIds = agrupado.map((x) => x.usuarioId);
    const detalhes = await prisma.usuario.findMany({
      where: { id: { in: userIds }, ativo: true },
      select: {
        id: true,
        nome: true,
        fotoUrl: true,
        gamificacao: { select: { pontos: true } },
      },
    });

    const byId = new Map(detalhes.map((u) => [u.id, u]));
    const totalUsuarios = await prisma.usuario.count({ where: { ativo: true } });

    const response: ResRankingItem[] = agrupado.map((item, idx) => {
      const u = byId.get(item.usuarioId);
      const xpTotal = u?.gamificacao?.pontos ?? 0;
      const tituloInfo = getTituloPorXP(xpTotal);

      return {
        posicao: idx + 1,
        usuarioId: item.usuarioId,
        nome: u?.nome ?? 'Usuário',
        fotoUrl: u?.fotoUrl ?? null,
        valor: item._sum.quantidade ?? 0,
        valorLabel: 'XP',
        nivel: tituloInfo?.nivel ?? 1,
        titulo: tituloInfo?.nome ?? 'Iniciante',
        xpTotal,
        percentil: calcPercentilAprox(idx + 1, totalUsuarios),
        isMe: item.usuarioId === usuarioId,
      };
    });

    return noStoreJson(await withSignedFotoUrl(response), { status: 200 });
  } catch (error) {
    console.error('Erro ranking:', error instanceof Error ? error.message : String(error));
    return noStoreJson({ error: 'Erro interno' }, { status: 500 });
  }
}
