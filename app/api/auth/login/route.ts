import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

import { prisma } from '@/lib/prisma';
import { createSession } from '@/lib/auth';
import { loginSchema } from '@/lib/validations/auth';
import { enviarCodigoVerificacao, enviarAlertaSegurancaLogin } from '@/lib/mail';
import { authRateLimit, otpRateLimit } from '@/lib/ratelimit';
import { registrarLog, AuditAction } from '@/lib/audit';
import { processarLoginDiario } from '@/lib/gamificacao/engine';
import { getClientIp, safeApiError } from '@/lib/server-utils';
import { headers } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 🛡️ CONSTANTE DE SEGURANÇA (ANTI-TIMING / USER ENUMERATION)
// Hash bcrypt de custo 10 (ou compatível com seu DB) de uma string qualquer.
// Garante que mesmo logins inválidos "gastem" CPU para simular verificação real.
const DUMMY_HASH = '$2b$10$abcdefghijklmnopqrstuuabcdefghijklmnopqrstuvwxABCDE12';

// Resposta sem cache (impede que tokens fiquem no histórico/disk cache)
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

// Hash unidirecional para logs (privacidade)
function hashIdentifier(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
}

// Atraso aleatório para mitigar Timing Attacks
async function jitterDelay(minMs = 100, maxMs = 300) {
  const span = Math.max(0, maxMs - minMs);
  const ms = minMs + (span ? crypto.randomInt(0, span + 1) : 0);
  await new Promise((r) => setTimeout(r, ms));
}

// Helper IP (consistente)
async function getClientIpAsync() {
    const h = await headers();
    const xff = h.get('x-forwarded-for');
    if (xff) return xff.split(',')[0]?.trim() || '127.0.0.1';
    return h.get('x-real-ip') ?? h.get('cf-connecting-ip') ?? '127.0.0.1';
}

