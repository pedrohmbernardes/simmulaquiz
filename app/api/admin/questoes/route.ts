import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

import { registrarLog, AuditAction } from '@/lib/audit';
import { verifyCSRFToken } from '@/lib/csrf';
import { csrfRateLimit, expensiveOpsRateLimit } from '@/lib/ratelimit';
import { sanitizeObject, sanitizeString } from '@/lib/sanitize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// -----------------------------
// Helpers
// -----------------------------
function noStoreJson(data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('Pragma', 'no-cache');
  res.headers.set('Expires', '0');
  return res;
}

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]?.trim() || 'unknown';
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

function parseId(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return undefined;
  return parsed;
}

// -----------------------------
// Validation Schemas
// -----------------------------

const nullableIdSchema = z.preprocess(
  (v) => {
    if (v === '' || v === '0' || v === 0 || v === undefined || v === 'undefined' || v === null) return null;
    return v;
  },
  z.coerce.number().int().positive().nullable().optional()
);

const NivelDificuldadeEnum = z.enum(['MUITO_FACIL', 'FACIL', 'MEDIO', 'DIFICIL', 'MUITO_DIFICIL']);
const NivelCognitivoEnum = z.enum(['LEMBRAR', 'ENTENDER', 'APLICAR', 'ANALISAR', 'AVALIAR', 'CRIAR']);
const CategoriaOrigemEnum = z.enum([
  'INSTITUCIONAL_INTERNA',
  'CONCURSO_PUBLICO',
  'CONCURSO_MILITAR',
  'VESTIBULAR',
  'CERTIFICACAO',
  'OUTRO',
]);

const imagemSchema = z
  .object({
    url: z
      .string()
      .url()
      .max(2048)
      .refine((u) => u.startsWith('https://'), 'URL da imagem deve ser https'),
    filename: z.string().min(1).max(255).transform((v) => sanitizeString(v)),
    mimeType: z
      .string()
      .min(3)
      .max(100)
      .transform((v) => sanitizeString(v))
      .refine((v) => v.startsWith("image/"), "mimeType inválido (deve ser image/*)"),
    size: z.number().int().positive().max(10 * 1024 * 1024), // 10MB
  })
  // .strict() // Removido strict daqui também por segurança, mas imagem geralmente é controlada
  .passthrough(); 

const questaoSchema = z
  .object({
    // Conteúdo Base
    enunciado: z.string().min(15).max(6000).transform((v) => sanitizeString(v)),
    alternativaA: z.string().min(1).max(1500).transform((v) => sanitizeString(v)),
    alternativaB: z.string().min(1).max(1500).transform((v) => sanitizeString(v)),
    alternativaC: z.string().min(1).max(1500).transform((v) => sanitizeString(v)),
    alternativaD: z.string().min(1).max(1500).transform((v) => sanitizeString(v)),
    alternativaE: z.string().min(1).max(1500).transform((v) => sanitizeString(v)),
    alternativaCorreta: z.string().trim().toLowerCase().regex(/^[a-e]$/, 'Selecione a alternativa correta (a-e)'),
    ativa: z.boolean().default(true).optional(),

    // Classificação & Dificuldade
    dificuldade: NivelDificuldadeEnum.default('MEDIO'),
    nivelCognitivo: NivelCognitivoEnum.default('APLICAR'),

    // IDs
    cursoTecnicoId: nullableIdSchema,
    unidadeCurricularId: nullableIdSchema,
    objetoConhecimentoId: nullableIdSchema,
    subConhecimentoId: nullableIdSchema,

    funcaoId: nullableIdSchema,
    subfuncaoId: nullableIdSchema,
    capacidadeId: nullableIdSchema,

    // Origem & Contexto
    categoriaOrigem: CategoriaOrigemEnum.default('INSTITUCIONAL_INTERNA'),
    instituicaoId: nullableIdSchema,
    bancaId: nullableIdSchema,
    ano: z.coerce.number().int().min(1900).max(2100).nullable().optional(),
    prova: z.string().max(255).nullable().optional().transform((v) => (v ? sanitizeString(v) : v)),

    // Imagem (opcional)
    imagem: imagemSchema.nullable().optional(),
    
    // Palavras Chave
    palavrasChave: z.string().max(500).optional().nullable()
  })
  // .strict()  <--- REMOVIDO: O culpado do erro!
  // Ao remover o strict, o Zod ignora campos extras como "quantidade" que vêm do frontend
  .superRefine((val, ctx) => {
    // Se subConhecimento veio (e não é null), precisa de objetoConhecimento
    if (val.subConhecimentoId && !val.objetoConhecimentoId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['subConhecimentoId'],
        message: 'Subconhecimento exige Objeto de Conhecimento.',
      });
    }
    // Se subfunção veio (e não é null), precisa de função
    if (val.subfuncaoId && !val.funcaoId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['subfuncaoId'],
        message: 'Subfunção exige Função.',
      });
    }
  });

