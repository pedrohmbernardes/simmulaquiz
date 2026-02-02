import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { csrfRateLimit } from '@/lib/ratelimit'; // Rate limit leve para navegação
import { headers } from 'next/headers';

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

    // 🛡️ 1. SEGURANÇA: Autenticação Rigorosa
    const session = await getSession();
    if (!session || !session.sub) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const userId = Number(session.sub);
    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });
    }

    // 🛡️ 2. SEGURANÇA: Rate Limit (Anti-Scraping)
    // Impede que scripts varram o histórico completo em segundos
    if (csrfRateLimit) {
      const { success, limit, reset, remaining } = await csrfRateLimit.limit(`historico:${userId}:${ip}`);
      if (!success) {
        return NextResponse.json(
          { error: 'Muitas requisições. Aguarde um momento.' },
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

    // 🛡️ 3. PAGINAÇÃO SEGURA (Evita dump de banco)
    const { searchParams } = new URL(request.url);
    
    // Page: mínimo 1
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    
    // Limit: mínimo 1, máximo 50 (Hard limit para proteger memória)
    const limit = Math.max(1, Math.min(50, Number(searchParams.get('limit')) || 20));
    
    const skip = (page - 1) * limit;

    // 🛡️ 4. CONSULTA OTIMIZADA
    // Transaction para pegar dados + total de forma consistente
    const [total, historico] = await prisma.$transaction([
      prisma.simulado.count({
        where: { usuarioId: userId }
      }),
      prisma.simulado.findMany({
        where: { usuarioId: userId }, // Anti-IDOR
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: skip,
        select: {
          id: true,
          tipo: true,
          status: true,
          createdAt: true,
          dataConclusao: true,
          notaAcertos: true,
          notaPercentual: true,
          qtdeQuestoes: true,
          tempoLimiteMinutos: true,
          tempoGastoMinutos: true
        }
      })
    ]);

    // Retorna dados + metadados para paginação
    return NextResponse.json({
      data: historico,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("Erro em estudante/historico:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Erro ao buscar histórico.' }, { status: 500 });
  }
}