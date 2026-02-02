// app/api/upload/imagem/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import sharp, { type Metadata } from 'sharp';

import { uploadImageToSupabase } from '@/lib/storage/supabase';
import { getSession } from '@/lib/auth';
import { authRateLimit } from '@/lib/ratelimit';
import { AuditAction, registrarLog } from '@/lib/audit';
import { getClientIp, safeApiError } from '@/lib/utils';
import { verifyCSRFToken } from '@/lib/csrf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
// multipart tem overhead; deixa uma folga pra não bloquear arquivo "válido"
const MAX_CONTENT_LENGTH_BYTES = MAX_FILE_BYTES + 256 * 1024;

function applyNoStore(res: NextResponse) {
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.headers.set('Pragma', 'no-cache');
  res.headers.set('Expires', '0');
  return res;
}

function noStoreJson(data: unknown, init?: ResponseInit) {
  return applyNoStore(NextResponse.json(data, init));
}

function safeApiErrorNoStore(error: unknown, msg: string) {
  const res = safeApiError(error, msg) as NextResponse;
  return applyNoStore(res);
}

function detectMagicType(buf: Buffer): 'jpeg' | 'png' | 'gif' | 'webp' | null {
  if (buf.length < 12) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) return 'png';

  // GIF: "GIF8"
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'gif';

  // WEBP: "RIFF....WEBP"
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';

  return null;
}

const allowedMime = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const);

