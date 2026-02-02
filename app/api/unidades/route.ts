import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { apiRateLimit } from '@/lib/ratelimit'; // ✅ Proteção contra DoS
import { registrarLog, AuditAction } from '@/lib/audit'; // ✅ Auditoria

export const dynamic = 'force-dynamic';

// Helper de IP
async function getClientIpAsync() {
    const h = await headers();
    const xff = h.get('x-forwarded-for');
    if (xff) return xff.split(',')[0]?.trim() || '127.0.0.1';
    return h.get('x-real-ip') ?? h.get('cf-connecting-ip') ?? '127.0.0.1';
}

export async function GET(request: Request) {
  const ip = await getClientIpAsync();

  try {
    // 1. RATE LIMIT (Proteção contra scrapers)
    if (apiRateLimit) {
      const { success } = await apiRateLimit.limit(`api_unidades:${ip}`);
      if (!success) {
        await registrarLog({
            acao: AuditAction.SEGURANCA_RATE_LIMIT,
            detalhes: { rota: '/api/unidades', ip, erro: 'Excesso de requisições' }
        });
        return NextResponse.json(
            { error: 'Muitas requisições. Aguarde.' }, 
            { status: 429 }
        );
      }
    }

    // 2. SEGURANÇA: Autenticação
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // 3. CAPTURA E VALIDAÇÃO DE INPUT
    const { searchParams } = new URL(request.url);
    const cursoId = searchParams.get('cursoId');

    const whereClause: any = {};
    
    // Validação estrita do ID
    if (cursoId) {
      const idNum = Number(cursoId);
      if (!isNaN(idNum)) {
        whereClause.cursoTecnicoId = idNum;
      }
    }

    // 4. BUSCA NO BANCO (Com contagem de questões para o filtro do frontend)
    const unidades = await prisma.unidadeCurricular.findMany({
      where: whereClause,
      select: {
        id: true,
        codigo: true,
        nome: true,
        cargaHoraria: true,
        // ✅ CRÍTICO: Conta quantas questões existem para alimentar o filtro do frontend
        _count: {
            select: { questoes: true }
        }
      },
      orderBy: { codigo: 'asc' }
    });

    // 5. FORMATAÇÃO (Flattening)
    // Transforma "_count": { "questoes": 50 } em "qtdeQuestoes": 50
    const unidadesFormatadas = unidades.map(u => ({
        id: u.id,
        codigo: u.codigo,
        nome: u.nome,
        cargaHoraria: u.cargaHoraria,
        qtdeQuestoes: u._count.questoes // Campo usado no filtro do frontend
    }));
    
    // 6. RESPOSTA SEGURA (Sem Cache)
    const response = NextResponse.json(unidadesFormatadas);
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    
    return response;

  } catch (error) {
    console.error("Erro api/unidades:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Erro ao buscar unidades curriculares.' }, { status: 500 });
  }
}