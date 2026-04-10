// ARQUIVO: app/api/questoes/gerar-automatico/route.ts
// Gera uma seleção PROPORCIONAL de questões com base em filtros multi-select.
// Distribui questões proporcionalmente entre UCs (eixo primário) e Dificuldades (eixo secundário).
// Demais filtros atuam como WHERE IN (restrição, não distribuição).

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { registrarLog, AuditAction } from "@/lib/audit";
import { safeApiError, getClientIp } from "@/lib/server-utils";
import { adminContentRateLimit } from "@/lib/ratelimit";
import { verifyCSRFToken } from "@/lib/csrf";
import { NivelDificuldade, NivelCognitivo, Prisma } from "@prisma/client";

// ── Tipo da questão retornada ────────────────────────────────────
const questaoSelect = {
  id: true,
  codigo: true,
  enunciado: true,
  dificuldade: true,
  nivelCognitivo: true,
  cursoTecnico:      { select: { id: true, nome: true } },
  unidadeCurricular: { select: { id: true, nome: true } },
  funcao:            { select: { id: true, nome: true } },
  subfuncao:         { select: { id: true, nome: true } },
  conhecimento:      { select: { id: true, nome: true } },
  subConhecimento:   { select: { id: true, nome: true } },
  // CORREÇÃO: Buscando 'descricao' em vez de 'nome' na tabela Capacidade
  capacidade:        { select: { id: true, descricao: true } },
} as const;

type QuestaoResult = Prisma.QuestaoGetPayload<{ select: typeof questaoSelect }>;

// ── Schema de Validação (MULTI-SELECT) ───────────────────────────
const gerarAutomaticoSchema = z.object({
  quantidade: z
    .number()
    .int()
    .min(1, "Mínimo 1 questão")
    .max(100, "Máximo 100 questões"),

  filtros: z.object({
    // Relacionamentos: arrays de IDs (multi-select)
    cursoIds:            z.array(z.number().int().positive()).optional().default([]),
    unidadeIds:          z.array(z.number().int().positive()).optional().default([]),
    funcaoIds:           z.array(z.number().int().positive()).optional().default([]),
    subfuncaoIds:        z.array(z.number().int().positive()).optional().default([]),
    conhecimentoIds:     z.array(z.number().int().positive()).optional().default([]),
    subConhecimentoIds:  z.array(z.number().int().positive()).optional().default([]),
    capacidadeIds:       z.array(z.number().int().positive()).optional().default([]),

    // Enums: arrays (multi-select)
    dificuldades:        z.array(z.nativeEnum(NivelDificuldade)).optional().default([]),
    niveisCognitivos:    z.array(z.nativeEnum(NivelCognitivo)).optional().default([]),
  }),

  excluirIds: z.array(z.number().int().positive()).optional().default([]),
});

// ── POST Handler ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    // 1. Autenticação & RBAC
    const session = await getSession();
    if (!session || (session.role !== "PROFESSOR" && session.role !== "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // 2. CSRF Check
    const csrfToken = req.headers.get("x-csrf-token");
    if (!(await verifyCSRFToken(csrfToken))) {
      await registrarLog({
        acao: AuditAction.SEGURANCA_CSRF_INVALIDO,
        usuarioId: Number(session.sub),
        recurso: "POST /api/questoes/gerar-automatico",
      });
      return NextResponse.json(
        { error: "Sessão inválida (Token de Segurança)" },
        { status: 403 }
      );
    }

    const userId = Number(session.sub);

    // 3. Rate Limit
    const ip = await getClientIp(req);
    const { success } = await adminContentRateLimit.limit(
      `gerar_auto:${userId}:${ip}`
    );
    if (!success) {
      return NextResponse.json(
        { error: "Muitas requisições. Aguarde." },
        { status: 429 }
      );
    }

    // 4. Validação do Body
    const body = await req.json();
    const validation = gerarAutomaticoSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { quantidade, filtros, excluirIds } = validation.data;

    // 5. Monta WHERE base (restrições que se aplicam a TODAS as queries)
    const baseWhere = montarWhereBase(filtros, excluirIds);

    // 6. Contagem total disponível
    const totalDisponiveis = await prisma.questao.count({ where: baseWhere });

    // 7. Distribuição Proporcional
    const questoes = await distribuirProporcional(baseWhere, filtros, quantidade);

    // 8. Resposta
    const insuficiente = totalDisponiveis < quantidade;

    // 9. Auditoria
    await registrarLog({
      acao: AuditAction.QUESTAO_BUSCAR,
      usuarioId: userId,
      usuarioNome: session.name,
      recurso: "POST /api/questoes/gerar-automatico",
      detalhes: {
        filtros,
        quantidadeSolicitada: quantidade,
        quantidadeRetornada: questoes.length,
        totalDisponiveis,
        excluidos: excluirIds.length,
      },
    });

    // CORREÇÃO: Formatação dos dados para o contrato do Frontend
    // O frontend espera que capacidade tenha { id, nome }, mas o banco retorna { id, descricao }
    const questoesFormatadas = questoes.map((q) => {
      const { capacidade, ...rest } = q;
      return {
        ...rest,
        capacidade: capacidade ? { id: capacidade.id, nome: capacidade.descricao || "Sem descrição" } : null,
      };
    });

    return NextResponse.json({
      questoes: questoesFormatadas,
      meta: {
        solicitadas: quantidade,
        retornadas: questoes.length,
        totalDisponiveis,
        insuficiente,
      },
    });
  } catch (error) {
    return safeApiError(error, "Erro ao gerar questões automaticamente.");
  }
}