export async function POST(request: Request) {
  try {
    const ip = await getClientIpAsync();
    const userAgent = (request.headers.get('user-agent') || 'unknown').slice(0, 250);

    // 🛡️ (Defesa em profundidade) Bloqueia payloads gigantes
    const contentLength = request.headers.get('content-length');
    if (contentLength && Number(contentLength) > 20_000) {
      return noStoreJson({ error: 'Payload muito grande.' }, { status: 413 });
    }

    // 🛡️ 1) RATE LIMITING POR IP (Bloqueia bots genéricos)
    if (authRateLimit) {
      const rl = await authRateLimit.limit(`login:ip:${ip}`);
      if (!rl.success) {
        await registrarLog({
          acao: AuditAction.LOGIN_RATE_LIMIT,
          detalhes: { erro: 'Muitas tentativas (IP Block)', ip, rota: '/api/auth/login' },
        });
        return noStoreJson({ error: 'Muitas tentativas. Aguarde 30 minutos.' }, { status: 429 });
      }
    }

    // 2) Parse do JSON
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return noStoreJson({ error: 'JSON inválido.' }, { status: 400 });
    }

    // 3) Validação Schema
    const validacao = loginSchema.safeParse(body);
    if (!validacao.success) {
      // Retorna erro genérico ou detalhado (depende da sua UX, aqui mantive detalhado pois é erro de formato)
      return noStoreJson(
        { error: 'Dados inválidos', details: validacao.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const email = normalizeEmail(validacao.data.email);
    const senha = validacao.data.senha;

    // 🛡️ 4) RATE LIMITING POR CREDENCIAL (IP + Email Hash)
    // Protege contra Brute Force direcionado a uma conta específica
    const emailHash = hashIdentifier(email);
    if (authRateLimit) {
      const rl = await authRateLimit.limit(`login:ip_email:${ip}:${emailHash}`);
      if (!rl.success) {
        await registrarLog({
          acao: AuditAction.LOGIN_RATE_LIMIT,
          detalhes: { erro: 'Muitas tentativas (Conta Alvo)', ip, emailHash, rota: '/api/auth/login' },
        });
        return noStoreJson({ error: 'Muitas tentativas. Aguarde 30 minutos.' }, { status: 429 });
      }
    }

    // 5) Busca usuário (Select enxuto)
    const usuario = await prisma.usuario.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        nome: true,
        senhaHash: true,
        tipo: true,
        ativo: true,
        emailVerificado: true,
        ultimoLogin: true,
        mudancaSenhaObrigatoria: true,
        tokenVersion: true,
      },
    });

    // 🛡️ 6) ANTI-TIMING & VERIFICAÇÃO DE SENHA
    // Executa bcrypt mesmo se usuário não existir (usa DUMMY_HASH)
    // Isso impede enumeração de e-mails via tempo de resposta
    const hashParaVerificar = usuario?.senhaHash ?? DUMMY_HASH;
    const senhaCorreta = await bcrypt.compare(senha, hashParaVerificar);

    // Se usuário não existe OU senha errada, falha genericamente
    if (!usuario || !senhaCorreta) {
      await jitterDelay(); // Adiciona ruído aleatório no tempo

      await registrarLog({
        acao: AuditAction.LOGIN_FALHA,
        recurso: `emailHash:${emailHash}`, // Não loga o e-mail real falho
        detalhes: { motivo: 'Credenciais inválidas', ip },
      });

      return noStoreJson({ error: 'Credenciais inválidas.' }, { status: 401 });
    }

    // 7) Bloqueio de conta desativada
    if (!usuario.ativo) {
      await registrarLog({
        acao: AuditAction.LOGIN_FALHA_DESATIVADO,
        usuarioId: usuario.id,
        usuarioNome: usuario.nome,
        detalhes: { ip },
      });
      return noStoreJson({ error: 'Conta desativada pelo administrador.' }, { status: 403 });
    }

    // 8) Verificação de E-mail (Fluxo de Retenção)
    if (usuario.tipo === 'ALUNO' && !usuario.emailVerificado) {
      // Proteção de reenvio de OTP
      if (otpRateLimit) {
        const rl = await otpRateLimit.limit(`login:verify_resend:${emailHash}:${ip}`);
        if (!rl.success) {
          return noStoreJson({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 });
        }
      }

      const novoToken = crypto.randomInt(100000, 1000000).toString();
      const expiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { tokenVerificacao: novoToken, tokenExpiraEm: expiraEm },
      });

      await enviarCodigoVerificacao(usuario.email, novoToken).catch((e) =>
        console.error('Erro ao reenviar token no login:', e)
      );

      return noStoreJson(
        {
          error: 'E-mail não verificado. Enviamos um novo código.',
          code: 'EMAIL_NOT_VERIFIED',
          email: usuario.email,
        },
        { status: 403 }
      );
    }

    // 9) Inatividade (90 dias)
    const noventaDiasAtras = new Date();
    noventaDiasAtras.setDate(noventaDiasAtras.getDate() - 90);

    if (usuario.ultimoLogin && usuario.ultimoLogin < noventaDiasAtras) {
      if (otpRateLimit) {
        const rl = await otpRateLimit.limit(`login:reactivate:${usuario.id}:${ip}`);
        if (!rl.success) {
           return noStoreJson({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 });
        }
      }

      const otp = crypto.randomInt(10000000, 100000000).toString();
      const expiracao = new Date(Date.now() + 10 * 60 * 1000);

      await prisma.usuario.update({
        where: { id: usuario.id },
        data: {
          emailVerificado: false,
          mudancaSenhaObrigatoria: true,
          tokenVerificacao: otp,
          tokenExpiraEm: expiracao,
        },
      });

      await enviarCodigoVerificacao(usuario.email, otp).catch((e) => console.error('Erro envio reativação:', e));

      await registrarLog({
        acao: AuditAction.LOGIN_BLOQUEADO,
        usuarioId: usuario.id,
        usuarioNome: usuario.nome,
        detalhes: { motivo: 'Inatividade 90 dias', ip },
      });

      return noStoreJson(
        { error: 'Conta inativa por 90 dias. Verifique seu e-mail para reativar.' },
        { status: 403 }
      );
    }

    // 10) Gamificação (Soft-Fail: não bloqueia login se der erro)
    let dadosGamificacao: any = null;
    try {
      const resultado = await processarLoginDiario(usuario.id);
      if (resultado?.success) dadosGamificacao = resultado;
    } catch (e) {
      console.error("Erro em auth/login:", e instanceof Error ? e.message : String(e));
    }

    // 11) Atualiza Login com sucesso
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoLogin: new Date() },
    });

    await registrarLog({
      acao: AuditAction.LOGIN_SUCESSO,
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      detalhes: { role: usuario.tipo, ip },
    });

    // 12) Alerta de Segurança
    await enviarAlertaSegurancaLogin(usuario.email, usuario.nome, {
      ip,
      dispositivo: userAgent,
      horario: new Date().toLocaleString('pt-BR'),
      local: 'Local aproximado via IP',
    }).catch(() => {});

    // 🛡️ 13) CRIAÇÃO DE SESSÃO (Rotação Segura)
    const cookieStore = await cookies();
    const oldToken = cookieStore.get('session')?.value;

    await createSession(
      {
        sub: usuario.id.toString(),
        email: usuario.email,
        name: usuario.nome,
        role: usuario.tipo,
        mudancaSenhaObrigatoria: usuario.mudancaSenhaObrigatoria,
        tokenVersion: usuario.tokenVersion,
      },
      oldToken // Passamos o token antigo para ser invalidado (Rotação)
    );

    return noStoreJson({
      success: true,
      role: usuario.tipo,
      name: usuario.nome,
      requirePasswordChange: !!usuario.mudancaSenhaObrigatoria,
      xpGanho: dadosGamificacao?.xpGanho || 0,
      streak: dadosGamificacao?.streak || 0,
    });
    
  } catch (error) {
    return safeApiError(error, 'Erro interno ao realizar login.');
  }
}