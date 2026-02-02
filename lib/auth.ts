import { jwtVerify, SignJWT } from 'jose';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

const SECRET_KEY = process.env.JWT_SECRET;
if (!SECRET_KEY) {
  throw new Error('FATAL: JWT_SECRET não definido.');
}

const SECRET = new TextEncoder().encode(SECRET_KEY);

// ✅ jose espera `string[]` (mutável). Evita `readonly` do `as const`.
const JWT_ALGORITHMS: string[] = ['HS256'];

// JWT - autentica / csrf - valida - se a autenticacao cai, mesmo que o csrf esteja valido, é obrigado a fazer login
// CONFIGURAÇÃO DE SESSÃO
const TEMPO_EXPIRACAO = '8h';
const MAX_AGE_SECONDS = 8 * 60 * 60; // 28.800 segundos

export interface SessionPayload {
  sub: string;
  email: string;
  name: string;
  role: 'ALUNO' | 'PROFESSOR' | 'SUPER_ADMIN';
  mudancaSenhaObrigatoria?: boolean;

  // 🛡️ SEGURANÇA: Versionamento de Token (Invalidação em massa)
  tokenVersion: number;

  // Dados auxiliares (não salvos no token, mas hidratados no getSession)
  nivel?: number;
  pontos?: number;
  streak?: number;
  avatarUrl?: string | null;
}

async function blacklistTokenByPayload(p: { jti?: unknown; exp?: unknown }) {
  const jti = typeof p.jti === 'string' ? p.jti : null;
  const exp = typeof p.exp === 'number' && Number.isFinite(p.exp) ? p.exp : null;
  if (!jti || !exp) return;

  const expiresAt = new Date(exp * 1000);

  // Evita erro em duplicidade (ex: logout repetido / rotação repetida)
  try {
    await prisma.tokenBlacklist.upsert({
      where: { jti },
      update: { expiresAt },
      create: { jti, expiresAt },
    });
  } catch (e) {
    // Se o banco estiver indisponível, não derruba o login/logout;
    // a assinatura/expiração ainda protege.
    console.warn('Falha ao inserir token na blacklist:', e);
  }
}

/**
 * Cria uma nova sessão.
 * @param payload Dados da sessão
 * @param oldToken (Opcional) Token anterior para invalidar (Proteção Session Fixation)
 */
