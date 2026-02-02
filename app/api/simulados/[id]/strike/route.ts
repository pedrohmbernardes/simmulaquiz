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
  // Impede que terceiros enviem strikes em nome do usuário
  const csrfHeader = request.headers.get('x-csrf-token');
  const csrfValid = await verifyCSRFToken(csrfHeader);

  if (!csrfValid) {
    await registrarLog({
      acao: AuditAction.SEGURANCA_CSRF_INVALIDO,
      usuarioId: userId,
      usuarioNome: session.name,
      detalhes: { ip, endpoint: '/api/simulados/[id]/strike' }
    });
    return NextResponse.json({ error: 'Token de segurança inválido.' }, { status: 403 });
  }

  // 🛡️ 3) SEGURANÇA: Rate Limit
  // Evita flood de strikes (ex: bug no front ou ataque de repetição)
  // Usamos csrfRateLimit (15 reqs/15s) pois strikes são eventos de UI rápidos
  if (csrfRateLimit) {
    const { success } = await csrfRateLimit.limit(`strike:${userId}:${ip}`);
    if (!success) {
      return NextResponse.json(
        { error: 'Muitas requisições. Aguarde um instante.' },
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

  // Sanitização do Motivo (Body Opcional)
  let motivo: string | null = null;
  try {
    const body = await request.json().catch(() => ({}));
    if (body?.motivo && typeof body.motivo === 'string') {
      motivo = sanitizeString(body.motivo).slice(0, 150); // Limita tamanho
    }
  } catch {
    // Body vazio é aceitável
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const simulado = await tx.simulado.findUnique({
        where: { id: simuladoId },
        select: {
          id: true,
          usuarioId: true,
          status: true,
          strikesUsados: true,
          strikesMax: true,
        },
      });

      if (!simulado) return { kind: 'not_found' as const };

      // 🛡️ 4) SEGURANÇA: Anti-IDOR
      if (simulado.usuarioId !== userId) return { kind: 'forbidden' as const };

      if (simulado.status !== 'EM_ANDAMENTO') {
        return { kind: 'invalid_status' as const, status: simulado.status };
      }

      const strikesUsadosAtual = simulado.strikesUsados ?? 0;
      const strikesMax = simulado.strikesMax ?? 3;
      const novoStrikesUsados = strikesUsadosAtual + 1;
      
      // Verifica se deve anular a prova
      const atingiuLimite = novoStrikesUsados >= strikesMax;
      
      const motivoAnulacao = atingiuLimite
        ? (motivo || `Sistema: Limite de infrações excedido (${novoStrikesUsados}/${strikesMax}).`)
        : null;

      const atualizado = await tx.simulado.update({
        where: { id: simuladoId },
        data: {
          strikesUsados: novoStrikesUsados,
          ...(atingiuLimite
            ? {
                status: 'ANULADO',
                anuladoMotivo: motivoAnulacao,
                dataConclusao: new Date(),
              }
            : {}),
        },
        select: {
          id: true,
          status: true,
          strikesUsados: true,
          strikesMax: true,
          anuladoMotivo: true,
        },
      });

      // 🛡️ 5) AUDITORIA INTEGRADA
      // Se a prova foi anulada, registramos como fraude/segurança
      const acaoLog = atingiuLimite ? AuditAction.SIMULADO_ANULADO_FRAUDE : AuditAction.SISTEMA_ERRO; 
      // Nota: Usei SISTEMA_ERRO genérico para strike comum ou crie um AuditAction.SIMULADO_STRIKE se preferir

      await registrarLog({
        acao: atingiuLimite ? AuditAction.SIMULADO_ANULADO_FRAUDE : 'SIMULADO_STRIKE' as any, // Cast temporário ou adicione ao AuditAction
        usuarioId: userId,
        usuarioNome: session.name,
        recurso: `Simulado:${simuladoId}`,
        detalhes: {
          motivo,
          strikes: `${novoStrikesUsados}/${strikesMax}`,
          novoStatus: atualizado.status
        }
      });

      return { kind: 'ok' as const, simulado: atualizado };
    });

    if (result.kind === 'not_found') {
      return NextResponse.json({ error: 'Simulado não encontrado.' }, { status: 404 });
    }
    if (result.kind === 'forbidden') {
      await registrarLog({
         acao: AuditAction.SEGURANCA_IDOR_TENTATIVA,
         usuarioId: userId,
         detalhes: { recurso: `simulado:${simuladoId}`, acao: 'strike' }
      });
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
    }
    if (result.kind === 'invalid_status') {
      return NextResponse.json(
        { error: 'Simulado não está em andamento.', status: result.status },
        { status: 409 }
      );
    }

    return NextResponse.json({
      ok: true,
      status: result.simulado.status,
      strikesUsados: result.simulado.strikesUsados,
      strikesMax: result.simulado.strikesMax,
      anuladoMotivo: result.simulado.anuladoMotivo,
      // Informamos ao front se deve bloquear a tela
      anulado: result.simulado.status === 'ANULADO'
    });

  } catch (error) {
    console.error('Erro strike:', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}