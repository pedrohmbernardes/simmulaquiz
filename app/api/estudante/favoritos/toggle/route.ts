import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { z } from 'zod';
import { favoriteRateLimit } from '@/lib/ratelimit';
import { headers } from 'next/headers';
import { Prisma } from '@prisma/client';
// ✅ CORREÇÃO 1: Segurança
import { verifyCSRFToken } from '@/lib/csrf';
import { registrarLog, AuditAction } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const schema = z.object({
  questaoId: z.coerce.number().int().positive('ID inválido')
});

export async function POST(req: Request) {
  try {
    const headerList = await headers();
    const ip = headerList.get("x-forwarded-for") ?? "127.0.0.1";

    // 1. Auth (Primeiro, pois é mais rápido e barato)
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    // 🛡️ 2. CSRF (CRÍTICO)
    const csrfHeader = req.headers.get('x-csrf-token');
    const csrfOk = await verifyCSRFToken(csrfHeader);
    if (!csrfOk) {
      await registrarLog({
        acao: AuditAction.SEGURANCA_CSRF_INVALIDO,
        usuarioId: Number(session.sub),
        detalhes: { erro: 'CSRF favoritos', ip }
      });
      return NextResponse.json({ error: 'Token de segurança inválido.' }, { status: 403 });
    }

    // 🛡️ 3. Rate Limiting (Evitar spam de cliques na estrela)
    if (favoriteRateLimit) {
      const { success } = await favoriteRateLimit.limit(`fav-toggle:${Number(session.sub)}:${ip}`);
      if (!success) return NextResponse.json({ error: "Muitas ações. Aguarde." }, { status: 429 });
    }

    // 4. Validação
    const json = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(json);
    
    if (!parsed.success) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const { questaoId } = parsed.data;
    const userId = Number(session.sub);

    // 5. Verificar se já é favorito
    const existente = await prisma.questaoFavorita.findUnique({
      where: {
        usuarioId_questaoId: {
          usuarioId: userId,
          questaoId: questaoId
        }
      }
    });

    // CENÁRIO A: REMOVER (Desfavoritar)
    if (existente) {
      await prisma.questaoFavorita.delete({
        where: { id: existente.id }
      });
      return NextResponse.json({ favoritado: false });
    }

    // CENÁRIO B: ADICIONAR (Favoritar)
    
    // Verificar Limite (Regra de Negócio)
    const count = await prisma.questaoFavorita.count({
      where: { usuarioId: userId }
    });

    if (count >= 50) {
      return NextResponse.json({ 
        error: 'Limite atingido! Você só pode ter 50 favoritos.',
        limitReached: true 
      }, { status: 403 });
    }

    // Tentar criar (Trata erro se a questão não existir)
    try {
      await prisma.questaoFavorita.create({
        data: {
          usuarioId: userId,
          questaoId: questaoId
        }
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        return NextResponse.json({ error: 'Questão não encontrada.' }, { status: 404 });
      }
      throw e;
    }

    return NextResponse.json({ favoritado: true });

  } catch (error) {
    console.error("Erro em estudante/favoritos/toggle:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}