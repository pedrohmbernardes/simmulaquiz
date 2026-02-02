"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { UploadCloud, X, Loader2 } from "lucide-react";
import Image from "next/image";

interface ImageUploaderProps {
  onUploadComplete: (data: { url: string; filename: string; mimeType: string; size: number }) => void;
  onRemove: () => void;
  currentImageUrl?: string;

  /**
   * Endpoint de upload (default: rota protegida do perfil).
   * Se usar esse componente em outro lugar, sobrescreva.
   */
  uploadEndpoint?: string;

  /** Tamanho máximo em bytes (default: 5MB) */
  maxBytes?: number;
}

type CsrfApiResponse = { csrfToken?: string; token?: string; csrf?: string };

// Cache simples em memória pra evitar spam no /api/csrf
let cachedCsrfToken: string | null = null;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function fetchCsrfToken(): Promise<string> {
  // 1) tenta cookie (se não for HttpOnly)
  const fromCookie = readCookie("csrf-token");
  if (fromCookie) return fromCookie;

  // 2) fallback: pede ao servidor (funciona mesmo com cookie HttpOnly, se a rota retornar token no JSON)
  const res = await fetch("/api/csrf", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Cache-Control": "no-store" },
  });

  let token: string | null = null;

  try {
    const data = (await res.json()) as CsrfApiResponse;
    token = data.csrfToken ?? data.token ?? data.csrf ?? null;
  } catch {
    // ignora parse
  }

  // 3) alguns setups só setam cookie; tenta de novo
  token = token || readCookie("csrf-token");

  if (!token) throw new Error("Não foi possível obter o token de segurança. Recarregue a página.");
  return token;
}

async function getCsrfToken(opts?: { forceRefresh?: boolean }): Promise<string> {
  const forceRefresh = opts?.forceRefresh ?? false;
  if (!forceRefresh && cachedCsrfToken) return cachedCsrfToken;

  const token = await fetchCsrfToken();
  cachedCsrfToken = token;
  return token;
}

function extractErrorMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const anyData = data as Record<string, unknown>;
  return typeof anyData.error === "string" ? anyData.error : null;
}

function isLikelyCsrfError(status: number, data: unknown): boolean {
  if (status !== 403) return false;
  const msg = (extractErrorMessage(data) || "").toLowerCase();
  return msg.includes("token") || msg.includes("csrf") || msg.includes("segurança");
}

export function ImageUploader({
  onUploadComplete,
  onRemove,
  currentImageUrl,
  uploadEndpoint = "/api/estudante/upload-foto",
  maxBytes = 5 * 1024 * 1024,
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null);
  const [error, setError] = useState<string | null>(null);

  const objectUrlRef = useRef<string | null>(null);
  const allowedTypes = useMemo(() => new Set(["image/jpeg", "image/png", "image/webp"]), []);

  useEffect(() => {
    setPreview(currentImageUrl || null);
  }, [currentImageUrl]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    };
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // validações client-side coerentes com a rota
    if (!allowedTypes.has(file.type)) {
      setError("Formato inválido. Use JPG, PNG ou WEBP.");
      e.target.value = "";
      return;
    }

    if (file.size > maxBytes) {
      setError(`Arquivo muito grande (máx ${(maxBytes / (1024 * 1024)).toFixed(0)}MB).`);
      e.target.value = "";
      return;
    }

    // preview imediato
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;
    setPreview(objectUrl);

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      let csrf = await getCsrfToken();

      let response = await fetch(uploadEndpoint, {
        method: "POST",
        body: formData,
        credentials: "same-origin",
        headers: { "x-csrf-token": csrf },
      });

      let data: unknown = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      // retry 1x se token expirou/rotacionou
      if (!response.ok && isLikelyCsrfError(response.status, data)) {
        csrf = await getCsrfToken({ forceRefresh: true });

        response = await fetch(uploadEndpoint, {
          method: "POST",
          body: formData,
          credentials: "same-origin",
          headers: { "x-csrf-token": csrf },
        });

        try {
          data = await response.json();
        } catch {
          data = null;
        }
      }

      if (!response.ok) {
        throw new Error(extractErrorMessage(data) || "Erro no upload.");
      }

      const anyData = (data || {}) as Record<string, unknown>;
      const url =
        (typeof anyData.url === "string" && anyData.url) ||
        (anyData.data && typeof (anyData.data as any).url === "string" && (anyData.data as any).url) ||
        (typeof anyData.publicUrl === "string" && anyData.publicUrl) ||
        (typeof anyData.fileUrl === "string" && anyData.fileUrl);

      if (!url) throw new Error("Upload concluído, mas a URL não foi retornada.");

      onUploadComplete({
        url,
        filename: file.name,
        mimeType: file.type,
        size: file.size,
      });
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Falha ao enviar imagem. Tente novamente.");

      // reverte preview
      setPreview(currentImageUrl || null);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleRemove = () => {
    setError(null);
    setPreview(null);

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;

    onRemove();
  };

  return (
    <div className="w-full">
      {preview ? (
        <div className="relative mt-2 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 group">
          <div className="relative h-64 w-full">
            <Image src={preview} alt="Preview" fill className="object-contain" unoptimized />
          </div>

          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Loader2 className="animate-spin text-white" size={32} />
            </div>
          )}

          {!uploading && (
            <button
              onClick={handleRemove}
              type="button"
              className="absolute top-2 right-2 rounded-full bg-red-500 p-1.5 text-white shadow-sm transition hover:bg-red-600"
              title="Remover imagem"
            >
              <X size={16} />
            </button>
          )}
        </div>
      ) : (
        <label className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 transition hover:bg-gray-100 hover:border-blue-400">
          <div className="flex flex-col items-center justify-center pb-6 pt-5">
            <UploadCloud className="mb-3 h-8 w-8 text-gray-400" />
            <p className="mb-2 text-sm text-gray-500">
              <span className="font-semibold text-blue-600">Clique para enviar</span> ou arraste
            </p>
            <p className="text-xs text-gray-500">
              PNG, JPG ou WEBP (Max. {(maxBytes / (1024 * 1024)).toFixed(0)}MB)
            </p>
          </div>

          <input
            type="file"
            className="hidden"
            accept="image/png, image/jpeg, image/webp"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </label>
      )}

      {error && <p className="mt-2 text-xs font-bold text-red-500">{error}</p>}
    </div>
  );
}