// ══════════════════════════════════════════════════════════════════
// LÓGICA DE DISTRIBUIÇÃO PROPORCIONAL
// ══════════════════════════════════════════════════════════════════

/**
 * Monta o WHERE base com todos os filtros multi-select como { in: [...] }.
 * Esse WHERE é a restrição global — todas as questões precisam satisfazê-lo.
 */
function montarWhereBase(
  filtros: z.infer<typeof gerarAutomaticoSchema>["filtros"],
  excluirIds: number[]
): Prisma.QuestaoWhereInput {
  const where: Prisma.QuestaoWhereInput = { ativa: true };

  if (filtros.cursoIds.length > 0)           where.cursoTecnicoId     = { in: filtros.cursoIds };
  if (filtros.unidadeIds.length > 0)         where.unidadeCurricularId = { in: filtros.unidadeIds };
  if (filtros.funcaoIds.length > 0)          where.funcaoId            = { in: filtros.funcaoIds };
  if (filtros.subfuncaoIds.length > 0)       where.subfuncaoId         = { in: filtros.subfuncaoIds };
  if (filtros.conhecimentoIds.length > 0)    where.conhecimentoId      = { in: filtros.conhecimentoIds };
  if (filtros.subConhecimentoIds.length > 0) where.subConhecimentoId   = { in: filtros.subConhecimentoIds };
  if (filtros.capacidadeIds.length > 0)      where.capacidadeId        = { in: filtros.capacidadeIds };
  if (filtros.dificuldades.length > 0)       where.dificuldade         = { in: filtros.dificuldades };
  if (filtros.niveisCognitivos.length > 0)   where.nivelCognitivo      = { in: filtros.niveisCognitivos };

  if (excluirIds.length > 0) {
    where.id = { notIn: excluirIds };
  }

  return where;
}

/**
 * Distribui questões proporcionalmente entre os eixos selecionados.
 *
 * HIERARQUIA DE DISTRIBUIÇÃO:
 * Eixo Primário   = Unidades Curriculares (se múltiplas selecionadas)
 * Eixo Secundário  = Dificuldade (se múltiplas selecionadas)
 * Demais filtros  = WHERE IN (restrição, não eixo de distribuição)
 *
 * Exemplo: 40 questões, 4 UCs, 5 dificuldades
 * → 10 por UC (40÷4)
 * → 2 por dificuldade por UC (10÷5)
 * → Bloom, funções etc. = filtrados mas não distribuídos
 *
 * Se um bucket fica vazio (sem questões disponíveis), suas vagas são
 * redistribuídas para outros buckets com questões restantes.
 */