export async function createSession(payload: SessionPayload, oldToken?: string) {
  // 🛡️ 1. Session Fixation Protection: Invalidate old token if exists
  if (oldToken) {
    try {
      const { payload: oldPayload } = await jwtVerify(oldToken, SECRET, { algorithms: JWT_ALGORITHMS });
      await blacklistTokenByPayload(oldPayload);
    } catch (e) {
      // Se o token antigo já for inválido, apenas ignoramos e criamos o novo
      console.warn('Tentativa de invalidar token antigo falhou (provavelmente já expirado):', e);
    }
  }

  // Remove dados "hidratados" do payload do JWT (mantém o token leve)
  // (nivel/pontos/streak/avatarUrl são calculados no getSession)
  const { nivel, pontos, streak, avatarUrl, ...jwtPayload } = payload;

  // 🛡️ Gera um JTI único para permitir revogação individual (Blacklist)
  const jti = crypto.randomUUID();

  const jwt = await new SignJWT({ ...jwtPayload })
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(TEMPO_EXPIRACAO)
    .sign(SECRET);

  // ✅ Em versões recentes do Next, `cookies()` é async (retorna Promise).
  // `await` funciona também em versões antigas (não quebra).
  const cookieStore = await cookies();

  // 🛡️ CORREÇÃO CRÍTICA PARA LOCALHOST
  // Garante que 'secure' seja false se não estivermos em produção
  const isProduction = process.env.NODE_ENV === 'production';

  cookieStore.set('auth-token', jwt, {
    httpOnly: true,
    secure: isProduction, // Em localhost (HTTP) DEVE ser false
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  
  // 🚨 CORREÇÃO AQUI: Usando a string literal 'auth-token'
  const session = cookieStore.get('auth-token')?.value;
  
  if (!session) return null;

  try {
    const { payload } = await jwtVerify(session, SECRET, { algorithms: JWT_ALGORITHMS });

    // Regras mínimas de integridade do token (defesa extra caso o secret vaze)
    if (typeof payload.sub !== 'string' || !payload.sub) return null;
    if (typeof (payload as any).email !== 'string') return null;
    if (typeof (payload as any).name !== 'string') return null;
    if (typeof (payload as any).role !== 'string') return null;
    if (!Number.isInteger((payload as any).tokenVersion)) return null;

    const userId = Number(payload.sub);
    if (!Number.isFinite(userId) || userId <= 0) return null;

    // 1. Verifica Blacklist (Token Revogado via Logout ou Rotação)
    if (typeof payload.jti === 'string' && payload.jti) {
      const revogado = await prisma.tokenBlacklist.findUnique({
        where: { jti: payload.jti },
        select: { jti: true },
      });
      if (revogado) return null;
    } else {
      // JTI é obrigatório no seu modelo de revogação
      return null;
    }

    const sessionData = payload as unknown as SessionPayload;

    // 2. Busca dados atualizados do banco (Blindagem contra dados estale)
    const usuarioNoBanco = await prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        ativo: true,
        mudancaSenhaObrigatoria: true,
        fotoUrl: true,
        tokenVersion: true, // 🛡️ Versionamento
        gamificacao: {
          select: { nivel: true, pontos: true, streakAtual: true },
        },
      },
    });

    // Validações de segurança da conta
    if (!usuarioNoBanco || !usuarioNoBanco.ativo) {
      return null;
    }

    // 🛡️ 3. SEGURANÇA: Verifica Versionamento (Troca de Senha / Logout em Massa)
    // Se a versão do token for diferente da do banco, o token é antigo e inválido.
    if (sessionData.tokenVersion !== usuarioNoBanco.tokenVersion) {
      return null;
    }

    const nomeSeguro = sessionData.name || 'Usuário';
    const avatarFallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(nomeSeguro)}&background=random`;

    // Retorna sessão hidratada com dados frescos do banco
    return {
      ...sessionData,
      mudancaSenhaObrigatoria: usuarioNoBanco.mudancaSenhaObrigatoria,
      tokenVersion: usuarioNoBanco.tokenVersion,
      nivel: usuarioNoBanco.gamificacao?.nivel ?? 1,
      pontos: usuarioNoBanco.gamificacao?.pontos ?? 0,
      streak: usuarioNoBanco.gamificacao?.streakAtual ?? 0,
      avatarUrl: usuarioNoBanco.fotoUrl ?? avatarFallback,
    };
  } catch {
    return null;
  }
}

export async function logout() {
  const cookieStore = await cookies();
  
  // 🚨 CORREÇÃO AQUI
  const token = cookieStore.get('auth-token')?.value;

  // Invalida o token no servidor antes de apagar o cookie (Blacklist)
  if (token) {
    try {
      const { payload } = await jwtVerify(token, SECRET, { algorithms: JWT_ALGORITHMS });
      await blacklistTokenByPayload(payload);
    } catch {
      // Token já inválido ou expirado, apenas segue para limpar o cookie
    }
  }

  // 🚨 CORREÇÃO AQUI
  cookieStore.delete('auth-token');
}

// ⚠️ MANTIDA PARA USO EM API ROUTES (SERVER-SIDE APENAS)
// Não use esta função no Middleware. Use updateSessionEdge do 'lib/auth-edge.ts' lá.
export async function updateSession(request: NextRequest) {
  
  // 🚨 CORREÇÃO AQUI
  const session = request.cookies.get('auth-token')?.value;
  
  if (!session) return null;

  try {
    const { payload } = await jwtVerify(session, SECRET, { algorithms: JWT_ALGORITHMS });

    // Verifica Blacklist
    if (typeof payload.jti === 'string' && payload.jti) {
      const revogado = await prisma.tokenBlacklist.findUnique({
        where: { jti: payload.jti },
        select: { jti: true },
      });
      if (revogado) return null;
    } else {
      return null;
    }

    // (Blindagem) valida conta + tokenVersion antes de renovar
    const userId = typeof payload.sub === 'string' ? Number(payload.sub) : NaN;
    if (!Number.isFinite(userId) || userId <= 0) return null;

    const tokenVersion = (payload as any).tokenVersion;
    if (!Number.isInteger(tokenVersion)) return null;

    const usuarioNoBanco = await prisma.usuario.findUnique({
      where: { id: userId },
      select: { ativo: true, tokenVersion: true },
    });

    if (!usuarioNoBanco || !usuarioNoBanco.ativo) return null;
    if (usuarioNoBanco.tokenVersion !== tokenVersion) return null;

    // Remove claims de tempo do token anterior
    const { exp, iat, nbf, jti, ...restPayload } = payload;

    // Gera novo JTI para o novo token (Sliding Session)
    const newJti = crypto.randomUUID();
    const newPayload = restPayload as unknown as SessionPayload;

    const newJwt = await new SignJWT({ ...newPayload })
      .setProtectedHeader({ alg: 'HS256' })
      .setJti(newJti)
      .setIssuedAt()
      .setExpirationTime(TEMPO_EXPIRACAO)
      .sign(SECRET);

    // Mantém comportamento atual (sem alterar o padrão estrutural do projeto)
    const res = NextResponse.next();

    const isProduction = process.env.NODE_ENV === 'production';

    res.cookies.set({
      name: 'auth-token',
      value: newJwt,
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: MAX_AGE_SECONDS,
    });

    return res;
  } catch {
    return NextResponse.next();
  }
}