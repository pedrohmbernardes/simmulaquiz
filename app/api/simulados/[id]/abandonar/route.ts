import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { verifyCSRFToken } from '@/lib/csrf';
import { csrfRateLimit } from '@/lib/ratelimit';
import { AuditAction, registrarLog } from '@/lib/audit';
import { sanitizeString } from '@/lib/sanitize';
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = await getClientIp();

  // 🛡️ 1) SEGURANÇA: Autenticação
  const session = await getSession();
  if (!session?.sub) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const userId = Number(session.sub);
  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });
  }

  // 🛡️ 2) SEGURANÇA: CSRF (CRÍTICO)
  // Impede que um link malicioso force o usuário a abandonar a prova
  const csrfHeader = request.headers.get('x-csrf-token');
  const csrfValid = await verifyCSRFToken(csrfHeader);
  
  if (!csrfValid) {
    await registrarLog({
      acao: AuditAction.SEGURANCA_CSRF_INVALIDO,
      usuarioId: userId,
      usuarioNome: session.name,
      detalhes: { ip, endpoint: '/api/simulados/[id]/abandonar' }
    });
    return NextResponse.json({ error: 'Token de segurança inválido.' }, { status: 403 });
  }

  // 🛡️ 3) SEGURANÇA: Rate Limit
  // Protege contra scripts de "griefing" (abandonar várias vezes/flood)
  if (csrfRateLimit) {
    const { success } = await csrfRateLimit.limit(`abandonar:${userId}:${ip}`);
    if (!success) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Aguarde um pouco.' },
        { status: 429 }
      );
    }
  }

  // Validação de Input
  const { id } = await params;
  const simuladoId = Number(id);
  if (!Number.isFinite(simuladoId)) {
    return NextResponse.json({ error: 'ID inválido.' }, { status: 400 });
  }

  let motivo: string | null = null;
  try {
    const body = await request.json().catch(() => ({}));
    if (body?.motivo && typeof body.motivo === 'string') {
      // Sanitiza input de texto livre para evitar XSS nos logs
      motivo = sanitizeString(body.motivo).slice(0, 200);
    }
  } catch {
    // Body é opcional
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const simulado = await tx.simulado.findUnique({
        where: { id: simuladoId },
        select: {
           id: true,
           usuarioId: true,
           status: true,
           dataInicio: true,
        }
      });

      if (!simulado) return { kind: 'not_found' as const };
      
      // 🛡️ 4) SEGURANÇA: Anti-IDOR (Acesso a recurso de terceiros)
      if (simulado.usuarioId !== userId) return { kind: 'forbidden' as const };

      if (simulado.status !== 'EM_ANDAMENTO') {
        return { kind: 'invalid_status' as const, status: simulado.status };
      }

      const now = new Date();
      let tempoGastoMinutos = 0;
      if (simulado.dataInicio) {
        const diff = now.getTime() - new Date(simulado.dataInicio).getTime();
        tempoGastoMinutos = Math.max(0, Math.floor(diff / 60000));
      }

      // Atualiza status
      const atualizado = await tx.simulado.update({
        where: { id: simuladoId },
        data: {
          status: 'ABANDONADO',
          dataConclusao: now,
          tempoGastoMinutos,
        },
      });

      return { kind: 'ok' as const, simulado: atualizado };
    });

    // Tratamento de Erros de Negócio
    if (result.kind === 'not_found') {
        return NextResponse.json({ error: 'Simulado não encontrado.' }, { status: 404 });
    }
    
    if (result.kind === 'forbidden') {
       // Loga tentativa de acesso indevido
       await registrarLog({
          acao: AuditAction.SEGURANCA_IDOR_TENTATIVA,
          usuarioId: userId,
          detalhes: { recurso: `simulado:${simuladoId}`, acao: 'abandonar' }
       });
       return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
    }

    if (result.kind === 'invalid_status') {
        return NextResponse.json(
            { error: 'Este simulado não está em andamento.', status: result.status },
            { status: 409 }
        );
    }

    // ✅ Sucesso + Auditoria
    await registrarLog({
      acao: AuditAction.SIMULADO_ABANDONAR,
      usuarioId: userId,
      usuarioNome: session.name,
      recurso: `Simulado:${simuladoId}`,
      detalhes: { 
        tempoGasto: result.simulado.tempoGastoMinutos,
        motivo 
      }
    });

    return NextResponse.json({ 
      success: true, 
      status: 'ABANDONADO',
      dataConclusao: result.simulado.dataConclusao,
      msg: 'Simulado abandonado.' 
    });

  } catch (error) {
    console.error('Erro ao abandonar simulado:', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Erro interno ao processar solicitação.' }, { status: 500 });
  }
}