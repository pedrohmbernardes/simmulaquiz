// app/api/auth/recuperar/route.ts
import { NextResponse } from 'next/server';
import crypto, { timingSafeEqual } from 'crypto';
import { headers } from 'next/headers';
import bcrypt from 'bcryptjs';

import { prisma } from '@/lib/prisma';
import { recuperarSchema } from '@/lib/validations/auth';
import { authRateLimit, otpRateLimit } from '@/lib/ratelimit';
import { registrarLog, AuditAction } from '@/lib/audit';
import { safeApiError } from '@/lib/server-utils';
import { enviarCodigoRecuperacao } from '@/lib/mail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Helper de IP
async function getClientIpAsync() {
    const h = await headers();
    const xff = h.get('x-forwarded-for');
    if (xff) return xff.split(',')[0]?.trim() || '127.0.0.1';
    return h.get('x-real-ip') ?? h.get('cf-connecting-ip') ?? '127.0.0.1';
}

function noStoreJson(data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
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

// Atraso aleatório para mascarar falhas (Anti-Timing)
async function jitterDelay(minMs = 120, maxMs = 320) {
  const span = Math.max(0, maxMs - minMs);
  const ms = minMs + (span ? crypto.randomInt(0, span + 1) : 0);
  await new Promise((r) => setTimeout(r, ms));
}

// Gera OTP Numérico de 8 dígitos (compatível com otp6Schema do seu auth.ts)
function generateOTP(length: number = 8) {
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += crypto.randomInt(0, 10).toString();
  }
  return otp;
}