export async function POST(request: NextRequest) {
  try {
    // 0) Defesa extra contra payload gigante (multipart tem overhead)
    const contentLength = request.headers.get('content-length');
    if (contentLength && Number(contentLength) > MAX_CONTENT_LENGTH_BYTES) {
      return noStoreJson({ error: `Requisição muito grande. Máximo ~${Math.round(MAX_CONTENT_LENGTH_BYTES / (1024 * 1024))}MB.` }, { status: 413 });
    }

    // 1) Auth (admin only)
    const session = await getSession();
    if (!session?.sub || (session.role !== 'SUPER_ADMIN' && session.role !== 'PROFESSOR')) {
      return noStoreJson({ error: 'Não autorizado' }, { status: 403 });
    }

    const usuarioId = Number(session.sub);
    if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
      return noStoreJson({ error: 'Sessão inválida' }, { status: 401 });
    }

    // 2) CSRF (rota crítica)
    const csrfHeader = request.headers.get('x-csrf-token');
    const csrfOk = await verifyCSRFToken(csrfHeader);
    if (!csrfOk) {
      return noStoreJson(
        { error: 'Token de segurança inválido ou expirado. Recarregue a página.' },
        { status: 403 }
      );
    }

    // 3) Rate limit (chave por usuário + IP)
    const ip = getClientIp(request);
    const rlKey = `upload:imagem:${usuarioId}:${ip}`;
    const rl = await authRateLimit.limit(rlKey);

    if (!rl.success) {
      await registrarLog({
        acao: AuditAction.SISTEMA_ERRO,
        usuarioId,
        usuarioNome: session.name,
        detalhes: { erro: 'Rate limit de upload excedido', ip, rota: '/api/upload/imagem' },
      });

      return noStoreJson(
        { error: 'Muitos uploads. Aguarde e tente novamente.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(rl.limit),
            'X-RateLimit-Remaining': String(rl.remaining),
            'X-RateLimit-Reset': String(rl.reset),
          },
        }
      );
    }

    // 4) FormData
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return noStoreJson({ error: 'FormData inválido.' }, { status: 400 });
    }

    const fileAny = formData.get('file');
    if (!fileAny || typeof fileAny === 'string') {
      return noStoreJson({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }

    const file = fileAny as File;

    // 5) Validações básicas
    if (!allowedMime.has(file.type as any)) {
      return noStoreJson({ error: 'Formato inválido. Use JPG, PNG, WEBP ou GIF.' }, { status: 400 });
    }

    if (!Number.isFinite(file.size) || file.size <= 0) {
      return noStoreJson({ error: 'Arquivo inválido.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return noStoreJson({ error: 'Arquivo muito grande (Máx 5MB).' }, { status: 400 });
    }

    // 6) Buffer (com try/catch defensivo)
    let fileBuffer: Buffer;
    try {
      fileBuffer = Buffer.from(await file.arrayBuffer());
    } catch {
      return noStoreJson({ error: 'Falha ao ler o arquivo.' }, { status: 400 });
    }

    // 7) Magic numbers + coerência com MIME
    const magic = detectMagicType(fileBuffer);
    if (!magic) {
      await registrarLog({
        acao: AuditAction.SISTEMA_ERRO,
        usuarioId,
        usuarioNome: session.name,
        detalhes: { erro: 'Magic number inválido', filename: file.name, mime: file.type },
      });
      return noStoreJson({ error: 'Arquivo corrompido ou malicioso.' }, { status: 400 });
    }

    const expectedByMime: Record<string, typeof magic> = {
      'image/jpeg': 'jpeg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    };

    const expected = expectedByMime[file.type] ?? null;
    if (expected && expected !== magic) {
      await registrarLog({
        acao: AuditAction.SISTEMA_ERRO,
        usuarioId,
        usuarioNome: session.name,
        detalhes: { erro: 'MIME não confere com assinatura', filename: file.name, mime: file.type, magic },
      });
      return noStoreJson({ error: 'Arquivo inválido (assinatura não confere).' }, { status: 400 });
    }

    // 8) Sharp: proteção contra decompression bomb + dimensões absurdas + animações
    const MAX_DIMENSION = 2500;
    const MAX_PIXELS = 12_000_000; // ~ 3464x3464
    const image = sharp(fileBuffer, { limitInputPixels: MAX_PIXELS, failOn: 'error', animated: false });

    let metadata: Metadata;
    try {
      metadata = await image.metadata();
    } catch {
      await registrarLog({
        acao: AuditAction.SISTEMA_ERRO,
        usuarioId,
        usuarioNome: session.name,
        detalhes: { erro: 'Sharp metadata falhou', filename: file.name, mime: file.type },
      });
      return noStoreJson({ error: 'Não foi possível ler a imagem.' }, { status: 400 });
    }

    const w = metadata.width ?? 0;
    const h = metadata.height ?? 0;

    if (!w || !h) {
      return noStoreJson({ error: 'Imagem inválida (sem dimensões).' }, { status: 400 });
    }

    if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
      return noStoreJson({ error: `Dimensões excedem o limite de ${MAX_DIMENSION}px.` }, { status: 400 });
    }

    if (typeof metadata.pages === 'number' && metadata.pages > 1) {
      return noStoreJson({ error: 'Imagens animadas não são permitidas.' }, { status: 400 });
    }

    // 9) Sanitiza e otimiza (sempre gera WEBP estático)
    const cleanBuffer = await sharp(fileBuffer, { limitInputPixels: MAX_PIXELS, failOn: 'error', animated: false })
      .rotate()
      .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    const safeName = `${crypto.randomUUID()}.webp`;
    const cleanFile = new File([new Uint8Array(cleanBuffer)], safeName, { type: 'image/webp' });

    // 10) Upload
    const result = await uploadImageToSupabase(cleanFile, 'questoes');
    if (!result?.url) throw new Error('Falha no upload para o storage');

    // 11) Audit sucesso
    await registrarLog({
      acao: AuditAction.FOTO_USUARIO_ALTERADA,
      usuarioId,
      usuarioNome: session.name,
      detalhes: {
        acao: 'Upload Imagem Questões (sanitizado -> WEBP)',
        url: result.url,
        original: { filename: file.name, mime: file.type, size: file.size },
        output: { filename: cleanFile.name, mime: cleanFile.type, size: cleanFile.size },
      },
    });

    return noStoreJson(
      { success: true, url: result.url, filename: cleanFile.name, mimeType: cleanFile.type, size: cleanFile.size },
      { status: 200 }
    );
  } catch (error) {
    return safeApiErrorNoStore(error, 'Falha ao processar o upload da imagem.');
  }
}
