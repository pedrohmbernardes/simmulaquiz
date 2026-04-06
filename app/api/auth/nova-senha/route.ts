import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import * as bcrypt from 'bcryptjs';
import crypto from 'crypto';

import { novaSenhaSchema } from '@/lib/validations/auth';
import { authRateLimit } from '@/lib/ratelimit';
import { logout, getSession } from '@/lib/auth';
import { registrarLog, AuditAction } from '@/lib/audit';
import { getClientIp, safeApiError } from '@/lib/server-utils';
import { verifyCSRFToken } from '@/lib/csrf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function noStoreJson(data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('Pragma', 'no-cache');
  res.headers.set('Expires', '0');
  return res;
}

async function jitterDelay(minMs = 120, maxMs = 320) {
  const span = Math.max(0, maxMs - minMs);
  const ms = minMs + (span ? crypto.randomInt(0, span + 1) : 0);
  await new Promise((r) => setTimeout(r, ms));
}

export async function POST(request: Request) {
  try {
    const ip = await getClientIp(request);
    const userAgent = (request.headers.get('user-agent') || 'unknown').slice(0, 250);

    // (defesa em profundidade) payload pequeno
    const contentLength = request.headers.get('content-length');
    if (contentLength && Number(contentLength) > 30_000) {
      return noStoreJson({ error: 'Payload muito grande.' }, { status: 413 });
    }

    // 1) Sessão (anti-IDOR)
    const session = await getSession();
    if (!session?.sub) {
      return noStoreJson({ error: 'Sessão expirada. Faça login novamente.' }, { status: 401 });
    }

    const usuarioId = Number(session.sub);
    if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
      return noStoreJson({ error: 'Sessão inválida.' }, { status: 401 });
    }

    // 2) CSRF (CRÍTICO) — seu middleware pode não estar cobrindo /api/auth/*
    const csrfHeader = request.headers.get('x-csrf-token');
    const csrfOk = await verifyCSRFToken(csrfHeader);
    if (!csrfOk) {
      await registrarLog({
        acao: AuditAction.SEGURANCA_CSRF_INVALIDO,
        usuarioId,
        usuarioNome: session.name,
        detalhes: { erro: 'CSRF inválido em nova-senha', ip, rota: '/api/auth/nova-senha' },
        ip,
        userAgent,
      });

      return noStoreJson(
        { error: 'Token de segurança inválido ou expirado. Recarregue a página.' },
        { status: 403 }
      );
    }

    // 3) Rate limit (por usuário + IP)
    if (authRateLimit) {
      const rl = await authRateLimit.limit(`nova-senha:${usuarioId}:${ip}`);
      if (!rl.success) {
        await registrarLog({
          acao: AuditAction.SEGURANCA_RATE_LIMIT,
          usuarioId,
          usuarioNome: session.name,
          detalhes: { erro: 'Rate limit nova-senha', ip, rota: '/api/auth/nova-senha' },
          ip,
          userAgent,
        });

        return noStoreJson({ error: 'Muitas tentativas. Aguarde 30 minutos.' }, { status: 429 });
      }
    }

    // 4) JSON parse seguro
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return noStoreJson({ error: 'JSON inválido.' }, { status: 400 });
    }

    // 5) Validação Zod
    const validacao = novaSenhaSchema.safeParse(body);
    if (!validacao.success) {
      return noStoreJson(
        { error: 'Dados inválidos', details: validacao.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { senhaAtual, novaSenha } = validacao.data;

    // 6) Busca usuário com campos mínimos
    const usuario = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        nome: true,
        ativo: true,
        senhaHash: true,
      },
    });

    if (!usuario || !usuario.ativo) {
      return noStoreJson({ error: 'Usuário não encontrado.' }, { status: 404 });
    }

    // 7) Verifica senha atual
    const senhaValida = await bcrypt.compare(senhaAtual, usuario.senhaHash);
    if (!senhaValida) {
      await jitterDelay();

      await registrarLog({
        acao: AuditAction.LOGIN_FALHA,
        usuarioId: usuario.id,
        usuarioNome: usuario.nome,
        detalhes: { erro: 'Senha atual incorreta na troca', ip, rota: '/api/auth/nova-senha' },
        ip,
        userAgent,
      });

      return noStoreJson({ error: 'A senha atual está incorreta.' }, { status: 401 });
    }

    // 8) Nova senha diferente
    const repetida = await bcrypt.compare(novaSenha, usuario.senhaHash);
    if (repetida) {
      return noStoreJson({ error: 'A nova senha não pode ser igual à senha atual.' }, { status: 400 });
    }

    // 9) Atualiza senha + invalida sessões
    const novaSenhaHash = await bcrypt.hash(novaSenha, 12);

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        senhaHash: novaSenhaHash,
        mudancaSenhaObrigatoria: false,
        tokenVersion: { increment: 1 },
        // opcional (boa higiene): queima reset tokens também
        resetToken: null,
        resetTokenExpiraEm: null,
      },
    });

    await registrarLog({
      acao: AuditAction.USUARIO_NOVA_SENHA,
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      recurso: 'Senha',
      detalhes: { acao: 'Troca de senha (autenticado)', ip, rota: '/api/auth/nova-senha' },
      ip,
      userAgent,
    });

    // 10) Logout forçado (cookie + blacklist, se aplicável)
    await logout();

    return noStoreJson({
      success: true,
      message: 'Senha alterada com sucesso. Faça login novamente.',
    });
  } catch (error) {
    return safeApiError(error, 'Erro interno ao atualizar a senha.');
  }
}
