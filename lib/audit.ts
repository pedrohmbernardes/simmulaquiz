import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { headers as nextHeaders } from 'next/headers';
import { getClientIp } from '@/lib/utils';

// ✅ Ações padronizadas
export const AuditAction = {
  // Autenticação
  LOGIN_SUCESSO: 'LOGIN_SUCESSO',
  LOGIN_FALHA: 'LOGIN_FALHA',
  LOGIN_BLOQUEADO: 'LOGIN_BLOQUEADO_INATIVIDADE',
  LOGIN_FALHA_DESATIVADO: 'LOGIN_FALHA_DESATIVADO',
  LOGIN_RATE_LIMIT: 'LOGIN_RATE_LIMIT',
  LOGOUT_SUCESSO: 'LOGOUT_SUCESSO',

  // Usuários
  USUARIO_CRIAR: 'USUARIO_CRIAR',
  USUARIO_ATUALIZAR: 'USUARIO_ATUALIZAR',
  USUARIO_EXCLUIR: 'USUARIO_EXCLUIR',
  USUARIO_RECUPERAR_SENHA: 'USUARIO_RECUPERAR_SENHA',
  USUARIO_NOVA_SENHA: 'USUARIO_NOVA_SENHA',

  FOTO_USUARIO_ALTERADA: 'FOTO_USUARIO_ALTERADA',

  // Questões
  QUESTAO_CRIAR: 'QUESTAO_CRIAR',
  QUESTAO_EDITAR: 'QUESTAO_EDITAR',
  QUESTAO_EXCLUIR: 'QUESTAO_EXCLUIR',
  QUESTAO_IMAGEM_UPLOAD: 'QUESTAO_IMAGEM_UPLOAD',

  // Simulados
  SIMULADO_INICIAR: 'SIMULADO_INICIAR',
  SIMULADO_FINALIZAR: 'SIMULADO_FINALIZAR',
  SIMULADO_ABANDONAR: 'SIMULADO_ABANDONAR',
  SIMULADO_ANULADO_FRAUDE: 'SIMULADO_ANULADO_FRAUDE',

  // Segurança
  SEGURANCA_CSRF_INVALIDO: 'SEGURANCA_CSRF_INVALIDO',
  SEGURANCA_IDOR_TENTATIVA: 'SEGURANCA_IDOR_TENTATIVA',
  SEGURANCA_RATE_LIMIT: 'SEGURANCA_RATE_LIMIT',
  SEGURANCA_TOKEN_INVALIDO: 'SEGURANCA_TOKEN_INVALIDO',
  SEGURANCA_ACESSO_NEGADO: 'SEGURANCA_ACESSO_NEGADO',

  // Sistema & Manutenção
  SISTEMA_ERRO: 'SISTEMA_ERRO',
  SISTEMA_CLEANUP: 'SISTEMA_CLEANUP',
  CLEANUP_BLACKLIST: 'CLEANUP_BLACKLIST',
  SISTEMA_BACKUP: 'SISTEMA_BACKUP',

  // 🤖 NOVA AÇÃO IA
  IA_GERAR_QUESTOES: 'IA_GERAR_QUESTOES',
  IA_ANALISE_DESEMPENHO: 'IA_ANALISE_DESEMPENHO',

} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

type JsonPrimitive = string | number | boolean | null;
export type JsonLike = JsonPrimitive | { [k: string]: JsonLike } | JsonLike[];

const LIMITS = {
  ip: 60,
  userAgent: 250,
  recurso: 180,
  usuarioNome: 120,
  detalhesMaxChars: 8000,
  scrubMaxDepth: 6,
  scrubMaxNodes: 2000,
} as const;

const SENSITIVE_KEYS_EXACT = new Set([
  'senha',
  'password',
  'senhaHash',
  'confirmarSenha',
  'novaSenha',
  'senhaAtual',
  'token',
  'accessToken',
  'refreshToken',
  'code',
  'codigo',
  'otp',
  'authorization',
  'cookie',
  'set-cookie',
]);

// não queremos remover isso só por conter “token”
const SENSITIVE_EXCEPTIONS = new Set(['tokenVersion']);

const SENSITIVE_KEY_REGEX: RegExp[] = [
  /secret/i,
  /bearer/i,
  /^x-.*token$/i,
  /api[-_]?key/i,
];

function normalizeString(input: unknown, maxLen: number, fallback = 'unknown') {
  if (typeof input !== 'string') return fallback;
  const cleaned = input.replace(/[\r\n\t]/g, ' ').trim();
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) : cleaned;
}

