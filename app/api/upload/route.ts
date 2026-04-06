import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { uploadFileToSupabase, UploadFolder } from "@/lib/storage/supabase";
import { safeApiError } from "@/lib/server-utils";
import { adminContentRateLimit } from "@/lib/ratelimit";

// Configuração de Limites
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

/**
 * 🛡️ FUNÇÃO DE SEGURANÇA
 * Verifica se o buffer contém assinaturas de arquivos PDF reais
 * e procura por comandos perigosos (scripts maliciosos).
 */
async function scanFileForThreats(file: File): Promise<{ safe: boolean; reason?: string }> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  
  // 1. Validação de Magic Bytes (Assinatura do Arquivo)
  // PDFs devem começar com %PDF (Hex: 25 50 44 46)
  if (file.type === "application/pdf") {
    const isPDF = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
    if (!isPDF) {
      return { safe: false, reason: "Assinatura do arquivo inválida. O arquivo não é um PDF real." };
    }

    // 2. Varredura por Scripts Maliciosos (Conversão para String para buscar padrões)
    // Nota: Isso é uma heurística. Lê o arquivo como texto para achar tags perigosas.
    const decoder = new TextDecoder("utf-8");
    // Lemos apenas os primeiros e últimos 100KB para performance, ou o arquivo todo se for pequeno
    // Para segurança máxima em PDFs, o ideal é ler tudo, mas cuidado com memória.
    // Aqui vamos converter o buffer todo, pois o limite é 10MB (aceitável para Node moderno).
    const content = decoder.decode(bytes);

    // Lista de comandos perigosos em PDF
    const suspiciousPatterns = [
      "/JavaScript",  // Scripts embutidos
      "/JS",          // Abreviação de JavaScript
      "/OpenAction",  // Executa algo ao abrir
      "/AA",          // Additional Actions (Gatilhos automáticos)
      "/Launch",      // Tenta abrir programas externos (.exe, .bat)
      "/RichMedia"    // Pode conter Flash ou scripts complexos
    ];

    for (const pattern of suspiciousPatterns) {
      if (content.includes(pattern)) {
        return { 
          safe: false, 
          reason: `Conteúdo potencialmente perigoso detectado (${pattern}). PDFs com scripts ou ações automáticas não são permitidos.` 
        };
      }
    }
  }

  return { safe: true };
}

export async function POST(req: NextRequest) {
  try {
    // 1. Segurança: Autenticação
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 401 });
    }

    // 2. Rate Limiting (Proteção contra DOS)
    const { success } = await adminContentRateLimit.limit(`upload:${session.sub}`);
    if (!success) {
      return NextResponse.json({ error: "Muitos uploads. Aguarde um pouco." }, { status: 429 });
    }

    // 3. Processamento do Form
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folder = formData.get("folder") as string;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }

    // 4. Validações Básicas
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Arquivo muito grande. Máximo 10MB." }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Tipo de arquivo não permitido." }, { status: 400 });
    }

    const allowedFolders: UploadFolder[] = ["questoes", "perfis", "materiais"];
    if (!allowedFolders.includes(folder as UploadFolder)) {
      return NextResponse.json({ error: "Pasta de destino inválida." }, { status: 400 });
    }

    // 5. 🛡️ VARREDURA DE SEGURANÇA (Antes de enviar ao Supabase)
    const securityCheck = await scanFileForThreats(file);
    if (!securityCheck.safe) {
      // Logamos a tentativa de upload malicioso para auditoria futura
      console.warn(`[SECURITY BLOCK] Usuário ${session.sub} tentou subir arquivo suspeito: ${file.name}. Motivo: ${securityCheck.reason}`);
      
      return NextResponse.json(
        { error: securityCheck.reason || "Arquivo bloqueado por segurança." }, 
        { status: 422 } // Unprocessable Entity
      );
    }

    // 6. Upload Seguro para o Supabase
    const result = await uploadFileToSupabase(file, folder as UploadFolder);

    return NextResponse.json(result, { status: 201 });

  } catch (error) {
    return safeApiError(error, "Erro ao processar upload.");
  }
}