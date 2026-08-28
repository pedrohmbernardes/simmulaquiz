// lib/storage/supabase.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

/**
 * ⚠️ ATENÇÃO (SEGURANÇA)
 * - Este módulo usa SUPABASE_SERVICE_ROLE_KEY (chave ADMIN). Ele NÃO pode ir para o client.
 * - Use APENAS em rotas server-side (runtime nodejs), nunca em Components/Client.
 */
function assertServerOnly() {
  if (typeof window !== "undefined") {
    throw new Error("Supabase admin client não pode ser usado no client.");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    throw new Error(
      "Supabase admin client deve rodar apenas em runtime nodejs (não Edge).",
    );
  }
}

/**
 * ✅ Buckets
 * - Public: questoes, materiais
 * - Private: perfis
 */
const BUCKET_ASSETS = "simmulaquiz-assets" as const; // Imagens de questões
const BUCKET_PERFIS = "simmulaquiz-perfis" as const; // Privado
const BUCKET_MATERIAIS = "turma-materiais" as const; // Novo bucket público para PDFs

const SAFE_EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf", // ✅ Suporte a PDF adicionado
};

function getEnv(name: string): string | null {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

function getSupabaseUrl(): string | null {
  return getEnv("SUPABASE_URL") ?? getEnv("NEXT_PUBLIC_SUPABASE_URL");
}

function getServiceRoleKey(): string | null {
  return getEnv("SUPABASE_SERVICE_ROLE_KEY");
}

let _client: SupabaseClient | null = null;

function getAdminClient(): SupabaseClient {
  assertServerOnly();

  const url = getSupabaseUrl();
  const key = getServiceRoleKey();

  if (!url || !key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "FATAL: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos.",
      );
    }
    throw new Error("Supabase env ausentes (dev).");
  }

  if (_client) return _client;

  _client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return _client;
}

function sanitizeExtFromMime(
  mime: string | undefined,
  fallbackName?: string,
): string {
  const m = (mime ?? "").toLowerCase().trim();
  const byMime = SAFE_EXT_BY_MIME[m];
  if (byMime) return byMime;

  const name = (fallbackName ?? "").toLowerCase();
  const match = name.match(/\.([a-z0-9]{1,8})$/i);
  const ext = match?.[1] ?? "bin";
  return ext.replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
}

// ✅ Adicionado 'materiais'
export type UploadFolder = "questoes" | "perfis" | "materiais";

export type UploadResult = {
  url: string;
  path: string;
  bucket: string;
};

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export async function getSignedUrlForPerfil(
  path: string,
  expiresInSeconds = 60 * 60,
): Promise<string> {
  const supabaseAdmin = getAdminClient();
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_PERFIS)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error("Falha ao gerar URL assinada");
  }
  return data.signedUrl;
}

// Extrai o path real de dentro de uma signed/public URL do bucket de perfis.
// Retorna null se a URL não for reconhecida (aí devolvemos ela como está, sem risco).
export function extractPerfilPathFromUrl(url: string): string | null {
  if (!isHttpUrl(url)) return null;

  const signedMarker = `/object/sign/${BUCKET_PERFIS}/`;
  const idxSigned = url.indexOf(signedMarker);
  if (idxSigned !== -1) {
    const raw = url.slice(idxSigned + signedMarker.length).split("?")[0];
    return raw ? decodeURIComponent(raw) : null;
  }

  const publicMarker = `/object/public/${BUCKET_PERFIS}/`;
  const idxPublic = url.indexOf(publicMarker);
  if (idxPublic !== -1) {
    const raw = url.slice(idxPublic + publicMarker.length).split("?")[0];
    return raw ? decodeURIComponent(raw) : null;
  }

  return null;
}

export async function resolveFotoUrl(
  fotoUrlOrPath: string | null | undefined,
  expiresInSeconds = 60 * 60,
): Promise<string | null> {
  if (!fotoUrlOrPath) return null;

  if (isHttpUrl(fotoUrlOrPath)) {
    const path = extractPerfilPathFromUrl(fotoUrlOrPath);
    if (path) {
      try {
        return await getSignedUrlForPerfil(path, expiresInSeconds); // ✅ re-assina de verdade
      } catch {
        return fotoUrlOrPath; // fallback só pra não quebrar a UI numa falha pontual
      }
    }
    return fotoUrlOrPath; // URL de origem desconhecida — comportamento antigo preservado
  }

  return getSignedUrlForPerfil(fotoUrlOrPath, expiresInSeconds);
}

/**
 * Upload Genérico (Imagens ou PDF)
 */
export async function uploadFileToSupabase(
  file: File,
  folder: UploadFolder,
): Promise<UploadResult> {
  const supabaseAdmin = getAdminClient();

  const contentType = (file?.type ?? "").toLowerCase().trim();
  const ext = sanitizeExtFromMime(contentType, (file as any)?.name);

  // Seleção de Bucket
  let bucket: string;
  if (folder === "perfis") bucket = BUCKET_PERFIS;
  else if (folder === "materiais") bucket = BUCKET_MATERIAIS;
  else bucket = BUCKET_ASSETS; // default 'questoes'

  const filePath = `${folder}/${uuidv4()}.${ext}`;

  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(filePath, file, {
      contentType: contentType || undefined,
      upsert: false,
      cacheControl: folder === "perfis" ? "0" : "3600",
    });

  if (error) {
    console.error("Erro Upload Supabase:", error.message);
    throw new Error("Falha no upload do arquivo");
  }

  // Se for privado (perfis), retorna signed url temporária
  if (bucket === BUCKET_PERFIS) {
    const signedUrl = await getSignedUrlForPerfil(filePath, 60 * 60 * 24);
    return { url: signedUrl, path: filePath, bucket };
  }

  // Se for público (questoes, materiais), retorna public url
  const { data: publicUrlData } = supabaseAdmin.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return {
    url: publicUrlData.publicUrl,
    path: filePath,
    bucket,
  };
}

// Mantendo compatibilidade com código antigo (alias)
export const uploadImageToSupabase = uploadFileToSupabase;