export async function safeHeaders(requestHeaders?: Headers): Promise<Headers> {
  // Se já recebeu headers, retorna eles
  if (requestHeaders) return requestHeaders;

  try {
    // 1. Adicionamos 'await' porque nextHeaders() agora é uma Promise
    const headerList = await nextHeaders();
    
    // 2. Criamos um 'new Headers()' passando a lista.
    // Isso resolve o erro de tipos (ReadonlyHeaders vs Headers) e permite retornar um objeto padrão.
    return new Headers(headerList);
  } catch {
    return new Headers();
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function shouldRedactKey(key: string) {
  if (SENSITIVE_EXCEPTIONS.has(key)) return false;
  if (SENSITIVE_KEYS_EXACT.has(key)) return true;
  return SENSITIVE_KEY_REGEX.some((re) => re.test(key));
}

// Scrub recursivo com limites (evita DoS por objetos gigantes)
function scrubSensitiveDeep(value: unknown, depth = 0, state = { nodes: 0 }): unknown {
  state.nodes++;
  if (state.nodes > LIMITS.scrubMaxNodes) return { truncated: true, reason: 'max_nodes' };

  if (depth > LIMITS.scrubMaxDepth) return { truncated: true, reason: 'max_depth' };

  if (Array.isArray(value)) {
    return value.map((v) => scrubSensitiveDeep(v, depth + 1, state));
  }

  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (shouldRedactKey(k)) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = scrubSensitiveDeep(v, depth + 1, state);
      }
    }
    return out;
  }

  return value;
}

function toJsonSerializable(input: unknown): unknown {
  const seen = new WeakSet<object>();

  return JSON.parse(
    JSON.stringify(input, (_key, value) => {
      if (typeof value === 'bigint') return value.toString();

      if (typeof value === 'object' && value !== null) {
        if (seen.has(value as object)) return '[Circular]';
        seen.add(value as object);
      }

      return value;
    })
  );
}

// Mantém o que for serializável + corta payloads gigantes
function safeJson(detalhes?: JsonLike): Prisma.InputJsonValue | undefined {
  if (detalhes === undefined) return undefined;

  try {
    const scrubbed = scrubSensitiveDeep(detalhes) as unknown;
    const json = toJsonSerializable(scrubbed) as Prisma.InputJsonValue;

    const raw = JSON.stringify(json);
    if (raw.length > LIMITS.detalhesMaxChars) {
      if (Array.isArray(json)) {
        return {
          truncated: true,
          size: raw.length,
          arrayLength: (json as unknown[]).length,
        } as Prisma.InputJsonValue;
      }

      const keys = json && typeof json === 'object' ? Object.keys(json as Record<string, unknown>).slice(0, 50) : [];
      return {
        truncated: true,
        size: raw.length,
        keys,
      } as Prisma.InputJsonValue;
    }

    return json;
  } catch {
    return { nonSerializable: true } as Prisma.InputJsonValue;
  }
}

export interface AuditOptions {
  acao: AuditAction;

  recurso?: string;
  usuarioId?: number;
  usuarioNome?: string;

  // Detalhes devem ser JSON-serializáveis (aceita objeto/array)
  detalhes?: JsonLike;

  // Se quiser passar manualmente
  ip?: string;
  userAgent?: string;

  // Opcional: headers para extração automática se IP não for passado
  requestHeaders?: Headers;
}

export async function registrarLog({
  acao,
  recurso,
  usuarioId,
  usuarioNome,
  detalhes,
  ip,
  userAgent,
  requestHeaders,
}: AuditOptions) {
  try {
    const h = await safeHeaders(requestHeaders);

    // IP
    let finalIp = 'unknown';
    if (ip) {
      finalIp = normalizeString(ip, LIMITS.ip);
    } else {
      const mockRequest = { headers: h } as unknown as Request;
      finalIp = normalizeString(getClientIp(mockRequest), LIMITS.ip);
    }

    // UA
    const finalUA = normalizeString(userAgent ?? h.get('user-agent') ?? 'unknown', LIMITS.userAgent);

    // Campos textuais
    const recursoSafe = recurso ? normalizeString(recurso, LIMITS.recurso, '') : undefined;
    const usuarioNomeSafe = usuarioNome ? normalizeString(usuarioNome, LIMITS.usuarioNome, '') : undefined;

    // usuarioId: só grava se for um int válido
    const usuarioIdSafe = Number.isInteger(usuarioId) && (usuarioId as number) > 0 ? (usuarioId as number) : undefined;

    const detalhesJson = safeJson(detalhes);

    await prisma.logAuditoria.create({
      data: {
        acao,
        recurso: recursoSafe,
        usuarioId: usuarioIdSafe,
        usuarioNome: usuarioNomeSafe,
        ip: finalIp,
        userAgent: finalUA,
        detalhes: detalhesJson,
      },
    });
  } catch (error) {
    // Nunca quebra o fluxo principal por causa de auditoria
    console.error('❌ FALHA AO GRAVAR AUDITORIA:', error);
  }
}
