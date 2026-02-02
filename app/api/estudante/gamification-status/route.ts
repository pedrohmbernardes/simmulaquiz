import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { calcularProgressoNivel } from '@/lib/gamificacao/nivel';
import { apiRateLimit } from '@/lib/ratelimit'; // ✅ Protection against DoS/Farming
import { registrarLog, AuditAction } from '@/lib/audit'; // ✅ Audit

export const dynamic = 'force-dynamic';

// Helper for IP (Standardized)
async function getClientIpAsync() {
    const h = await headers();
    const xff = h.get('x-forwarded-for');
    if (xff) return xff.split(',')[0]?.trim() || '127.0.0.1';
    return h.get('x-real-ip') ?? h.get('cf-connecting-ip') ?? '127.0.0.1';
}

export async function GET() {
  const ip = await getClientIpAsync();

  try {
    // 1. RATE LIMIT (Protection against XP Farming / DoS)
    if (apiRateLimit) {
      // Limit slightly higher than critical routes, as the frontend polls this
      const { success } = await apiRateLimit.limit(`api_gamificacao:${ip}`);
      if (!success) {
        await registrarLog({
            acao: AuditAction.SEGURANCA_RATE_LIMIT,
            detalhes: { rota: '/api/estudante/gamification-status', ip, erro: 'Excesso de requisições' }
        });
        return NextResponse.json(
            { error: 'Muitas requisições. Tente novamente em breve.' }, 
            { status: 429 }
        );
      }
    }

    // 2. SECURITY: Authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const userId = Number(session.sub);
    
    // 3. DATABASE QUERY
    const perfil = await prisma.usuarioGamificacao.findUnique({
      where: { usuarioId: userId },
      select: {
        streakAtual: true,
        pontos: true,
      }
    });

    // Calculates level progress
    const progresso = await calcularProgressoNivel(userId);

    // 4. SECURE RESPONSE (No Cache)
    const response = NextResponse.json({
      streak: perfil?.streakAtual || 0,
      pontos: perfil?.pontos || 0,
      progresso
    });

    // Prevents browser caching to ensure XP/Level is always current
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    return response;

  } catch (error) {
    console.error("Erro gamification-status:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Erro ao carregar status' }, { status: 500 });
  }
}