async function distribuirProporcional(
  baseWhere: Prisma.QuestaoWhereInput,
  filtros: z.infer<typeof gerarAutomaticoSchema>["filtros"],
  quantidade: number
): Promise<QuestaoResult[]> {

  const eixoPrimario  = filtros.unidadeIds.length > 1 ? filtros.unidadeIds : null;
  const eixoSecundario = filtros.dificuldades.length > 1 ? filtros.dificuldades : null;

  // ── Caso simples: sem eixos de distribuição ────────────────────
  if (!eixoPrimario && !eixoSecundario) {
    return buscarAleatorias(baseWhere, quantidade);
  }

  // ── Caso com eixos: monta buckets ──────────────────────────────
  type Bucket = {
    where: Prisma.QuestaoWhereInput;
    cota: number;
  };

  const buckets: Bucket[] = [];

  if (eixoPrimario && eixoSecundario) {
    // 2 eixos: UC × Dificuldade
    const cotaPrimaria = dividirProporcional(quantidade, eixoPrimario.length);

    for (let i = 0; i < eixoPrimario.length; i++) {
      const ucId = eixoPrimario[i];
      const cotaUC = cotaPrimaria[i];
      const cotaSecundaria = dividirProporcional(cotaUC, eixoSecundario.length);

      for (let j = 0; j < eixoSecundario.length; j++) {
        buckets.push({
          where: {
            ...baseWhere,
            unidadeCurricularId: ucId,
            dificuldade: eixoSecundario[j],
          },
          cota: cotaSecundaria[j],
        });
      }
    }
  } else if (eixoPrimario) {
    // Só UC
    const cotas = dividirProporcional(quantidade, eixoPrimario.length);
    for (let i = 0; i < eixoPrimario.length; i++) {
      buckets.push({
        where: { ...baseWhere, unidadeCurricularId: eixoPrimario[i] },
        cota: cotas[i],
      });
    }
  } else if (eixoSecundario) {
    // Só Dificuldade
    const cotas = dividirProporcional(quantidade, eixoSecundario.length);
    for (let i = 0; i < eixoSecundario.length; i++) {
      buckets.push({
        where: { ...baseWhere, dificuldade: eixoSecundario[i] },
        cota: cotas[i],
      });
    }
  }

  // ── Preenche cada bucket ───────────────────────────────────────
  const resultado: QuestaoResult[] = [];
  const idsUsados = new Set<number>();
  let vagasNaoPreenchidas = 0;

  for (const bucket of buckets) {
    if (bucket.cota <= 0) continue;

    // Exclui IDs já pegos em outros buckets
    const bucketWhere = { ...bucket.where };
    if (idsUsados.size > 0) {
      const existingNotIn = (bucketWhere.id as any)?.notIn || [];
      bucketWhere.id = { notIn: [...existingNotIn, ...Array.from(idsUsados)] };
    }

    const encontradas = await buscarAleatorias(bucketWhere, bucket.cota);

    encontradas.forEach((q) => {
      resultado.push(q);
      idsUsados.add(q.id);
    });

    // Se o bucket não preencheu toda a cota, acumula vagas
    if (encontradas.length < bucket.cota) {
      vagasNaoPreenchidas += bucket.cota - encontradas.length;
    }
  }

  // ── Redistribuição: preenche vagas restantes do pool geral ─────
  if (vagasNaoPreenchidas > 0) {
    const fillWhere = { ...baseWhere };
    if (idsUsados.size > 0) {
      const existingNotIn = (fillWhere.id as any)?.notIn || [];
      fillWhere.id = { notIn: [...existingNotIn, ...Array.from(idsUsados)] };
    }

    const extras = await buscarAleatorias(fillWhere, vagasNaoPreenchidas);
    extras.forEach((q) => {
      resultado.push(q);
      idsUsados.add(q.id);
    });
  }

  // ── Shuffle final (evita agrupamento por UC/dificuldade) ───────
  return fisherYatesShuffle(resultado);
}

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Divide `total` em `partes` de forma proporcional.
 * Resto é distribuído round-robin (1ª parte pega +1, 2ª +1, etc).
 *
 * Ex: dividirProporcional(10, 3) → [4, 3, 3]
 * dividirProporcional(40, 4) → [10, 10, 10, 10]
 */
function dividirProporcional(total: number, partes: number): number[] {
  if (partes <= 0) return [];
  const base = Math.floor(total / partes);
  const resto = total % partes;
  return Array.from({ length: partes }, (_, i) => base + (i < resto ? 1 : 0));
}

/**
 * Busca questões com WHERE e retorna em ordem aleatória.
 * Pool de 3x para garantir variedade no shuffle.
 */
async function buscarAleatorias(
  where: Prisma.QuestaoWhereInput,
  quantidade: number
): Promise<QuestaoResult[]> {
  if (quantidade <= 0) return [];

  const poolSize = Math.min(quantidade * 3, 300);

  const pool = await prisma.questao.findMany({
    where,
    select: questaoSelect,
    take: poolSize,
    orderBy: { id: "desc" },
  });

  return fisherYatesShuffle(pool).slice(0, quantidade);
}

/** Fisher-Yates shuffle (in-place, retorna mesmo array). */
function fisherYatesShuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}