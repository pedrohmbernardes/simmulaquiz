// lib/storage/supabase.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

/**
 * ⚠️ ATENÇÃO (SEGURANÇA)
 * - Este módulo usa SUPABASE_SERVICE_ROLE_KEY (chave ADMIN). Ele NÃO pode ir para o client.
 * - Use APENAS em rotas server-side (runtime nodejs), nunca em Components/Client.
 */
function assertServerOnly() {
  if (typeof window !== 'undefined') {
    throw new Error('Supabase admin client não pode ser usado no client.');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    throw new Error('Supabase admin client deve rodar apenas em runtime nodejs (não Edge).');
  }
}

/**
 * ✅ Buckets
 * - Público: questões/imagens do conteúdo (mantém compat com o seu fluxo atual)
 * - Privado: fotos de perfil (avatar)
 *
 * IMPORTANTE:
 * - Crie o bucket privado no painel do Supabase com este nome:
 *   simmulaquiz-perfis  (PRIVATE)
 * - O bucket simmulaquiz-assets pode permanecer PUBLIC para não quebrar imagens de questões.
 */
const BUCKET_PUBLIC = 'simmulaquiz-assets' as const;
const BUCKET_PRIVATE = 'simmulaquiz-perfis' as const;

const SAFE_EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function getEnv(name: string): string | null {
  const v = process.env[name];
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

function getSupabaseUrl(): string | null {
  return getEnv('SUPABASE_URL') ?? getEnv('NEXT_PUBLIC_SUPABASE_URL');
}

function getServiceRoleKey(): string | null {
  return getEnv('SUPABASE_SERVICE_ROLE_KEY');
}

let _client: SupabaseClient | null = null;

function getAdminClient(): SupabaseClient {
  assertServerOnly();

  const url = getSupabaseUrl();
  const key = getServiceRoleKey();

  if (!url || !key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos.');
    }
    throw new Error('Supabase env ausentes (dev). Defina SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY.');
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

function sanitizeExtFromMime(mime: string | undefined, fallbackName?: string): string {
  const m = (mime ?? '').toLowerCase().trim();
  const byMime = SAFE_EXT_BY_MIME[m];
  if (byMime) return byMime;

  const name = (fallbackName ?? '').toLowerCase();
  const match = name.match(/\.([a-z0-9]{1,8})$/i);
  const ext = match?.[1] ?? 'bin';
  return ext.replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
}

export type UploadFolder = 'questoes' | 'perfis';

export type UploadResult = {
  /** URL para uso imediato (pública p/ questoes; signed p/ perfis) */
  url: string;
  /** Path interno no bucket (use isso para persistir no banco quando for perfis) */
  path: string;
  bucket: typeof BUCKET_PUBLIC | typeof BUCKET_PRIVATE;
};

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/**
 * Gera Signed URL para um path do bucket PRIVADO (perfis).
 */
export async function getSignedUrlForPerfil(path: string, expiresInSeconds = 60 * 60): Promise<string> {
  const supabaseAdmin = getAdminClient();

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_PRIVATE)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) {
    console.error('Erro SignedUrl Supabase (perfis):', error?.message || 'sem signedUrl');
    throw new Error('Falha ao gerar URL assinada');
  }

  return data.signedUrl;
}

/**
 * Resolve a foto do usuário:
 * - se já for URL (legado), retorna como está
 * - se for path (novo), gera signedUrl (bucket privado)
 */
export async function resolveFotoUrl(
  fotoUrlOrPath: string | null | undefined,
  expiresInSeconds = 60 * 60
): Promise<string | null> {
  if (!fotoUrlOrPath) return null;
  if (isHttpUrl(fotoUrlOrPath)) return fotoUrlOrPath;

  // por padrão, tratamos como path de PERFIL
  return getSignedUrlForPerfil(fotoUrlOrPath, expiresInSeconds);
}

/**
 * Upload no Supabase Storage.
 * - questoes => bucket público (retorna URL pública)
 * - perfis   => bucket privado (retorna signed URL p/ uso imediato + path p/ persistência)
 */
export async function uploadImageToSupabase(file: File, folder: UploadFolder): Promise<UploadResult> {
  const supabaseAdmin = getAdminClient();

  const contentType = (file?.type ?? '').toLowerCase().trim();
  const ext = sanitizeExtFromMime(contentType, (file as any)?.name);

  const safeFolder: UploadFolder = folder === 'perfis' ? 'perfis' : 'questoes';

  const bucket = safeFolder === 'perfis' ? BUCKET_PRIVATE : BUCKET_PUBLIC;
  const filePath = `${safeFolder}/${uuidv4()}.${ext}`;

  const { error } = await supabaseAdmin.storage.from(bucket).upload(filePath, file, {
    contentType: contentType || undefined,
    upsert: false,
    cacheControl: safeFolder === 'perfis' ? '0' : '3600',
  });

  if (error) {
    console.error('Erro Upload Supabase:', error.message);
    throw new Error('Falha no upload da imagem');
  }

  if (safeFolder === 'perfis') {
    // URL assinada para uso imediato (NÃO persistir no banco!)
    const signedUrl = await getSignedUrlForPerfil(filePath, 60 * 60 * 24 * 7); // 7 dias
    return { url: signedUrl, path: filePath, bucket };
  }

  // URL pública (questões)
  const { data: publicUrlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(filePath);

  return {
    url: publicUrlData.publicUrl,
    path: filePath,
    bucket,
  };
}
