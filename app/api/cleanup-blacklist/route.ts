import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { headers } from 'next/headers';
import { AuditAction, registrarLog } from '@/lib/audit';
import { getSession } from '@/lib/auth';
import { expensiveOpsRateLimit } from '@/lib/ratelimit';

// Força a rota a ser dinâmica para não ser cacheada estaticamente
export const dynamic = 'force-dynamic';

/**
 * Rota de Manutenção Automática (Cron Job)
 * Objetivo: Limpar tokens expirados da Blacklist para evitar inchaço do banco.
 * Segurança: Protegida por CRON_SECRET (Bearer Token) OU Sessão SUPER_ADMIN
 */
export async function GET(request: Request) {
  try {
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    const ip = headersList.get("x-forwarded-for") ?? "127.0.0.1";
    
    // Configurações
    const CRON_SECRET = process.env.CRON_SECRET;
    
    // --- 🛡️ 1. VERIFICAÇÃO DE AUTENTICAÇÃO HÍBRIDA ---
    let isAuthorized = false;
    let actor = 'Unknown';

    // A) Verifica CRON_SECRET (Prioridade para Automação)
    if (CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`) {
        isAuthorized = true;
        actor = 'System Cron';
    } 
    // B) Verifica Sessão ADMIN (Fallback para execução manual)
    else {
        const session = await getSession();
        if (session && session.role === 'SUPER_ADMIN') {
            isAuthorized = true;
            actor = `Admin: ${session.name}`;
        }
    }

    if (!isAuthorized) {
        // Log de tentativa falha para monitoramento
        console.warn(`[Security] Tentativa não autorizada em cleanup-blacklist IP: ${ip}`);
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // --- 🛡️ 2. RATE LIMITING (Defense in Depth) ---
    // Mesmo autorizado, evita loops infinitos ou abuso que trave o banco
    if (expensiveOpsRateLimit) {
        // Chave única para o Cron ou por usuário admin
        const rateLimitKey = actor === 'System Cron' ? 'cron_cleanup_global' : `cleanup:${actor}`;
        const { success } = await expensiveOpsRateLimit.limit(rateLimitKey);
        
        if (!success) {
            return NextResponse.json(
                { error: 'Manutenção já executada recentemente. Aguarde.' }, 
                { status: 429 }
            );
        }
    }

    const inicio = Date.now();
    const agora = new Date();

    // --- 3. EXECUÇÃO (Operação Atômica) ---
    // Deleta registros onde a data de expiração (expiresAt) é menor que agora
    const resultado = await prisma.tokenBlacklist.deleteMany({
      where: {
        expiresAt: {
          lt: agora 
        }
      }
    });

    const fim = Date.now();
    const duracao = fim - inicio;

    // --- 4. AUDITORIA ---
    // Registra apenas se houve limpeza efetiva ou se foi acionado manualmente
    if (resultado.count > 0 || actor !== 'System Cron') {
        await registrarLog({
            acao: AuditAction.CLEANUP_BLACKLIST, // Ação correta do seu audit.ts
            usuarioId: actor === 'System Cron' ? undefined : 1, // ID 1 ou null para sistema
            usuarioNome: actor,
            detalhes: {
                evento: 'Limpeza de Tokens Expirados',
                removidos: resultado.count,
                duracaoMs: duracao,
                modo: actor === 'System Cron' ? 'Automático' : 'Manual'
            }
        });
    }

    return NextResponse.json({
      success: true,
      deletedCount: resultado.count,
      durationMs: duracao,
      executedBy: actor,
      timestamp: agora.toISOString()
    });

  } catch (error) {
    console.error("Erro crítico em cleanup-blacklist:", error instanceof Error ? error.message : String(error));
    // Retorna erro genérico para não vazar stack trace
    return NextResponse.json({ error: 'Falha na execução do processo de limpeza' }, { status: 500 });
  }
}