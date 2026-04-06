import { NextResponse } from 'next/server';
import crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { registerSchema } from '@/lib/validations/auth';
import { authRateLimit, otpRateLimit } from '@/lib/ratelimit';
import { registrarLog, AuditAction } from '@/lib/audit';
import { getClientIp, safeApiError } from '@/lib/server-utils';
import { enviarCodigoVerificacao } from '@/lib/mail';
import { headers } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Helper de IP (Consistência)
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

function toDateSafe(input: unknown): Date | null {
  if (input instanceof Date && !Number.isNaN(input.getTime())) return input;
  if (typeof input === 'string' || typeof input === 'number') {
    const d = new Date(input);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const ip = await getClientIpAsync();
    const userAgent = (request.headers.get('user-agent') || 'unknown').slice(0, 250);

    // 🛡️ 1) Defesa em Profundidade: Limite de Payload
    const contentLength = request.headers.get('content-length');
    if (contentLength && Number(contentLength) > 20_000) {
      return noStoreJson({ error: 'Payload muito grande.' }, { status: 413 });
    }

    // 🛡️ 2) Rate Limit por IP (Coarse - Bloqueia Bots)
    if (authRateLimit) {
      const rl = await authRateLimit.limit(`register:ip:${ip}`);
      if (!rl.success) {
        await registrarLog({
          acao: AuditAction.SEGURANCA_RATE_LIMIT,
          detalhes: { erro: 'Rate limit register (IP)', ip, rota: '/api/auth/register' },
        });
        return noStoreJson({ error: 'Muitas tentativas. Aguarde um pouco.' }, { status: 429 });
      }
    }

    // 3) Parse Seguro
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return noStoreJson({ error: 'JSON inválido.' }, { status: 400 });
    }

    // 4) Validação Zod
    const validacao = registerSchema.safeParse(body);
    if (!validacao.success) {
      return noStoreJson(
        { error: 'Dados inválidos', details: validacao.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { nome, email: rawEmail, senha, dataNascimento, website } = validacao.data;

    // 🛡️ 5) Honeypot (Campo armadilha para bots)
    if (website) {
      await jitterDelay(); // Simula processamento
      return noStoreJson({ success: true }, { status: 201 }); // Fake success
    }

    const email = normalizeEmail(rawEmail);
    const emailHash = hashIdentifier(email);

    // 🛡️ 6) Rate Limit por E-mail (IP + Email Hash)
    // Impede brute-force de criação de conta
    if (authRateLimit) {
      const rl = await authRateLimit.limit(`register:ip_email:${ip}:${emailHash}`);
      if (!rl.success) {
        await registrarLog({
          acao: AuditAction.SEGURANCA_RATE_LIMIT,
          detalhes: { erro: 'Rate limit register (IP+email)', ip, emailHash, rota: '/api/auth/register' },
        });
        return noStoreJson({ error: 'Muitas tentativas. Aguarde um pouco.' }, { status: 429 });
      }
    }

    const dn = toDateSafe(dataNascimento);
    if (!dn) {
      return noStoreJson({ error: 'Data de nascimento inválida.' }, { status: 400 });
    }

    // 7) Checagem de Duplicidade (Select Mínimo)
    const usuarioExistente = await prisma.usuario.findUnique({
      where: { email },
      select: { id: true },
    });

    // 🛡️ 8) ANTI-ENUMERAÇÃO: Retorna SUCESSO mesmo se já existir
    if (usuarioExistente) {
      await jitterDelay(); // Simula tempo de criação de hash e DB
      await registrarLog({
        acao: AuditAction.USUARIO_CRIAR, // Loga como criação, mas interna como "falha segura"
        recurso: `emailHash:${emailHash}`,
        detalhes: { resultado: 'email_ja_cadastrado_fake_success', ip, rota: '/api/auth/register' },
      });
      return noStoreJson({ success: true }, { status: 201 });
    }

    // Hash de Senha (Lento propositalmente)
    const senhaHash = await bcrypt.hash(senha, 12);

    // OTP 8 dígitos
    const tokenVerificacao = crypto.randomInt(10000000, 100000000).toString();
    const tokenExpiraEm = new Date(Date.now() + 10 * 60 * 1000);

    // 🛡️ 9) Rate Limit de Envio de E-mail (OTP)
    // Se estourar o limite, cria a conta mas NÃO envia o e-mail (evita spam)
    let podeEnviarOtp = true;
    if (otpRateLimit) {
      const rl = await otpRateLimit.limit(`register:otp:${emailHash}:${ip}`);
      if (!rl.success) {
        podeEnviarOtp = false;
        await registrarLog({
          acao: AuditAction.SEGURANCA_RATE_LIMIT,
          detalhes: { erro: 'Rate limit OTP Blocked (Register)', ip, emailHash },
        });
      }
    }

    // 10) Transação de Criação (Usuário + Gamificação)
    let novoUsuario: { id: number; nome: string; email: string };
    try {
      novoUsuario = await prisma.$transaction(async (tx) => {
        const user = await tx.usuario.create({
          data: {
            nome,
            email,
            senhaHash,
            dataNascimento: dn,
            tipo: 'ALUNO',
            ativo: true,
            emailVerificado: false,
            tokenVerificacao,
            tokenExpiraEm,
          },
          select: { id: true, nome: true, email: true },
        });

        // Inicializa Gamificação
        await tx.usuarioGamificacao.create({
          data: {
            usuarioId: user.id,
            nivel: 1,
            pontos: 0,
            streakAtual: 0,
            tituloId: null,
          },
        });

        return user;
      });
    } catch (e) {
      // Trata colisão concorrente (Race Condition)
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        await jitterDelay();
        return noStoreJson({ success: true }, { status: 201 });
      }
      throw e;
    }

    // 11) Auditoria
    await registrarLog({
      acao: AuditAction.USUARIO_CRIAR,
      usuarioId: novoUsuario.id,
      usuarioNome: novoUsuario.nome,
      recurso: 'register',
      detalhes: { ip, metodo: 'Formulário' },
    });

    // 12) Envio de E-mail (Assíncrono)
    if (podeEnviarOtp) {
      await enviarCodigoVerificacao(email, tokenVerificacao).catch(async (e) => {
        console.error('Erro envio email verificação:', e);
        await registrarLog({
          acao: AuditAction.SISTEMA_ERRO,
          usuarioId: novoUsuario.id,
          detalhes: { erro: 'Falha envio email verificação', ip },
        });
      });
    }

    return noStoreJson({ success: true }, { status: 201 });

  } catch (error) {
    return safeApiError(error, 'Erro ao criar conta.');
  }
}