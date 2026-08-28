import { NextResponse, type NextRequest } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import {
  SECRET,
  TEMPO_EXPIRACAO,
  MAX_AGE_SECONDS,
  verifyJWT,
  type SessionPayload,
} from "@/lib/auth-edge";

/**
 * Middleware (Edge)
 * - Máxima atenção em segurança (CSRF, headers, RBAC, sessão)
 */

// ⚠️ AJUSTE IMPORTANTE: O nome do cookie deve bater com o auth.ts
const AUTH_COOKIE_NAME = "auth-token";

function addSecurityHeaders(response: NextResponse) {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("X-DNS-Prefetch-Control", "on");

  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }

  return response;
}

function jsonResponse(data: unknown, init?: ResponseInit) {
  return addSecurityHeaders(NextResponse.json(data, init));
}

function redirectResponse(url: URL) {
  return addSecurityHeaders(NextResponse.redirect(url));
}

function isMutatingMethod(method: string) {
  return (
    method === "POST" ||
    method === "PUT" ||
    method === "PATCH" ||
    method === "DELETE"
  );
}

function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin || !host) return true;

  try {
    const originUrl = new URL(origin);
    const originHost = originUrl.host;

    if (originHost === host) return true;

    if (process.env.NODE_ENV !== "production") {
      if (
        originHost.startsWith("localhost") ||
        originHost.startsWith("127.0.0.1") ||
        originHost.startsWith("[::1]")
      ) {
        return true;
      }
      if (
        host.startsWith("localhost") ||
        host.startsWith("127.0.0.1") ||
        host.startsWith("[::1]")
      ) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

async function verifyCSRFEdge(request: NextRequest): Promise<boolean> {
  const secretKey = process.env.CSRF_SECRET || process.env.JWT_SECRET;
  if (!secretKey) {
    console.error(
      "[MIDDLEWARE-DEBUG] ❌ CSRF FALHOU: Secret Key não definida.",
    );
    return false;
  }

  const headerToken = request.headers.get("x-csrf-token");
  const cookieToken = request.cookies.get("csrf-token")?.value;

  // LOGS DE DEBUG (Isso vai aparecer no terminal)
  if (!headerToken || !cookieToken) {
    console.error(
      `[MIDDLEWARE-DEBUG] ❌ CSRF FALHOU: Dados faltando. Header: ${!!headerToken}, Cookie: ${!!cookieToken}`,
    );
    // Se estiver no browser, mostre os cookies que chegaram para entender o bloqueio
    console.log(
      "[MIDDLEWARE-DEBUG] Cookies recebidos:",
      request.cookies.getAll().map((c) => c.name),
    );
    return false;
  }

  if (headerToken !== cookieToken) {
    console.error(
      "[MIDDLEWARE-DEBUG] ❌ CSRF FALHOU: Header diferente do Cookie (Double Submit Mismatch).",
    );
    return false;
  }

  try {
    const key = new TextEncoder().encode(secretKey);
    const { payload } = await jwtVerify(headerToken, key, {
      algorithms: ["HS256"],
    });
    if ((payload as any).csrf !== true) {
      console.error(
        "[MIDDLEWARE-DEBUG] ❌ CSRF FALHOU: Payload do token inválido.",
      );
      return false;
    }
    return true;
  } catch (e) {
    console.error(
      "[MIDDLEWARE-DEBUG] ❌ CSRF FALHOU: Erro na verificação JWT.",
      e,
    );
    return false;
  }
}

async function updateSessionEdge(payload: SessionPayload) {
  const newJti = crypto.randomUUID();
  const newJwt = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(newJti)
    .setIssuedAt()
    .setExpirationTime(TEMPO_EXPIRACAO)
    .sign(SECRET);

  const res = NextResponse.next();
  const isProduction = process.env.NODE_ENV === "production";

  res.cookies.set({
    name: AUTH_COOKIE_NAME, // ✅ CORRIGIDO: Usando 'auth-token' em vez de 'session'
    value: newJwt,
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax", // ✅ CORRIGIDO: Mantendo 'lax' para não reverter sua correção
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });

  return res;
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const method = request.method;

  // 0) Anti-DoS
  if (isMutatingMethod(method)) {
    const contentLength = request.headers.get("content-length");
    if (contentLength) {
      const n = Number(contentLength);
      if (Number.isFinite(n) && n > 5 * 1024 * 1024) {
        return jsonResponse(
          { error: "Requisição muito grande. Máximo: 5MB" },
          { status: 413 },
        );
      }
    }
    if (!isSameOrigin(request)) {
      return jsonResponse(
        { error: "Cross-Origin Request Blocked" },
        { status: 403 },
      );
    }
  }

  // 1) Rotas públicas
  const publicPrefixes = [
    "/",
    "/registrar",
    "/recuperar-senha",
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/recuperar",
    "/api/auth/verify",
    "/api/csrf",
    "/api/cron",
  ];

  // ✅ CORRIGIDO: Lendo o cookie correto ('auth-token')
  const sessionCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = sessionCookie ? await verifyJWT(sessionCookie) : null;

  // 1.1) Se já está logado e tenta /login, redireciona "inteligente"
  if (path === "/login" && user) {
    if (user.mudancaSenhaObrigatoria) {
      return redirectResponse(new URL("/nova-senha", request.url));
    }
    if (user.role === "PROFESSOR" || user.role === "SUPER_ADMIN") {
      return redirectResponse(new URL("/escolha-perfil", request.url));
    }
    return redirectResponse(new URL("/estudante", request.url));
  }

  // 1.2) Outras rotas públicas
  if (
    path === "/login" ||
    publicPrefixes.some((p) => path === p || path.startsWith(p + "/"))
  ) {
    return addSecurityHeaders(NextResponse.next());
  }

  // 2) CSRF - ✅ ADICIONADO /api/ai
  const criticalPrefixes = [
    "/api/admin",
    "/api/ai",
    "/api/estudante",
    "/api/simulados",
    "/api/upload",
    "/api/auth/nova-senha",
    "/api/auth/logout",
  ];

  const isCriticalPath = criticalPrefixes.some(
    (p) => path === p || path.startsWith(p + "/"),
  );

  if (isCriticalPath && isMutatingMethod(method)) {
    console.log(`[MIDDLEWARE-DEBUG] 🛡️ Verificando CSRF para: ${path}`);
    const ok = await verifyCSRFEdge(request);
    if (!ok) {
      console.error("[MIDDLEWARE-DEBUG] ⛔ Bloqueio CSRF acionado.");
      return jsonResponse(
        {
          error:
            "Sessão inválida ou token de segurança expirado. Recarregue a página.",
        },
        { status: 403 },
      );
    }
  }

  // 3) Rotas Protegidas
  const protectedPrefixes = [
    "/admin",
    "/professor",
    "/escolha-perfil",
    "/estudante",
    "/simulado",
    "/nova-senha",
    "/api/admin",
    "/api/ai",
    "/api/estudante",
    "/api/simulados",
    "/api/ranking",
    "/api/stats",
    "/api/filtros-simulado",
    "/api/upload",
    "/api/cursos",
  ];

  const isProtected = protectedPrefixes.some(
    (p) => path === p || path.startsWith(p + "/"),
  );

  if (isProtected) {
    // 3.1) Não autenticado
    if (!user) {
      // LOG DE DIAGNÓSTICO
      if (path.startsWith("/api/")) {
        console.error(
          `[MIDDLEWARE-DEBUG] ⛔ 401 Não Autenticado em API: ${path}. Cookie recebido: ${!!sessionCookie}`,
        );
        return jsonResponse({ error: "Não autenticado" }, { status: 401 });
      }
      const resp = NextResponse.redirect(new URL("/login", request.url));
      if (sessionCookie) resp.cookies.delete(AUTH_COOKIE_NAME);
      return addSecurityHeaders(resp);
    }

    // 3.2) Mudança de senha obrigatória
    if (
      user.mudancaSenhaObrigatoria &&
      !path.startsWith("/nova-senha") &&
      !path.startsWith("/api/auth")
    ) {
      return redirectResponse(new URL("/nova-senha", request.url));
    }

    // 3.3) RBAC (Admin)
    const isAdminPath =
      path === "/admin" ||
      path.startsWith("/admin/") ||
      path === "/api/admin" ||
      path.startsWith("/api/admin/") ||
      path === "/api/ai/generate" ||
      path.startsWith("/api/ai/generate/");

    if (
      isAdminPath &&
      user.role !== "PROFESSOR" &&
      user.role !== "SUPER_ADMIN"
    ) {
      if (path.startsWith("/api/")) {
        return jsonResponse({ error: "Acesso negado" }, { status: 403 });
      }
      return redirectResponse(new URL("/estudante", request.url));
    }

    // 3.4) RBAC (Escolha de Perfil)
    if (path === "/escolha-perfil" && user.role === "ALUNO") {
      return redirectResponse(new URL("/estudante", request.url));
    }
  }

  // 4) Sliding session
  let response = NextResponse.next();
  if (user && !path.startsWith("/api/")) {
    response = await updateSessionEdge(user);
  }

  return addSecurityHeaders(response);
}

export const config = {
  matcher: [
    // Pages
    "/admin/:path*",
    "/professor/:path*",
    "/escolha-perfil",
    "/estudante/:path*",
    "/simulado/:path*",
    "/nova-senha",
    "/login",

    // APIs
    "/api/auth/:path*",
    "/api/admin/:path*",
    "/api/ai/:path*",
    "/api/estudante/:path*",
    "/api/simulados/:path*",
    "/api/ranking/:path*",
    "/api/stats/:path*",
    "/api/filtros-simulado/:path*",
    "/api/upload/:path*",

    "/api/cursos/:path*",

    "/api/csrf/:path*",
    "/api/cron/:path*",
  ],
};
