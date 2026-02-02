import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { expensiveOpsRateLimit } from '@/lib/ratelimit'; 
import { verifyCSRFToken } from '@/lib/csrf';
import { sanitizeObject } from '@/lib/sanitize'; 
import { headers, cookies } from 'next/headers'; // ✅ Adicionado cookies para debug
import { z } from 'zod';
import { AuditAction, registrarLog } from '@/lib/audit';
import type { Prisma } from '@prisma/client';

// --- CONSTANTES DE NEGÓCIO ---
const LIMITE_DIARIO_SIMULADOS = 12; 
const DURACAO_POR_QUESTAO_MINUTOS = 6; 
const QTDE_MIN_QUESTOES = 5;
const QTDE_MAX_QUESTOES = 50;
const QTDE_QUESTOES_SAEP = 50;

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

// --- SCHEMA ---
const simuladoSchema = z.object({
  tipo: z.enum(['CUSTOM', 'SAEP']).default('CUSTOM'),
  config: z.object({
    cursoId: z.coerce.number().int().positive('Curso inválido'),
    ucsSelecionadas: z
      .array(z.coerce.number().int().positive())
      .max(20, 'Máximo de 20 matérias permitidas por simulado')
      .default([]),
    qtdeQuestoes: z.coerce.number().int().min(QTDE_MIN_QUESTOES).max(QTDE_MAX_QUESTOES).default(10),
    dificuldade: z.preprocess(
      (v) => (v === '' ? null : v),
      z.enum(['MUITO_FACIL', 'FACIL', 'MEDIO', 'DIFICIL', 'MUITO_DIFICIL']).nullable().optional()
    ),
    nivelCognitivo: z.preprocess(
      (v) => (v === '' ? null : v),
      z.enum(['LEMBRAR', 'ENTENDER', 'APLICAR', 'ANALISAR', 'AVALIAR', 'CRIAR']).nullable().optional()
    ),
    objetosSelecionados: z.array(z.coerce.number().int().positive()).max(50).optional(),
    funcoesSelecionadas: z.array(z.coerce.number().int().positive()).max(50).optional(),
    subfuncoesSelecionadas: z.array(z.coerce.number().int().positive()).max(50).optional(),
    capacidadesSelecionadas: z.array(z.coerce.number().int().positive()).max(50).optional(),
  }),
});

