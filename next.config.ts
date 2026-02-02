import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Headers de segurança para rotas de API e aplicação
  async headers() {
    return [
      {
        source: '/:path*', // Aplica a TODAS as rotas
        headers: [
          // 1. Controle de DNS (Adicionado)
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          // 2. HSTS (Aumentado para 2 anos conforme auditoria)
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // 3. Proteção contra Clickjacking
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // 4. Proteção de MIME Type
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // 5. Proteção XSS (Legado, mas útil)
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // 6. Referrer Policy
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // 7. Permissions Policy (Hardware e Features)
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          // 8. ✅ CONTENT SECURITY POLICY (CSP) - A defesa principal
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Necessário para Next.js
              "style-src 'self' 'unsafe-inline'", // Necessário para CSS-in-JS
              "img-src 'self' data: https:", // Permite imagens locais, base64 e HTTPS externo
              "font-src 'self' data:", 
              "connect-src 'self'", // Restringe chamadas AJAX apenas para o próprio domínio
              "frame-ancestors 'none'", // Bloqueia que seu site seja embedado (iframe)
              "object-src 'none'", // Bloqueia plugins (Flash, etc)
              "base-uri 'self'"
            ].join('; ')
          },
        ],
      },
    ];
  },

  // ✅ ADICIONE ISTO PARA PERMITIR IMAGENS EXTERNAS
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com', // Para avatares do Google
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co', // Se usar Supabase Storage
      },
    ],
  },  
};

export default nextConfig;