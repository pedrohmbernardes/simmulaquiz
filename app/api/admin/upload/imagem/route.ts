import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import crypto from "crypto";

import { uploadImageToSupabase } from "@/lib/storage/supabase"; // Reutiliza sua função existente
import { getSession } from "@/lib/auth";
import { adminContentRateLimit } from "@/lib/ratelimit"; // ✅ Limite correto para admins
import { AuditAction, registrarLog } from "@/lib/audit";
import { verifyCSRFToken } from "@/lib/csrf";
import { getClientIp, safeApiError } from "@/lib/utils";

// ✅ Garante runtime Node
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
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpeg";
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "png";
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return "gif";
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

const validTypes = new Set<SniffedType>(["jpeg", "png", "webp", "gif"]);

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    // 1) Auth - Apenas Admin/Professor
    const session = await getSession();
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'PROFESSOR')) {
      return response({ error: "Acesso Negado." }, 403);
    }

    const usuarioId = Number(session.sub);

    // 2) Rate Limit Otimizado (Admin Content)
    if (adminContentRateLimit) {
      const { success } = await adminContentRateLimit.limit(`admin-upload:${usuarioId}:${ip}`);
      if (!success) return response({ error: "Você está enviando muito rápido. Aguarde." }, 429);
    }

    // 3) CSRF
    const csrfHeader = request.headers.get("x-csrf-token");
    const csrfOk = await verifyCSRFToken(csrfHeader);
    if (!csrfOk) return response({ error: "Token de segurança inválido." }, 403);

    // 4) Parse File
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return response({ error: "Arquivo inválido." }, 400);
    }

    // 5) Segurança (Tamanho: 5MB para questões é razoável)
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > 5 * 1024 * 1024) {
      return response({ error: "Imagem muito grande. Máximo 5MB." }, 413);
    }

    const type = await sniffImageType(buffer);
    if (!type || !validTypes.has(type)) {
      return response({ error: "Formato inválido." }, 400);
    }

    // 6) Processamento (Sharp) - Otimiza para WebP mas mantém proporção
    // Limita largura a 1200px para não desperdiçar banda, mas não corta (fit: inside)
    const processedBuffer = await sharp(buffer, { failOnError: false })
      .rotate() 
      .resize(1200, 1200, { fit: "inside", withoutEnlargement: true }) 
      .webp({ quality: 85 })
      .toBuffer();

    // Nome único
    const fileName = `questao-${crypto.randomUUID()}.webp`;
    const cleanFile = new File([new Uint8Array(processedBuffer)], fileName, { type: "image/webp" });

    // 7) Upload (Bucket Público)
    // OBS: Certifique-se que sua função uploadImageToSupabase aceita o nome do bucket como 2º parâmetro
    // Se ela não aceitar, precisaremos ajustá-la. Assumindo que sim pelo código anterior:
    const uploadResult = await uploadImageToSupabase(cleanFile, "questoes"); // Mudamos para 'questoes' (seu bucket público)
    
    if (!uploadResult?.url) {
      throw new Error("Falha ao obter URL pública do asset.");
    }

    // 8) Auditoria (Sem alterar tabela de usuário)
    await registrarLog({
      acao: AuditAction.QUESTAO_IMAGEM_UPLOAD, // Certifique-se que esse Enum existe ou use 'MANUAL'
      usuarioId,
      usuarioNome: session.name,
      detalhes: { 
        filename: fileName,
        size: processedBuffer.length,
        bucket: "simmulaquiz-assets"
      },
      ip
    });

    // Retorna os dados para o frontend acoplar ao formulário da questão
    return response({ 
      success: true, 
      url: uploadResult.url, // URL Pública direta
      filename: fileName,
      mimeType: "image/webp",
      size: processedBuffer.length
    }, 200);

  } catch (error) {
    console.error("Erro em admin/upload/imagem:", error instanceof Error ? error.message : String(error));
    return safeApiError(error, "Falha ao processar upload.");
  }
}