export async function POST(request: Request) {
  try {
    const ip = await getClientIpAsync();
    const userAgent = (request.headers.get('user-agent') || 'unknown').slice(0, 250);

    // 1) Rate limit (coarse) por IP
    if (authRateLimit) {
      const rl = await authRateLimit.limit(`recuperar:ip:${ip}`);
      if (!rl.success) {
        await registrarLog({
          acao: AuditAction.SEGURANCA_RATE_LIMIT,
          detalhes: { erro: 'Rate limit recuperar (IP)', ip, rota: '/api/auth/recuperar' },
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

    // 3) Zod Validation
    const validacao = recuperarSchema.safeParse(body);
    if (!validacao.success) {
      return noStoreJson(
        { error: 'Dados inválidos', details: validacao.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { action, email: emailRaw, code, newPassword } = validacao.data;
    const email = normalizeEmail(emailRaw);
    const emailHash = hashIdentifier(email);

    // ==========================================
    // FLUXO 1: SOLICITAR RECUPERAÇÃO (REQUEST)
    // ==========================================
    if (action === 'request') {
      
      // Rate Limit por Conta para evitar bombardeio
      if (authRateLimit) {
        const rlConta = await authRateLimit.limit(`recuperar:conta:${emailHash}`);
        if (!rlConta.success) {
           await registrarLog({
            acao: AuditAction.SEGURANCA_RATE_LIMIT,
            detalhes: { erro: 'Rate limit recuperar (Conta)', ip, rota: '/api/auth/recuperar' },
            ip,
            userAgent,
          });
          await jitterDelay();
          // Fail-closed
          return noStoreJson({ success: true, message: 'Se o e-mail existir, um código foi enviado.' }, { status: 200 });
        }
      }

      // Busca usuário
      const usuario = await prisma.usuario.findUnique({
        where: { email },
        select: { id: true, nome: true, email: true, ativo: true }
      });

      // Anti-enumeração
      if (!usuario || !usuario.ativo) {
        await jitterDelay();
        return noStoreJson({ success: true, message: 'Se o e-mail existir, um código foi enviado.' }, { status: 200 });
      }

      // Gera Código de Recuperação
      const otpCode = generateOTP(8);
      const tokenExpiraEm = new Date(Date.now() + 1000 * 60 * 15); // 15 Minutos de validade

      // Salva no banco (usando resetToken do schema)
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: {
          resetToken: otpCode, 
          resetTokenExpiraEm: tokenExpiraEm,
        }
      });

      // Dispara E-mail
      enviarCodigoRecuperacao(usuario.email, otpCode).catch((err: unknown) => {
          console.error('Falha ao enviar código de recuperação:', err instanceof Error ? err.message : String(err));
      });

      await registrarLog({
        acao: AuditAction.USUARIO_RECUPERAR_SENHA,
        usuarioId: usuario.id,
        recurso: 'Solicitação de OTP de Recuperação',
        detalhes: { status: 'Solicitada', ip, rota: '/api/auth/recuperar' },
        ip,
        userAgent,
      });

      return noStoreJson({ success: true, message: 'Se o e-mail existir, um código foi enviado.' }, { status: 200 });
    }

    // ==========================================
    // FLUXO 2: REDEFINIR A SENHA (RESET)
    // ==========================================
    if (action === 'reset') {
      
      // O Zod já garantiu que code e newPassword existem para a action 'reset',
      // mas fazemos o cast para o TS parar de reclamar.
      const codigo = String(code).trim();
      const novaSenha = String(newPassword);

      // Rate limit de tentativas de OTP (Brute-force protection)
      if (otpRateLimit) {
        const rl = await otpRateLimit.limit(`recuperar:otp:${emailHash}:${ip}`);
        if (!rl.success) {
          await registrarLog({
            acao: AuditAction.SEGURANCA_RATE_LIMIT,
            recurso: `emailHash:${emailHash}`,
            detalhes: { erro: 'Brute force OTP Reset bloqueado', ip, rota: '/api/auth/recuperar' },
            ip,
            userAgent,
          });
          return noStoreJson({ error: 'Muitas tentativas. Aguarde 10 minutos.' }, { status: 429 });
        }
      }

      const usuario = await prisma.usuario.findUnique({
        where: { email },
        select: {
          id: true,
          nome: true,
          ativo: true,
          resetToken: true,
          resetTokenExpiraEm: true,
          tokenVersion: true, // Para invalidar sessoes antigas
        },
      });

      // Fail-closed
      if (!usuario || !usuario.ativo) {
        await jitterDelay();
        return noStoreJson({ error: 'Código inválido ou expirado.' }, { status: 400 });
      }

      // Verifica expiração
      const now = new Date();
      if (!usuario.resetTokenExpiraEm || now > usuario.resetTokenExpiraEm) {
        await registrarLog({
          acao: AuditAction.SEGURANCA_TOKEN_INVALIDO,
          usuarioId: usuario.id,
          usuarioNome: usuario.nome,
          detalhes: { motivo: 'Reset OTP expirado', ip, rota: '/api/auth/recuperar' },
          ip,
          userAgent,
        });
        return noStoreJson({ error: 'Código inválido ou expirado.' }, { status: 400 });
      }

      // Comparação Timing Safe do Código
      const inputBuffer = Buffer.from(codigo, 'utf8');
      const dbBuffer = Buffer.from(usuario.resetToken || '', 'utf8');
      
      const tamanhosIguais = inputBuffer.length === dbBuffer.length;
      const codigoCorreto = tamanhosIguais && timingSafeEqual(inputBuffer, dbBuffer);

      if (!codigoCorreto) {
        await registrarLog({
          acao: AuditAction.SEGURANCA_TOKEN_INVALIDO,
          usuarioId: usuario.id,
          usuarioNome: usuario.nome,
          detalhes: { motivo: 'Reset OTP incorreto', ip, rota: '/api/auth/recuperar' },
          ip,
          userAgent,
        });
        await jitterDelay();
        return noStoreJson({ error: 'Código inválido ou expirado.' }, { status: 400 });
      }

      // Sucesso no OTP! Gerar Hash da Nova Senha
      const saltRounds = process.env.NODE_ENV === 'production' ? 12 : 10;
      const hashedPassword = await bcrypt.hash(novaSenha, saltRounds);

      // Atualização atômica
      const result = await prisma.$transaction(async (tx) => {
        const upd = await tx.usuario.updateMany({
          where: {
            id: usuario.id,
            ativo: true,
            resetToken: codigo,
            resetTokenExpiraEm: { gt: now },
          },
          data: {
            senhaHash: hashedPassword,
            resetToken: null, 
            resetTokenExpiraEm: null,
            tokenVersion: { increment: 1 }, // Invalida TODAS as sessões ativas (logout global)
          },
        });

        if (upd.count !== 1) {
          return { ok: false };
        }
        return { ok: true };
      });

      if (!result.ok) {
        await jitterDelay();
        return noStoreJson({ error: 'Código inválido ou expirado.' }, { status: 400 });
      }

      await registrarLog({
        acao: AuditAction.USUARIO_NOVA_SENHA,
        usuarioId: usuario.id,
        usuarioNome: usuario.nome,
        recurso: 'Redefinição de Senha Concluída',
        detalhes: { status: 'Sucesso via OTP', ip, rota: '/api/auth/recuperar' },
        ip,
        userAgent,
      });

      return noStoreJson({ success: true, message: 'Senha redefinida com sucesso!' }, { status: 200 });
    }

    // Se chegar aqui, a action não foi nem request nem reset
    return noStoreJson({ error: 'Ação inválida.' }, { status: 400 });

  } catch (error) {
    return safeApiError(error, 'Erro interno ao processar a recuperação de senha.');
  }
}