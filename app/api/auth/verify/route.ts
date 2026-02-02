// app/api/auth/verify/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto, { timingSafeEqual } from 'crypto';

import { prisma } from '@/lib/prisma';
import { verifySchema } from '@/lib/validations/auth';
import { authRateLimit, otpRateLimit } from '@/lib/ratelimit';
import { registrarLog, AuditAction } from '@/lib/audit';
import { getClientIp, safeApiError } from '@/lib/utils';
import { createSession } from '@/lib/auth';
import { enviarEmailBoasVindas_Aluno } from '@/lib/mail';
import { generateCSRFToken } from '@/lib/csrf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function noStoreJson(data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('Pragma', 'no-cache');
  res.headers.set('Expires', '0');
  return res;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashIdentifier(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
}

async function jitterDelay(minMs = 120, maxMs = 320) {
  const span = Math.max(0, maxMs - minMs);
  const ms = minMs + (span ? crypto.randomInt(0, span + 1) : 0);
  await new Promise((r) => setTimeout(r, ms));
}

const BONUS_VERIFICACAO_EMAIL = 50; // ajuste como quiser (pontos/xp)

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const userAgent = (request.headers.get('user-agent') || 'unknown').slice(0, 250);

    // (Defesa em profundidade) payload pequeno
    const contentLength = request.headers.get('content-length');
    if (contentLength && Number(contentLength) > 20_000) {
      return noStoreJson({ error: 'Payload muito grande.' }, { status: 413 });
    }

    // 1) Rate limit (coarse) por IP
    if (authRateLimit) {
      const rl = await authRateLimit.limit(`verify:ip:${ip}`);
      if (!rl.success) {
        await registrarLog({
          acao: AuditAction.SEGURANCA_RATE_LIMIT,
          detalhes: { erro: 'Rate limit verify (IP)', ip, rota: '/api/auth/verify' },
          ip,
          userAgent,
        });

        return noStoreJson({ error: 'Muitas requisições. Aguarde alguns minutos.' }, { status: 429 });
      }
    }

    // 2) Parse seguro
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return noStoreJson({ error: 'JSON inválido.' }, { status: 400 });
    }

    // 3) Zod
    const validacao = verifySchema.safeParse(body);
    if (!validacao.success) {
      return noStoreJson(
        { error: 'Dados inválidos', details: validacao.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const email = normalizeEmail(validacao.data.email);
    const codigo = String(validacao.data.codigo).trim(); // zod já garante 6 dígitos numéricos
    const emailHash = hashIdentifier(email);

    // 4) Rate limit OTP (IP + email hash) — evita brute-force dirigido / spam
    if (otpRateLimit) {
      const rl = await otpRateLimit.limit(`verify:otp:${emailHash}:${ip}`);
      if (!rl.success) {
        await registrarLog({
          acao: AuditAction.SEGURANCA_RATE_LIMIT,
          recurso: `emailHash:${emailHash}`,
          detalhes: { erro: 'Brute force OTP bloqueado', ip, rota: '/api/auth/verify' },
          ip,
          userAgent,
        });

        return noStoreJson({ error: 'Muitas tentativas. Aguarde 15 minutos.' }, { status: 429 });
      }
    }

    // 5) Busca usuário (campos mínimos)
    const usuario = await prisma.usuario.findUnique({
      where: { email },
      select: {
        id: true,
        nome: true,
        email: true,
        tipo: true,
        ativo: true,
        emailVerificado: true,
        tokenVerificacao: true,
        tokenExpiraEm: true,
        tokenVersion: true,
        mudancaSenhaObrigatoria: true,
      },
    });

    // Fail-closed e anti-enumeração
    if (!usuario || !usuario.ativo || usuario.emailVerificado) {
      await jitterDelay();
      await registrarLog({
        acao: AuditAction.SEGURANCA_TOKEN_INVALIDO,
        recurso: `emailHash:${emailHash}`,
        detalhes: { motivo: 'Verify inválido (inexistente/inativo/ja verificado)', ip, rota: '/api/auth/verify' },
        ip,
        userAgent,
      });

      return noStoreJson({ error: 'Código inválido ou expirado.' }, { status: 400 });
    }

    // 6) Expiração
    const now = new Date();
    if (!usuario.tokenExpiraEm || now > usuario.tokenExpiraEm) {
      await registrarLog({
        acao: AuditAction.SEGURANCA_TOKEN_INVALIDO,
        usuarioId: usuario.id,
        usuarioNome: usuario.nome,
        detalhes: { motivo: 'OTP expirado', ip, rota: '/api/auth/verify' },
        ip,
        userAgent,
      });

      return noStoreJson({ error: 'Código inválido ou expirado.' }, { status: 400 });
    }

    // 7) Comparação em tempo constante
    const inputBuffer = Buffer.from(codigo, 'utf8');
    const dbBuffer = Buffer.from(usuario.tokenVerificacao || '', 'utf8');

    const tamanhosIguais = inputBuffer.length === dbBuffer.length;
    const codigoCorreto = tamanhosIguais && timingSafeEqual(inputBuffer, dbBuffer);

    if (!codigoCorreto) {
      await registrarLog({
        acao: AuditAction.SEGURANCA_TOKEN_INVALIDO,
        usuarioId: usuario.id,
        usuarioNome: usuario.nome,
        detalhes: { motivo: 'OTP incorreto', ip, rota: '/api/auth/verify' },
        ip,
        userAgent,
      });

      await jitterDelay();
      return noStoreJson({ error: 'Código inválido ou expirado.' }, { status: 400 });
    }

    // 8) ✅ Atualização atômica (anti-replay / concorrência)
    // Só 1 request consegue "consumir" o OTP.
    const result = await prisma.$transaction(async (tx) => {
      const upd = await tx.usuario.updateMany({
        where: {
          id: usuario.id,
          emailVerificado: false,
          ativo: true,
          tokenVerificacao: codigo,
          tokenExpiraEm: { gt: now },
        },
        data: {
          emailVerificado: true,
          tokenVerificacao: null,
          tokenExpiraEm: null,
        },
      });

      if (upd.count !== 1) {
        return { ok: false as const, bonus: 0 };
      }

      // ✅ Gamificação: bônus por confirmar e-mail (não quebra se algo der errado)
      let bonus = 0;
      try {
        const updated = await tx.usuarioGamificacao.updateMany({
          where: { usuarioId: usuario.id },
          data: { pontos: { increment: BONUS_VERIFICACAO_EMAIL } },
        });

        if (updated.count === 0) {
          await tx.usuarioGamificacao.create({
            data: {
              usuarioId: usuario.id,
              nivel: 1,
              pontos: BONUS_VERIFICACAO_EMAIL,
              streakAtual: 0,
              tituloId: null,
            },
          });
        }

        bonus = BONUS_VERIFICACAO_EMAIL;
      } catch {
        // gamificação nunca derruba verify
      }

      return { ok: true as const, bonus };
    });

    if (!result.ok) {
      await jitterDelay();
      return noStoreJson({ error: 'Código inválido ou expirado.' }, { status: 400 });
    }

    await registrarLog({
      acao: AuditAction.USUARIO_ATUALIZAR,
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      recurso: 'Verificação de Conta',
      detalhes: { status: 'Verificado com sucesso', ip, rota: '/api/auth/verify', bonus: result.bonus },
      ip,
      userAgent,
    });

    // 9) Cria sessão (session fixation protection com oldToken)
    const cookieStore = await cookies(); // funciona tanto se cookies() for sync quanto async
    const oldToken = cookieStore.get('session')?.value;

    await createSession(
      {
        sub: usuario.id.toString(),
        email: usuario.email,
        name: usuario.nome,
        role: usuario.tipo,
        tokenVersion: usuario.tokenVersion,
        mudancaSenhaObrigatoria: usuario.mudancaSenhaObrigatoria,
      },
      oldToken
    );

    // ✅ 10) Gera CSRF já pronto para o usuário recém-logado
    // (cookie httpOnly + token retornado pro front enviar em x-csrf-token)
    const csrfToken = await generateCSRFToken();

    // 11) Boas-vindas assíncrono
    await enviarEmailBoasVindas_Aluno(usuario.email, usuario.nome).catch((err) =>
      console.error('Falha ao enviar boas-vindas:', err)
    );

    return noStoreJson(
      { success: true, csrfToken, expiresIn: 7200, xpGanho: result.bonus },
      { status: 200 }
    );
  } catch (error) {
    return safeApiError(error, 'Erro interno ao verificar conta.');
  }
}