export async function POST(request: Request) {
  const ip = await getClientIp();

  console.log('\n🛑 [DEBUG START] Tentativa de criar simulado');
  console.log(`📍 IP: ${ip}`);

  // 🕵️ DEBUG CRÍTICO: Ver quais cookies chegaram
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  console.log('🍪 [DEBUG] Cookies recebidos:', allCookies.map(c => `${c.name}=${c.value.substring(0, 10)}...`));

  // 🛡️ 1) SEGURANÇA: Autenticação
  const session = await getSession();
  
  if (!session?.sub) {
    console.error('❌ [DEBUG] Falha na Sessão: getSession() retornou nulo ou sem sub.');
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const userId = Number(session.sub);
  console.log(`✅ [DEBUG] Sessão válida para UserID: ${userId}`);

  if (!Number.isFinite(userId) || userId <= 0) {
    console.error(`❌ [DEBUG] UserID inválido após parse: ${session.sub}`);
    return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });
  }

  // 🛡️ 2) SEGURANÇA: CSRF
  const csrfHeader = request.headers.get('x-csrf-token');
  console.log(`🔑 [DEBUG] Header x-csrf-token recebido: ${csrfHeader ? 'SIM' : 'NÃO'} (${csrfHeader || 'vazio'})`);
  
  const csrfValid = await verifyCSRFToken(csrfHeader);
  console.log(`🛡️ [DEBUG] Resultado verifyCSRFToken: ${csrfValid}`);
  
  if (!csrfValid) {
    console.error('❌ [DEBUG] CSRF Rejeitado.');
    await registrarLog({
      acao: AuditAction.SEGURANCA_CSRF_INVALIDO,
      usuarioId: userId,
      usuarioNome: session.name,
      detalhes: { ip, endpoint: '/api/simulados', headerRecebido: csrfHeader }
    });
    return NextResponse.json({ error: 'Token de segurança inválido (CSRF).' }, { status: 403 });
  }

  // 🛡️ 3) SEGURANÇA: Rate Limiting
  if (expensiveOpsRateLimit) {
    const { success } = await expensiveOpsRateLimit.limit(`simulado_gen:${userId}:${ip}`);
    if (!success) {
      console.warn('⚠️ [DEBUG] Rate Limit atingido');
      return NextResponse.json(
        { error: 'Você está gerando simulados muito rápido. Aguarde alguns minutos.' },
        { status: 429 }
      );
    }
  }

  try {
    const ct = request.headers.get('content-type') ?? '';
    if (!ct.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type inválido.' }, { status: 415 });
    }

    // 🛡️ 4) SANITIZAÇÃO DE INPUT
    let body: unknown;
    try {
      const rawBody = await request.json();
      body = sanitizeObject(rawBody);
    } catch {
      return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
    }

    // 🛡️ 5) VALIDAÇÃO ZOD
    const resultadoValidacao = simuladoSchema.safeParse(body);
    if (!resultadoValidacao.success) {
      const erroMsg = resultadoValidacao.error.issues[0]?.message || 'Dados inválidos';
      console.error(`❌ [DEBUG] Erro de validação Zod: ${erroMsg}`);
      return NextResponse.json({ error: erroMsg }, { status: 400 });
    }

    const { tipo, config } = resultadoValidacao.data;

    // 🛡️ 6) ANTI-SPAM DIÁRIO
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const simuladosHoje = await prisma.simulado.count({
      where: { usuarioId: userId, createdAt: { gte: hoje } },
    });

    if (simuladosHoje >= LIMITE_DIARIO_SIMULADOS) {
      await registrarLog({
        acao: AuditAction.SISTEMA_ERRO,
        usuarioId: userId,
        detalhes: { erro: 'Limite diário simulados', qtd: simuladosHoje },
      });
      return NextResponse.json(
        { error: `Limite diário de ${LIMITE_DIARIO_SIMULADOS} simulados atingido.` },
        { status: 429 }
      );
    }

    // Validações de Negócio
    const cursoExiste = await prisma.cursoTecnico.findUnique({
      where: { id: config.cursoId },
      select: { id: true },
    });

    if (!cursoExiste) {
      return NextResponse.json({ error: 'Curso não encontrado.' }, { status: 404 });
    }

    const strikesMax = tipo === 'SAEP' ? 2 : 3;

    if (tipo === 'SAEP') {
      const temFiltro = Boolean(
        config.ucsSelecionadas?.length || config.dificuldade || config.nivelCognitivo ||
        config.objetosSelecionados?.length || config.funcoesSelecionadas?.length ||
        config.subfuncoesSelecionadas?.length || config.capacidadesSelecionadas?.length
      );

      if (temFiltro) {
        return NextResponse.json(
          { error: 'Simulado SAEP não aceita filtros personalizados.' },
          { status: 400 }
        );
      }
    }

    if (tipo === 'CUSTOM' && (!config.ucsSelecionadas || config.ucsSelecionadas.length < 1)) {
      return NextResponse.json({ error: 'Selecione pelo menos uma UC.' }, { status: 400 });
    }

    let ucsEfetivas: number[] = [];
    if (tipo === 'CUSTOM') {
      const ucsValidasCount = await prisma.unidadeCurricular.count({
        where: {
          id: { in: config.ucsSelecionadas },
          cursoTecnicoId: config.cursoId,
        },
      });

      if (ucsValidasCount !== config.ucsSelecionadas.length) {
         await registrarLog({
           acao: AuditAction.SEGURANCA_IDOR_TENTATIVA,
           usuarioId: userId,
           detalhes: { target: 'UCs', ids: config.ucsSelecionadas }
         });
        return NextResponse.json(
          { error: 'Matérias inválidas para este curso.' },
          { status: 400 }
        );
      }
      ucsEfetivas = config.ucsSelecionadas;
    } else {
      const ucsDoCurso = await prisma.unidadeCurricular.findMany({
        where: { cursoTecnicoId: config.cursoId },
        select: { id: true },
      });
      if (ucsDoCurso.length === 0) return NextResponse.json({ error: 'Curso sem matérias cadastradas.' }, { status: 409 });
      ucsEfetivas = ucsDoCurso.map((u) => u.id);
    }

    const qtdeDesejada = tipo === 'SAEP' ? QTDE_QUESTOES_SAEP : config.qtdeQuestoes;

    // MOTOR DE BUSCA
    const whereClause: Prisma.QuestaoWhereInput = {
      ativa: true,
      cursoTecnicoId: config.cursoId,
      unidadeCurricularId: { in: ucsEfetivas },
    };

    if (tipo === 'CUSTOM') {
      if (config.dificuldade) whereClause.dificuldade = config.dificuldade as any;
      if (config.nivelCognitivo) whereClause.nivelCognitivo = config.nivelCognitivo as any;
      if (config.objetosSelecionados?.length) whereClause.conhecimentoId = { in: config.objetosSelecionados };
      if (config.funcoesSelecionadas?.length) whereClause.funcaoId = { in: config.funcoesSelecionadas };
      if (config.subfuncoesSelecionadas?.length) whereClause.subfuncaoId = { in: config.subfuncoesSelecionadas };
      if (config.capacidadesSelecionadas?.length) whereClause.capacidadeId = { in: config.capacidadesSelecionadas };
    }

    const candidatos = await prisma.questao.findMany({
      where: whereClause,
      select: { id: true },
    });

    if (candidatos.length < qtdeDesejada) {
      return NextResponse.json(
        { error: `Questões insuficientes. Encontradas: ${candidatos.length}, Necessárias: ${qtdeDesejada}` },
        { status: 409 }
      );
    }

    // SORTEIO E CRIAÇÃO
    const embaralhados = [...candidatos];
    for (let i = embaralhados.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [embaralhados[i], embaralhados[j]] = [embaralhados[j], embaralhados[i]];
    }
    const selecionados = embaralhados.slice(0, qtdeDesejada);

    const novoSimulado = await prisma.$transaction(async (tx) => {
      return tx.simulado.create({
        data: {
          usuarioId: userId,
          tipo,
          qtdeQuestoes: qtdeDesejada,
          tempoLimiteMinutos: qtdeDesejada * DURACAO_POR_QUESTAO_MINUTOS,
          strikesUsados: 0,
          strikesMax,
          dataInicio: new Date(),
          status: 'EM_ANDAMENTO',
          simuladosQuestoes: {
            createMany: {
              data: selecionados.map((q) => ({ questaoId: q.id })),
            },
          },
        },
        select: { id: true },
      });
    });

    await registrarLog({
      acao: AuditAction.SIMULADO_INICIAR,
      usuarioId: userId,
      usuarioNome: session.name,
      recurso: `Simulado:${novoSimulado.id}`,
      detalhes: { tipo, questoes: qtdeDesejada },
    });

    console.log(`✅ [DEBUG] Simulado criado com sucesso: ID ${novoSimulado.id}`);

    return NextResponse.json({
      success: true,
      simuladoId: novoSimulado.id,
      msg: `${qtdeDesejada} questões selecionadas.`,
    });

  } catch (error) {
    console.error('❌ [DEBUG] Erro Exception:', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Erro interno ao gerar prova.' }, { status: 500 });
  }
}