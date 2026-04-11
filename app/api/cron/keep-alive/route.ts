// app/api/cron/keep-alive/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function requireCronAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = req.headers.get('authorization');
  const bearer = auth?.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  const headerSecret = (req.headers.get('x-cron-secret') ?? '').trim();

  const token = bearer || headerSecret;
  return token.length > 0 && safeEqual(token, secret);
}

export async function GET(req: NextRequest) {
  // 1. Verifica autenticação do Cron da Vercel
  if (!requireCronAuth(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    // 2. Ping no Banco de Dados (Prisma)
    await prisma.$queryRaw`SELECT 1`;

    // 3. Ping no Storage (Supabase)
    // Puxando as chaves na mesma lógica do seu lib/storage/supabase.ts
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // NOME CORRETO DO BUCKET para evitar erro 404 no ping
      await supabase.storage.from('simmulaquiz-perfis').list('', {
        limit: 1,
      });
    }

    return NextResponse.json(
      { ok: true, message: 'Keep-alive executado com sucesso no DB e Storage.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erro no cron keep-alive:', error);
    return NextResponse.json(
      { error: 'Falha ao executar o keep-alive' },
      { status: 500 }
    );
  }
}