function requireAdminOrProfessor(session: any) {
  return session && (session.role === 'SUPER_ADMIN' || session.role === 'PROFESSOR');
}

function getUserIdFromSession(session: any): number | null {
  const n = Number(session?.sub ?? session?.userId);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

// ==========================================
// GET: LISTAR QUESTÕES
// ==========================================
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!requireAdminOrProfessor(session)) {
    return noStoreJson({ error: 'Acesso negado.' }, { status: 403 });
  }

  const userId = getUserIdFromSession(session);
  if (!userId) return noStoreJson({ error: 'Sessão inválida.' }, { status: 401 });

  const ip = getClientIp(req);

  const rl = await csrfRateLimit.limit(`admin-questoes:list:${userId}:${ip}`);
  if (!rl.success) {
    return noStoreJson({ error: 'Muitas requisições. Aguarde alguns instantes.' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);

  const page = parseId(searchParams.get('page')) || 1;
  const limit = 50;
  const skip = (page - 1) * limit;

  const where: Prisma.QuestaoWhereInput = {};

  const filtroRaw = sanitizeString(searchParams.get('filtro') || '').slice(0, 160);
  const filtroTexto = filtroRaw.trim();
  const isBuscaIdExata = filtroTexto.startsWith('#');
  const filtroIdBusca = parseId(isBuscaIdExata ? filtroTexto.substring(1) : filtroTexto);

  if (isBuscaIdExata && filtroIdBusca) {
    where.id = filtroIdBusca;
  } else if (filtroTexto.length >= 2) {
    where.OR = [
      { enunciado: { contains: filtroTexto, mode: 'insensitive' } },
      { codigo: { contains: filtroTexto, mode: 'insensitive' } },
      ...(filtroIdBusca ? [{ id: filtroIdBusca }] : []),
    ];
  }

  const statusParam = searchParams.get('status');
  if (statusParam === 'ativas') where.ativa = true;
  else if (statusParam === 'inativas') where.ativa = false;

  const cursoId = parseId(searchParams.get('cursoId'));
  if (cursoId) where.cursoTecnicoId = cursoId;

  const ucId = parseId(searchParams.get('ucId'));
  if (ucId) where.unidadeCurricularId = ucId;

  const objetoId = parseId(searchParams.get('objetoId'));
  if (objetoId) where.conhecimentoId = objetoId;

  const subConhecimentoId = parseId(searchParams.get('subConhecimentoId'));
  if (subConhecimentoId) where.subConhecimentoId = subConhecimentoId;

  const funcaoId = parseId(searchParams.get('funcaoId'));
  if (funcaoId) where.funcaoId = funcaoId;

  const subfuncaoId = parseId(searchParams.get('subfuncaoId'));
  if (subfuncaoId) where.subfuncaoId = subfuncaoId;

  const capacidadeId = parseId(searchParams.get('capacidadeId'));
  if (capacidadeId) where.capacidadeId = capacidadeId;

  const instituicaoId = parseId(searchParams.get('instituicaoId'));
  if (instituicaoId) where.instituicaoId = instituicaoId;

  const bancaId = parseId(searchParams.get('bancaId'));
  if (bancaId) where.bancaId = bancaId;

  const ano = parseId(searchParams.get('ano'));
  if (ano) where.ano = ano;

  const dificuldade = searchParams.get('dificuldade');
  if (dificuldade && NivelDificuldadeEnum.options.includes(dificuldade as any)) {
    where.dificuldade = dificuldade as any;
  }

  const nivelCognitivo = searchParams.get('nivelCognitivo');
  if (nivelCognitivo && NivelCognitivoEnum.options.includes(nivelCognitivo as any)) {
    where.nivelCognitivo = nivelCognitivo as any;
  }

  try {
    const questoes = await prisma.questao.findMany({
      where,
      include: {
        unidadeCurricular: { select: { nome: true, codigo: true } },
        cursoTecnico: { select: { nome: true, codigo: true } },
        conhecimento: { select: { nome: true, codigo: true } },
        subConhecimento: { select: { nome: true, codigo: true } },
        funcao: { select: { codigo: true, nome: true } },
        subfuncao: { select: { codigo: true, nome: true } },
        capacidade: { select: { sigla: true, descricao: true } },
        instituicao: { select: { sigla: true, nome: true } },
        banca: { select: { sigla: true, nome: true } },
        imagens: { select: { id: true, url: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
    });

    return noStoreJson({ data: questoes, meta: { page, limit } }, { status: 200 });
  } catch (error) {
    console.error('Erro em /api/admin/questoes (GET):', error instanceof Error ? error.message : String(error));
    return noStoreJson({ error: 'Erro ao buscar questões.' }, { status: 500 });
  }
}

// ==========================================
// POST: CRIAR QUESTÃO
// ==========================================
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!requireAdminOrProfessor(session)) {
    return noStoreJson({ error: 'Acesso negado.' }, { status: 403 });
  }

  const userId = getUserIdFromSession(session);
  if (!userId) return noStoreJson({ error: 'Sessão inválida.' }, { status: 401 });

  const ip = getClientIp(req);
  const userAgent = req.headers.get('user-agent') || undefined;

  try {
    // 1) CSRF
    const csrfHeader = req.headers.get('x-csrf-token');
    const csrfOk = await verifyCSRFToken(csrfHeader);
    if (!csrfOk) {
      return noStoreJson({ error: 'Token de segurança inválido ou expirado. Recarregue a página.' }, { status: 403 });
    }

    // 2) Rate limit
    const rl = await expensiveOpsRateLimit.limit(`admin-questoes:create:${userId}:${ip}`);
    if (!rl.success) {
      return noStoreJson({ error: 'Muitas requisições. Aguarde e tente novamente.' }, { status: 429 });
    }

    // 3) Parse + sanitize + validate
    const bodyRaw = await req.json().catch(() => ({}));
    const body = sanitizeObject(bodyRaw);
    const validacao = questaoSchema.safeParse(body);

    if (!validacao.success) {
      // ✅ CORREÇÃO NO LOG DE ERRO: Flatten completo para pegar erros globais que antes ficavam escondidos
      const errors = validacao.error.flatten();
      const allErrors = { ...errors.fieldErrors, ...{ global: errors.formErrors } };
      
      console.error("Erro Validação Zod:", JSON.stringify(allErrors)); // Debug no servidor

      return noStoreJson(
        { error: 'Dados inválidos', details: allErrors },
        { status: 400 }
      );
    }

    const { imagem, objetoConhecimentoId, palavrasChave, ...dadosQuestao } = validacao.data;

    // 4) Validação de coerência dos vínculos (defesa em profundidade)
    const checks: Array<Promise<any>> = [];

    if (dadosQuestao.cursoTecnicoId) {
      checks.push(prisma.cursoTecnico.findUnique({ where: { id: dadosQuestao.cursoTecnicoId } }));
    } else checks.push(Promise.resolve(null));

    if (dadosQuestao.unidadeCurricularId) {
      checks.push(prisma.unidadeCurricular.findUnique({ where: { id: dadosQuestao.unidadeCurricularId }, select: { id: true, cursoTecnicoId: true } }));
    } else checks.push(Promise.resolve(null));

    if (objetoConhecimentoId) {
      checks.push(prisma.conhecimento.findUnique({ where: { id: objetoConhecimentoId } }));
    } else checks.push(Promise.resolve(null));

    if (dadosQuestao.subConhecimentoId) {
      checks.push(prisma.subConhecimento.findUnique({ where: { id: dadosQuestao.subConhecimentoId }, select: { id: true, conhecimentoId: true } }));
    } else checks.push(Promise.resolve(null));

    if (dadosQuestao.funcaoId) {
      checks.push(prisma.funcao.findUnique({ where: { id: dadosQuestao.funcaoId } }));
    } else checks.push(Promise.resolve(null));

    if (dadosQuestao.subfuncaoId) {
      checks.push(prisma.subfuncao.findUnique({ where: { id: dadosQuestao.subfuncaoId }, select: { id: true, funcaoId: true } }));
    } else checks.push(Promise.resolve(null));

    if (dadosQuestao.capacidadeId) {
      checks.push(prisma.capacidade.findUnique({ where: { id: dadosQuestao.capacidadeId } }));
    } else checks.push(Promise.resolve(null));

    if (dadosQuestao.instituicaoId) {
      checks.push(prisma.instituicao.findFirst({ where: { id: dadosQuestao.instituicaoId, ativo: true } }));
    } else checks.push(Promise.resolve(null));

    if (dadosQuestao.bancaId) {
      checks.push(prisma.banca.findFirst({ where: { id: dadosQuestao.bancaId, ativo: true } }));
    } else checks.push(Promise.resolve(null));

    const [curso, uc, objeto, sub, funcao, subfuncao, capacidade, instituicao, banca] = await Promise.all(checks);

    if (dadosQuestao.cursoTecnicoId && !curso) return noStoreJson({ error: 'Curso Técnico inválido.' }, { status: 400 });
    if (dadosQuestao.unidadeCurricularId && !uc) return noStoreJson({ error: 'Unidade Curricular inválida.' }, { status: 400 });
    if (objetoConhecimentoId && !objeto) return noStoreJson({ error: 'Objeto de Conhecimento inválido.' }, { status: 400 });
    if (dadosQuestao.subConhecimentoId && !sub) return noStoreJson({ error: 'Subconhecimento inválido.' }, { status: 400 });
    if (dadosQuestao.funcaoId && !funcao) return noStoreJson({ error: 'Função inválida.' }, { status: 400 });
    if (dadosQuestao.subfuncaoId && !subfuncao) return noStoreJson({ error: 'Subfunção inválida.' }, { status: 400 });
    if (dadosQuestao.capacidadeId && !capacidade) return noStoreJson({ error: 'Capacidade inválida.' }, { status: 400 });
    if (dadosQuestao.instituicaoId && !instituicao) return noStoreJson({ error: 'Instituição inválida ou inativa.' }, { status: 400 });
    if (dadosQuestao.bancaId && !banca) return noStoreJson({ error: 'Banca inválida ou inativa.' }, { status: 400 });

    // Validação de relacionamentos diretos
    if (uc && dadosQuestao.cursoTecnicoId && uc.cursoTecnicoId !== dadosQuestao.cursoTecnicoId) {
      return noStoreJson({ error: 'Unidade Curricular não pertence ao Curso Técnico informado.' }, { status: 400 });
    }
    if (sub && objetoConhecimentoId && sub.conhecimentoId !== objetoConhecimentoId) {
      return noStoreJson({ error: 'Subconhecimento não pertence ao Objeto de Conhecimento informado.' }, { status: 400 });
    }
    if (subfuncao && dadosQuestao.funcaoId && subfuncao.funcaoId !== dadosQuestao.funcaoId) {
      return noStoreJson({ error: 'Subfunção não pertence à Função informada.' }, { status: 400 });
    }

    // 5) Persistência
    const v = validacao.data;

    // Trata palavras-chave
    const listaPalavras = palavrasChave 
        ? palavrasChave.split(/[,;]+/).map(s => s.trim()).filter(Boolean) 
        : [];

    const createData: Prisma.QuestaoUncheckedCreateInput = {
      enunciado: v.enunciado,
      alternativaA: v.alternativaA,
      alternativaB: v.alternativaB,
      alternativaC: v.alternativaC,
      alternativaD: v.alternativaD,
      alternativaE: v.alternativaE,
      alternativaCorreta: v.alternativaCorreta.trim().toLowerCase(),

      ativa: v.ativa ?? true,
      dificuldade: v.dificuldade,
      nivelCognitivo: v.nivelCognitivo,
      categoriaOrigem: v.categoriaOrigem,

      palavrasChave: listaPalavras,

      instituicaoId: v.instituicaoId ?? null,
      bancaId: v.bancaId ?? null,
      ano: v.ano ?? null,
      prova: v.prova ?? null,

      cursoTecnicoId: v.cursoTecnicoId ?? null,
      unidadeCurricularId: v.unidadeCurricularId ?? null,
      conhecimentoId: v.objetoConhecimentoId ?? null,
      subConhecimentoId: v.subConhecimentoId ?? null,

      funcaoId: v.funcaoId ?? null,
      subfuncaoId: v.subfuncaoId ?? null,
      capacidadeId: v.capacidadeId ?? null,
    };

    const novaQuestao = await prisma.$transaction(async (tx) => {
      const questao = await tx.questao.create({ data: createData });

      if (v.imagem?.url) {
        await tx.imagemQuestao.create({
          data: {
            url: v.imagem.url,
            filename: v.imagem.filename,
            mimeType: v.imagem.mimeType,
            size: v.imagem.size,
            questaoId: questao.id,
          },
        });
      }
      return questao;
    });

    await registrarLog({
      acao: AuditAction.QUESTAO_CRIAR,
      usuarioId: userId,
      usuarioNome: session?.name ?? undefined,
      recurso: `Questao:${novaQuestao.id}`,
      ip,
      userAgent,
      detalhes: { origem: 'IA' }, // Simplificado para log
    }).catch(() => {});

    return noStoreJson(novaQuestao, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return noStoreJson({ error: 'Registro duplicado (chave única). Verifique os dados.' }, { status: 409 });
    }
    console.error('Erro em /api/admin/questoes (POST):', error instanceof Error ? error.message : String(error));
    return noStoreJson({ error: 'Falha ao salvar questão.' }, { status: 500 });
  }
}