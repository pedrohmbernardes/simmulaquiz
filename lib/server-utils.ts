// lib/server-utils.ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";

/**
 * Captura IP do cliente de forma segura em ambientes serverless
 * EXCLUSIVO DE SERVER COMPONENTS / API ROUTES
 */
export async function getClientIp(req?: Request) {
  // Se for API Route e passar req
  if (req) {
    const xff = req.headers.get('x-forwarded-for');
    if (xff) return xff.split(',')[0].trim();
  }

  // Fallback para Server Components
  try {
    const headersList = await headers();
    const xff = headersList.get('x-forwarded-for');
    if (xff) return xff.split(',')[0].trim();
    return '127.0.0.1';
  } catch {
    return '127.0.0.1';
  }
}

/**
 * Padroniza respostas de erro da API.
 */
export function safeApiError(error: unknown, defaultMsg: string) {
  console.error(`❌ API Error: ${defaultMsg}`, error);
  const message = error instanceof Error ? error.message : defaultMsg;
  return NextResponse.json({ error: message }, { status: 500 });
}