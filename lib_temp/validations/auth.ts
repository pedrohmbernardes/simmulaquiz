import { z } from 'zod';

// 🛡️ LISTA NEGRA DE DOMÍNIOS TEMPORÁRIOS (ANTI-SPAM)
// (use Set pra lookup O(1))
const DOMINIOS_TEMPORARIOS = new Set([
  '10minutemail.com', 'guerrillamail.com', 'tempmail.com', 'mailinator.com',
  'throwawaymail.com', 'yopmail.com', 'getnada.com', 'dispostable.com',
  'scr.im', 'maildrop.cc', 'sharklasers.com', 'grr.la', 'guerrillamail.net',
  'guerrillamail.org', 'guerrillamail.biz', 'guerrillamailblock.com',
  'spam4.me', 'temp-mail.org', 'temp-mail.ru', 'tempmail.net',
  'throwaway.email', 'trashmail.com',
]);

// Helpers comuns (evita inconsistência entre rotas)
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'E-mail muito longo')
  .email('Formato de e-mail inválido')
  .refine((email) => {
    const at = email.lastIndexOf('@');
    if (at <= 0 || at === email.length - 1) return false;
    const domain = email.slice(at + 1).toLowerCase();
    return !DOMINIOS_TEMPORARIOS.has(domain);
  }, 'E-mails temporários não são permitidos. Use um provedor confiável (Gmail, Outlook, etc).');

const otp6Schema = z
  .string()
  .trim()
  .length(8, 'Código deve ter 8 dígitos')
  .regex(/^\d{8}$/, 'O código deve conter apenas números');

const strongPasswordSchema = z
  .string()
  .min(10, 'Senha deve ter no mínimo 10 caracteres')
  .max(200, 'Senha muito longa')
  .regex(/[A-Z]/, 'Precisa de uma letra maiúscula')
  .regex(/[a-z]/, 'Precisa de uma letra minúscula')
  .regex(/[0-9]/, 'Precisa de um número')
  // mais abrangente do que uma lista fixa de especiais
  .regex(/[^A-Za-z0-9]/, 'Precisa de um caractere especial');

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email('Formato de e-mail inválido'),
  senha: z.string().min(1, 'A senha é obrigatória').max(200, 'Senha muito longa'),
});

export const registerSchema = z.object({
  nome: z.string().trim().min(3, 'Nome deve ter no mínimo 3 caracteres').max(80, 'Nome muito longo'),

  // 🛡️ e-mail reforçado + normalizado
  email: emailSchema,

  dataNascimento: z.coerce
    .date({ message: 'Data de nascimento inválida' })
    .refine((date) => !Number.isNaN(date.getTime()), 'Data de nascimento inválida')
    .refine((date) => date < new Date(), 'A data não pode ser no futuro')
    .refine((date) => {
      const hoje = new Date();
      let idade = hoje.getFullYear() - date.getFullYear();
      const m = hoje.getMonth() - date.getMonth();
      if (m < 0 || (m === 0 && hoje.getDate() < date.getDate())) idade--;
      return idade >= 12;
    }, 'Você deve ter pelo menos 12 anos para se cadastrar')
    .refine((date) => {
      // opcional: evita datas absurdas tipo 1800
      const hoje = new Date();
      const idade = hoje.getFullYear() - date.getFullYear();
      return idade <= 120;
    }, 'Data de nascimento inválida'),

  // 🛡️ senha forte (mesma política)
  senha: strongPasswordSchema,

  // 🛡️ Honeypot (não “trava” spammer; só limita tamanho)
  website: z.string().max(200).optional(),
});

export const verifySchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email('Formato de e-mail inválido'),
  codigo: otp6Schema,
});

export const recuperarSchema = z
  .object({
    action: z.enum(['request', 'reset']),
    email: z.string().trim().toLowerCase().max(254).email('Formato de e-mail inválido'),
    code: otp6Schema.optional(),
    newPassword: strongPasswordSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action === 'reset') {
      if (!data.code) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['code'], message: 'Código é obrigatório para redefinição' });
      }
      if (!data.newPassword) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['newPassword'],
          message: 'Nova senha é obrigatória para redefinição',
        });
      }
    }
  });

export const novaSenhaSchema = z.object({
  // ⚠️ A rota ignora email do body (anti-IDOR), então não obrigamos.
  // Se o front ainda mandar, passa. Se não mandar, também passa.
  email: z.string().trim().toLowerCase().max(254).email('Formato de e-mail inválido').optional(),

  senhaAtual: z.string().min(1, 'Senha atual é obrigatória').max(200, 'Senha muito longa'),

  // ✅ mantém política forte também aqui (evita downgrade de segurança)
  novaSenha: strongPasswordSchema,
});
