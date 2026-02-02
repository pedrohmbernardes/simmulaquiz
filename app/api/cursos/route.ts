import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { apiRateLimit } from '@/lib/ratelimit'; // ✅ Protection against DoS/Scraping
import { registrarLog, AuditAction } from '@/lib/audit'; // ✅ Security Audit

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
    // 1. RATE LIMIT (Protection against abuse)
    // Limits requests per IP/User to prevent overload
    if (apiRateLimit) {
      const { success } = await apiRateLimit.limit(`api_cursos:${ip}`);
      if (!success) {
        await registrarLog({
            acao: AuditAction.SEGURANCA_RATE_LIMIT,
            detalhes: { rota: '/api/cursos', ip, erro: 'Excesso de requisições' }
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
      await registrarLog({
          acao: AuditAction.SEGURANCA_ACESSO_NEGADO,
          detalhes: { rota: '/api/cursos', ip, erro: 'Tentativa sem sessão' }
      });
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // 3. DATABASE QUERY
    const cursos = await prisma.cursoTecnico.findMany({
      where: { ativo: true }, // ✅ Correct filtering
      select: {
        id: true,
        nome: true,
        codigo: true
      },
      orderBy: { nome: 'asc' }
    });
    
    // 4. SECURE RESPONSE (No Cache)
    const response = NextResponse.json(cursos);
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    
    return response;

  } catch (error) {
    console.error("Erro ao listar cursos:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Erro interno ao carregar cursos.' }, { status: 500 });
  }
}