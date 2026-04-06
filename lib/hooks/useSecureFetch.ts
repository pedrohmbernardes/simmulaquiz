// ARQUIVO: src/lib/hooks/useSecureFetch.ts
'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface FetchOptions extends Omit<RequestInit, 'body'> {
  body?: any; 
}

export function useSecureFetch() {
  const router = useRouter();

  const secureFetch = useCallback(
    async (url: string, options: FetchOptions = {}) => {
      const { method = 'GET', headers = {}, body, ...rest } = options;
      const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());

      const newHeaders = new Headers(headers);

      // 1. Tratamento Automático de JSON
      if (body && typeof body === 'object' && !(body instanceof FormData)) {
        if (!newHeaders.has('Content-Type')) {
          newHeaders.set('Content-Type', 'application/json');
        }
      }

      // 2. Injeção de Segurança (CSRF) Dinâmica e à prova de falhas
      if (isMutation) {
        // Tenta buscar da meta tag primeiro (mais rápido se vier do SSR)
        let csrfToken = typeof document !== 'undefined' 
          ? document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') 
          : null;

        // Se a meta tag falhou ou não existe (Navegação SPA), busca direto da sua API
        if (!csrfToken) {
          try {
            const csrfRes = await fetch('/api/csrf');
            if (csrfRes.ok) {
              const data = await csrfRes.json();
              csrfToken = data.token;
            }
          } catch (error) {
            console.warn('[SECURE-FETCH] ⚠️ Alerta: Falha ao buscar CSRF dinamicamente.', error);
          }
        }

        // Injeta no cabeçalho
        if (csrfToken) {
          newHeaders.set('x-csrf-token', csrfToken);
        } else {
          console.warn('[SECURE-FETCH] ⛔ Erro Crítico: Token CSRF não encontrado em nenhum lugar.');
        }
      }

      const config: RequestInit = {
        ...rest,
        method,
        headers: newHeaders,
        body: (body && typeof body === 'object' && !(body instanceof FormData)) 
          ? JSON.stringify(body) 
          : body,
      };

      try {
        const response = await fetch(url, config);

        // 3. Tratamento Centralizado de Erros
        if (response.status === 401) {
          router.push('/login?reason=session_expired');
          throw new Error('Sessão expirada. Faça login novamente.');
        }

        if (response.status === 403) {
          const data = await response.clone().json().catch(() => ({}));
          const errorMsg = data.error || 'Acesso negado.';
          console.error(`[SECURE-FETCH] ⛔ 403 Forbidden: ${errorMsg}`);
          throw new Error(errorMsg);
        }

        return response;
      } catch (error) {
        throw error;
      }
    },
    [router]
  );

  return secureFetch;
}