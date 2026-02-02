import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { csrfRateLimit } from '@/lib/ratelimit'; // Rate limit para interações de UI
import { headers } from 'next/headers';

// Força dinâmico no servidor, mas controlamos o cache no header HTTP
export const dynamic = 'force-dynamic';

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

export async function GET(request: Request) {
  try {
    const ip = await getClientIp();

    // 🛡️ 1. SEGURANÇA: Autenticação
    const session = await getSession();
    if (!session || !session.sub) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const userId = Number(session.sub);
    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });
    }

    // 🛡️ 2. SEGURANÇA: Rate Limit
    // Filtros são acionados ao clicar nas UCs. Usamos o limitador de "navegação" (15req/15s)
    // para não prejudicar a UX, mas impedir scripts de DoS.
    if (csrfRateLimit) {
      const { success, limit, reset, remaining } = await csrfRateLimit.limit(`filtros:${userId}:${ip}`);
      if (!success) {
        return NextResponse.json(
          { error: 'Muitas solicitações. Aguarde um momento.' },
          { 
            status: 429,
            headers: {
              'X-RateLimit-Limit': String(limit),
              'X-RateLimit-Remaining': String(remaining),
              'X-RateLimit-Reset': String(reset)
            }
          }
        );
      }
    }

    const { searchParams } = new URL(request.url);
    const ucsParam = searchParams.get('ucs');

    if (!ucsParam) {
      return NextResponse.json({ objetos: [], funcoes: [], capacidades: [] });
    }

    // 🛡️ 3. SEGURANÇA: Validação de Input (Anti-DoS)
    // Limita a 20 UCs para evitar queries gigantescas com "IN (...1000 IDs...)"
    const ucIds = ucsParam
      .split(',')
      .map(Number)
      .filter(n => !isNaN(n) && n > 0)
      .slice(0, 20); 

    if (ucIds.length === 0) {
      return NextResponse.json({ objetos: [], funcoes: [], capacidades: [] });
    }

    // 2. OTIMIZAÇÃO: Descobrir o Curso Técnico primeiro (Query leve)
    const referenciaUC = await prisma.unidadeCurricular.findFirst({
        where: { id: { in: ucIds } },
        select: { cursoTecnicoId: true }
    });

    const cursoId = referenciaUC?.cursoTecnicoId;

    // 3. PARALELISMO: Executar as 3 queries pesadas simultaneamente
    const [objetos, funcoes, capacidades] = await Promise.all([
        
        // A. OBJETOS DE CONHECIMENTO
        prisma.conhecimento.findMany({
            where: {
                unidadesCurriculares: {
                    some: { unidadeCurricularId: { in: ucIds } }
                }
            },
            select: { id: true, nome: true },
            orderBy: { nome: 'asc' }
        }),

        // B. FUNÇÕES TÉCNICAS (Se tivermos o curso)
        cursoId ? prisma.funcao.findMany({
            where: {
                cursos: {
                    some: { cursoTecnicoId: cursoId }
                }
            },
            select: { id: true, nome: true },
            orderBy: { nome: 'asc' }
        }) : [],

        // C. CAPACIDADES
        prisma.capacidade.findMany({
            where: {
                conhecimentos: {
                    some: {
                        conhecimento: {
                            unidadesCurriculares: {
                                some: { unidadeCurricularId: { in: ucIds } }
                            }
                        }
                    }
                }
            },
            select: { id: true, descricao: true },
            orderBy: { descricao: 'asc' }
        })
    ]);

    // 4. RESPOSTA COM CACHE (Performance HTTP)
    return NextResponse.json({
      objetos,
      funcoes,
      capacidades
    }, {
      headers: {
        // Cache privado (apenas para este usuário autenticado)
        // max-age=60: Navegador usa o cache por 1 minuto sem perguntar ao servidor
        // stale-while-revalidate=300: Aceita dados "velhos" por 5 min enquanto revalida
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=300'
      }
    });

  } catch (error) {
    console.error("Erro filtros-simulado:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Erro ao carregar filtros.' }, { status: 500 });
  }
}