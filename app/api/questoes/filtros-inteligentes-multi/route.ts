// ARQUIVO: app/api/questoes/filtros-inteligentes-multi/route.ts
// Versão multi-select dos filtros cascata.
// Aceita arrays via query params separados por vírgula.
// Rota NOVA — NÃO substitui /api/questoes/filtros-inteligentes (usada pelo fluxo manual).

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { searchFilterRateLimitMultiSelect } from "@/lib/ratelimit"; // ✅ NOVO: Importando limitador de navegação/filtros

// ── Helpers ──────────────────────────────────────────────────────

/** Converte "1,2,3" em [1, 2, 3]. Ignora valores inválidos e "TODAS". */
function parseIntArray(raw: string | null): number[] {
  if (!raw || raw === "TODAS") return [];
  return raw
    .split(",")
    .map((s) => parseInt(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}

/** Converte "FACIL,MEDIO" em ["FACIL","MEDIO"]. Ignora "TODAS". */
function parseStringArray(raw: string | null): string[] {
  if (!raw || raw === "TODAS") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Aplica filtro `{ in: [...] }` no where se o array não estiver vazio. */
function applyIntFilter(
  where: Prisma.QuestaoWhereInput,
  field: keyof Prisma.QuestaoWhereInput,
  ids: number[]
) {
  if (ids.length > 0) {
    (where as any)[field] = { in: ids };
  }
}

// ── GET Handler ──────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !["PROFESSOR", "SUPER_ADMIN"].includes(session.role)) {
    return NextResponse.json({}, { status: 403 });
  }

  // ✅ Rate Limit de Filtros (Permite rajadas rápidas de navegação de UI, mas bloqueia bots)
  const rlKey = `filtros_multi:${session.sub}`;
  const rl = await searchFilterRateLimitMultiSelect.limit(rlKey);
  if (!rl.success) {
    return NextResponse.json({ error: "Muitas consultas seguidas. Aguarde um instante." }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);

  // Captura arrays de IDs (vírgula-separados)
  const cursoIds     = parseIntArray(searchParams.get("cursoIds"));
  const unidadeIds   = parseIntArray(searchParams.get("unidadeIds"));
  const funcaoIds    = parseIntArray(searchParams.get("funcaoIds"));
  const subfuncaoIds = parseIntArray(searchParams.get("subfuncaoIds"));

  // Base: apenas questões ativas
  const baseWhere: Prisma.QuestaoWhereInput = { ativa: true };

  // ── 1. CURSOS (sem filtro — mostra todos com questões ativas) ──
  const cursosRaw = await prisma.questao.findMany({
    where: baseWhere,
    select: { cursoTecnico: { select: { id: true, nome: true } } },
    distinct: ["cursoTecnicoId"],
  });
  const cursos = (cursosRaw
    .map((q) => q.cursoTecnico)
    .filter(Boolean) as { id: number; nome: string }[])
    .sort((a, b) => a.nome.localeCompare(b.nome));

  // ── 2. UNIDADES (filtradas por cursos selecionados) ────────────
  const whereUnidade: Prisma.QuestaoWhereInput = { ...baseWhere };
  applyIntFilter(whereUnidade, "cursoTecnicoId", cursoIds);

  const unidadesRaw = await prisma.questao.findMany({
    where: whereUnidade,
    select: { unidadeCurricular: { select: { id: true, nome: true } } },
    distinct: ["unidadeCurricularId"],
  });
  const unidades = (unidadesRaw
    .map((q) => q.unidadeCurricular)
    .filter(Boolean) as { id: number; nome: string }[])
    .sort((a, b) => a.nome.localeCompare(b.nome));

  // ── 3. FUNÇÕES (filtradas por cursos + unidades) ───────────────
  const whereFuncao: Prisma.QuestaoWhereInput = { ...whereUnidade };
  applyIntFilter(whereFuncao, "unidadeCurricularId", unidadeIds);

  const funcoesRaw = await prisma.questao.findMany({
    where: whereFuncao,
    select: { funcao: { select: { id: true, nome: true } } },
    distinct: ["funcaoId"],
  });
  const funcoes = (funcoesRaw
    .map((q) => q.funcao)
    .filter(Boolean) as { id: number; nome: string }[])
    .sort((a, b) => a.nome.localeCompare(b.nome));

  // ── 4. SUBFUNÇÕES (filtradas por cursos + unidades + funções) ──
  const whereSub: Prisma.QuestaoWhereInput = { ...whereFuncao };
  applyIntFilter(whereSub, "funcaoId", funcaoIds);

  const subfuncoesRaw = await prisma.questao.findMany({
    where: whereSub,
    select: { subfuncao: { select: { id: true, nome: true } } },
    distinct: ["subfuncaoId"],
  });
  const subfuncoes = (subfuncoesRaw
    .map((q) => q.subfuncao)
    .filter(Boolean) as { id: number; nome: string }[])
    .sort((a, b) => a.nome.localeCompare(b.nome));

  // ── 5. CONHECIMENTOS (cascata completa) ────────────────────────
  const whereConhecimento: Prisma.QuestaoWhereInput = { ...whereSub };
  applyIntFilter(whereConhecimento, "subfuncaoId", subfuncaoIds);

  const conhecimentosRaw = await prisma.questao.findMany({
    where: whereConhecimento,
    select: { conhecimento: { select: { id: true, nome: true } } },
    distinct: ["conhecimentoId"],
  });
  const conhecimentos = (conhecimentosRaw
    .map((q) => q.conhecimento)
    .filter(Boolean) as { id: number; nome: string }[])
    .sort((a, b) => a.nome.localeCompare(b.nome));

  // ── 6. SUBCONHECIMENTOS (cascata completa + conhecimentos) ─────
  const whereSubConhecimento: Prisma.QuestaoWhereInput = { ...whereConhecimento };
  const conhecimentoIds = parseIntArray(searchParams.get("conhecimentoIds"));
  applyIntFilter(whereSubConhecimento, "conhecimentoId", conhecimentoIds);

  const subConhecimentosRaw = await prisma.questao.findMany({
    where: whereSubConhecimento,
    select: { subConhecimento: { select: { id: true, nome: true } } },
    distinct: ["subConhecimentoId"],
  });
  const subConhecimentos = (subConhecimentosRaw
    .map((q) => q.subConhecimento)
    .filter(Boolean) as { id: number; nome: string }[])
    .sort((a, b) => a.nome.localeCompare(b.nome));

  // ── 7. CAPACIDADES (CORRIGIDO: usando 'descricao' em vez de 'nome') ──
  const capacidadesRaw = await prisma.questao.findMany({
    where: whereSubConhecimento,
    select: { capacidade: { select: { id: true, descricao: true } } },
    distinct: ["capacidadeId"],
  });
  const capacidades = (capacidadesRaw
    .map((q) => q.capacidade ? { id: q.capacidade.id, nome: q.capacidade.descricao || "Sem descrição" } : null)
    .filter(Boolean) as { id: number; nome: string }[])
    .sort((a, b) => a.nome.localeCompare(b.nome));

  // ── 8. CONTAGEM de questões disponíveis com filtros atuais ─────
  // Útil para o frontend mostrar "X questões disponíveis"
  const fullWhere: Prisma.QuestaoWhereInput = { ...whereSubConhecimento };
  applyIntFilter(fullWhere, "conhecimentoId", conhecimentoIds);

  const dificuldades = parseStringArray(searchParams.get("dificuldades"));
  if (dificuldades.length > 0) {
    (fullWhere as any).dificuldade = { in: dificuldades };
  }

  const niveisCognitivos = parseStringArray(searchParams.get("niveisCognitivos"));
  if (niveisCognitivos.length > 0) {
    (fullWhere as any).nivelCognitivo = { in: niveisCognitivos };
  }

  const totalDisponiveis = await prisma.questao.count({ where: fullWhere });

  return NextResponse.json({
    cursos,
    unidades,
    funcoes,
    subfuncoes,
    conhecimentos,
    subConhecimentos,
    capacidades,
    totalDisponiveis,
  });
}