import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import crypto from "crypto";

import { uploadImageToSupabase } from "@/lib/storage/supabase";
import { getSession, createSession } from "@/lib/auth";
import { authRateLimit } from "@/lib/ratelimit";
import { AuditAction, registrarLog } from "@/lib/audit";
import { verifyCSRFToken } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { getClientIp, safeApiError } from "@/lib/server-utils";

// ✅ Garante runtime Node (Sharp não funciona no Edge)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}

type SniffedType = "jpeg" | "png" | "webp" | "gif";

async function sniffImageType(buffer: Buffer): Promise<SniffedType | null> {
  if (buffer.length < 12) return null;
  
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpeg";

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) return "png";

  // GIF: "GIF8"
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return "gif";

  // WEBP: "RIFF....WEBP"
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "webp";

  return null;
}

const validTypes = new Set<SniffedType>(["jpeg", "png", "webp", "gif"]);

export async function POST(request: NextRequest) {
  try {
    const ip = await getClientIp(request);

    // 1) Auth
    const session = await getSession();
    if (!session?.sub) return response({ error: "Não autorizado." }, 401);

    const usuarioId = Number(session.sub);
    if (!usuarioId) return response({ error: "Sessão inválida." }, 401);

    // 2) Rate limit
    if (authRateLimit) {
      const { success } = await authRateLimit.limit(`upload-foto:${usuarioId}:${ip}`);
      if (!success) return response({ error: "Muitas requisições. Tente novamente." }, 429);
    }

    // 3) CSRF
    const csrfHeader = request.headers.get("x-csrf-token");
    const csrfOk = await verifyCSRFToken(csrfHeader);
    if (!csrfOk) return response({ error: "Token de segurança inválido ou expirado." }, 403);

    // 4) Parse formData
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return response({ error: "Arquivo inválido." }, 400);
    }

    // 5) Segurança: tamanho + sniff
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > 2 * 1024 * 1024) {
      return response({ error: "Imagem muito grande. Máximo 2MB." }, 413);
    }

    const type = await sniffImageType(buffer);
    if (!type || !validTypes.has(type)) {
      return response({ error: "Formato de imagem inválido ou corrompido." }, 400);
    }

    // 6) Processamento Seguro (Sharp) -> avatar 400x400 webp
    const processedBuffer = await sharp(buffer, { failOnError: false })
      .rotate()
      .resize(400, 400, { fit: "cover", position: "center" })
      .webp({ quality: 80 })
      .toBuffer();

    const fileName = `avatar-${usuarioId}-${crypto.randomUUID()}.webp`;
    const cleanFile = new File([new Uint8Array(processedBuffer)], fileName, { type: "image/webp" });

    // 7) Upload para Storage (Supabase)
    const uploadResult = await uploadImageToSupabase(cleanFile, "perfis");
    if (!uploadResult?.path || !uploadResult?.url) {
      throw new Error("Falha ao salvar no storage.");
    }

    // 8) ✅ Atualização Atômica no Banco
    // Mantemos o nome do campo (fotoUrl), mas agora ele guarda o *PATH* no bucket privado.
    // A URL assinada (uploadResult.url) é temporária e deve ser usada só para exibição imediata.
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { fotoUrl: uploadResult.path }
    });

    // 9) ✅ Atualiza Sessão (Cookie)
    // Para não quebrar o UI imediatamente, mantemos na sessão uma URL assinada (temporária).
    await createSession({
      ...session,
      avatarUrl: uploadResult.url
    });

    // 10) Auditoria
    await registrarLog({
      acao: AuditAction.FOTO_USUARIO_ALTERADA,
      usuarioId,
      usuarioNome: session.name,
      detalhes: { 
        path: uploadResult.path,
        tamanhoOriginal: file.size,
        tamanhoFinal: processedBuffer.length
      },
      ip
    });

    return response({ success: true, url: uploadResult.url }, 200);

  } catch (error) {
    console.error("Erro em estudante/upload-foto:", error instanceof Error ? error.message : String(error));
    return safeApiError(error, "Falha ao processar imagem.");
  }
}
