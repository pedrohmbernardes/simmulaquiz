import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utilitário para mesclar classes do Tailwind de forma inteligente.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extrai o IP "mais provável" do cliente.
 * Observação: headers podem ser spoofados fora de infra de proxy/CDN.
 * Em rotas autenticadas, sempre combine IP + userId na chave do rate limit (você já faz isso).
 */
export function getClientIp(req: Request): string {
  const h = req.headers;

  const xff = h.get("x-forwarded-for");
  let ip =
    (xff ? xff.split(",")[0]?.trim() : "") ||
    h.get("x-real-ip") ||
    h.get("cf-connecting-ip") || // Cloudflare
    h.get("true-client-ip") || // alguns CDNs
    "unknown";

  ip = ip.trim();

  // Remove prefixo comum IPv4-mapeado em IPv6
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);

  // Remove formato [IPv6]:porta
  const bracketMatch = ip.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketMatch?.[1]) ip = bracketMatch[1];

  // Remove porta se for IPv4:porta
  const ipv4PortMatch = ip.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/);
  if (ipv4PortMatch?.[1]) ip = ipv4PortMatch[1];

  // Sanitiza (evita log/header injection). Mantém chars úteis pra IPv6.
  ip = ip.replace(/[^\w.\-:]/g, "").slice(0, 80);

  return ip || "unknown";
}

function jsonNoStore(body: unknown, status = 500): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

/**
 * Tratamento centralizado de erros de API para evitar vazamento de detalhes.
 * - Em produção: mensagem genérica
 * - Em dev: pode retornar error.message (sem stack)
 */
export function safeApiError(
  error: unknown,
  userMessage = "Ocorreu um erro interno. Tente novamente mais tarde.",
  status = 500
): Response {
  const isDev = process.env.NODE_ENV === "development";

  const errorId =
    (globalThis.crypto && "randomUUID" in globalThis.crypto && globalThis.crypto.randomUUID()) ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  // Log completo só no servidor
  console.error(
    `🔥 [API_ERROR:${errorId}]`,
    error instanceof Error ? error.stack || error.message : error
  );

  const msg = isDev && error instanceof Error ? error.message : userMessage;

  // Mantém shape atual: { error: string }
  return jsonNoStore({ error: msg }, status);
}
