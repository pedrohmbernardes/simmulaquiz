// ARQUIVO: src/hooks/use-csrf.ts
'use client';

import { useState, useEffect } from 'react';

export function useCsrf() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        // Chama a rota que gera o token atrelado à sessão (ou anônimo seguro)
        const res = await fetch('/api/csrf');
        if (res.ok) {
          const data = await res.json();
          setToken(data.token);
        }
      } catch (error) {
        console.error('Erro ao obter token de segurança CSRF:', error);
      }
    };

    fetchToken();
  }, []);

  return token;
}