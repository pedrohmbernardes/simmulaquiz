This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## 🛡️ Segurança e Engenharia (V2.1)

Este projeto passou por uma auditoria rigorosa de segurança e implementa práticas de defesa em profundidade:

### 🔒 Proteção e Compliance

- **Logs de Auditoria (Audit Trails):** Rastreabilidade completa de ações críticas (Login, Gestão de Usuários, Notas) para compliance.
- **Rate Limiting:** Proteção contra força bruta em rotas de autenticação (via Upstash Redis com Fallback de Memória).
- **Sanitização de Uploads:** Verificação de "Magic Numbers" (assinatura binária) para impedir upload de scripts maliciosos mascarados de imagem.

### ⚙️ Integridade de Dados

- **Transações Atômicas:** Garantia de consistência entre Nota do Simulado, XP de Gamificação e Conquistas.
- **Optimistic Locking:** Prevenção contra "Race Conditions" (ex: duplo clique ao finalizar prova) garantindo integridade das notas.
- **Validação Estrita (Zod):** Camada de validação profunda de payloads para prevenir Injeção e DoS.

### 🧪 Qualidade de Código

- **Testes Automatizados (Jest):** Cobertura de testes unitários e de integração para fluxos críticos (Gamificação e RBAC).
- **Segurança de Rotas (RBAC):** Middleware e verificações de backend garantindo que Super Admins não possam deletar uns aos outros.
