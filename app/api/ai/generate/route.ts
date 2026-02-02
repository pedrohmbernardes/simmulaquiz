import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { z } from "zod";
import OpenAI from "openai";
import crypto from "crypto";
import { Redis } from "@upstash/redis";

import { registrarLog, AuditAction } from "@/lib/audit";
import { verifyCSRFToken } from "@/lib/csrf";
import { expensiveOpsRateLimit } from "@/lib/ratelimit";
import { sanitizeString } from "@/lib/sanitize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// IMPORTANTE: No plano Free da Vercel, o limite real é 10s.
// O Frontend deve fazer o loop para evitar timeout em gerações longas.
export const maxDuration = 60; 

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const redis = Redis.fromEnv();

// --- CONFIGURAÇÃO DE LIMITES ---
// Define o limite padrão para 5, conforme sua regra de negócio.
const LIMIT_DIARIO_PADRAO = 5; 

// --- HELPER FUNCTIONS ---

function noStoreJson(data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  return res;
}

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function getUserIdFromSession(session: unknown): number | null {
  const s = session as any;
  const candidate = s?.sub ?? s?.userId ?? s?.usuarioId ?? s?.id;
  const n = Number(candidate);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function getRoleFromSession(session: unknown): "SUPER_ADMIN" | "PROFESSOR" | "ALUNO" | "UNKNOWN" {
  const s = session as any;
  const role = String(s?.role ?? s?.tipo ?? "UNKNOWN").toUpperCase();
  if (role === "SUPER_ADMIN") return "SUPER_ADMIN";
  if (role === "PROFESSOR") return "PROFESSOR";
  if (role === "ALUNO") return "ALUNO";
  return "UNKNOWN";
}

// Helper para ler env var ou usar fallback
function safeEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function getSaoPauloDay(): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function secondsUntilNextSaoPauloMidnight(): number {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);

    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
    const hh = Number(get("hour"));
    const mm = Number(get("minute"));
    const ss = Number(get("second"));

    const nowSec = hh * 3600 + mm * 60 + ss;
    let remaining = 24 * 3600 - nowSec;
    if (!Number.isFinite(remaining) || remaining <= 0) remaining = 5 * 60;
    return remaining;
  } catch {
    return 24 * 3600;
  }
}

// --- SCHEMAS DE ENTRADA E SAÍDA (ZOD) ---

const NivelDificuldadeEnum = z.enum(["MUITO_FACIL", "FACIL", "MEDIO", "DIFICIL", "MUITO_DIFICIL"]);
const NivelCognitivoEnum = z.enum(["LEMBRAR", "ENTENDER", "APLICAR", "ANALISAR", "AVALIAR", "CRIAR"]);

const generateSchema = z.object({
  quantidade: z.coerce.number().int().min(1).max(5).default(1), // Front manda 1 por vez normalmente
  palavrasChave: z.string().max(500).optional().nullable(),
  
  // IDs Relacionais
  cursoTecnicoId: z.coerce.number().int().positive(),
  unidadeCurricularId: z.coerce.number().int().positive(),
  objetoConhecimentoId: z.coerce.number().int().positive(),
  subConhecimentoId: z.preprocess((v) => {
      if (v === "" || v === undefined || v === null || v === 0 || v === "0") return null;
      return v;
  }, z.nullable(z.coerce.number().int().positive())).optional(),
  
  funcaoId: z.coerce.number().int().positive(),
  subfuncaoId: z.coerce.number().int().positive(),
  capacidadeId: z.coerce.number().int().positive(),
  
  // Parâmetros Pedagógicos
  dificuldade: NivelDificuldadeEnum,
  nivelCognitivo: NivelCognitivoEnum,
}).strict();

// Schema de Saída (Validar o que a OpenAI devolve)
const genQuestionSchema = z.object({
  enunciado: z.string().min(10).max(5000), 
  alternativaA: z.string().min(1).max(1200),
  alternativaB: z.string().min(1).max(1200),
  alternativaC: z.string().min(1).max(1200),
  alternativaD: z.string().min(1).max(1200),
  alternativaE: z.string().min(1).max(1200),
  alternativaCorreta: z.enum(["a", "b", "c", "d", "e"]),
  comentario: z.string().optional().nullable(),
});

const genResponseSchema = z.object({
  questoes: z.array(genQuestionSchema),
});

function stripAltPrefix(s: string): string {
  if (!s) return "";
  // Remove prefixos como "A)", "a.", "1 - " do início das alternativas
  return s.replace(/^\s*([A-Ea-e]|[0-9]+)\s*[\)\.\-:]\s*/g, "").trim();
}

// --- ROTA POST ---

export async function POST(req: NextRequest) {
  let quotaReserved = false;
  let quotaKey: string | null = null;

  try {
    if (!process.env.OPENAI_API_KEY) {
      return noStoreJson({ error: "Serviço de IA indisponível (Chave não configurada)." }, { status: 503 });
    }

    // Validação de tamanho do payload
    const cl = Number(req.headers.get("content-length") ?? "0");
    if (Number.isFinite(cl) && cl > 80_000) return noStoreJson({ error: "Payload muito grande." }, { status: 413 });

    // 1) Sessão
    const session = await getSession();
    if (!session) return noStoreJson({ error: "Sessão inválida." }, { status: 401 });
    
    const role = getRoleFromSession(session);
    if (role !== "SUPER_ADMIN" && role !== "PROFESSOR") {
        return noStoreJson({ error: "Acesso negado. Apenas professores e admins podem gerar questões." }, { status: 403 });
    }
    
    const userId = getUserIdFromSession(session);
    if (!userId) return noStoreJson({ error: "ID de usuário inválido." }, { status: 401 });
    
    const ip = getClientIp(req);

    // 2) CSRF e Rate Limit (Burst)
    // Protege contra cliques rápidos/spam
    const csrfHeader = req.headers.get("x-csrf-token");
    if (!(await verifyCSRFToken(csrfHeader))) return noStoreJson({ error: "Token de segurança inválido." }, { status: 403 });

    const burst = await expensiveOpsRateLimit.limit(`ai:generate:${userId}:${ip}`);
    if (!burst.success) return noStoreJson({ error: "Muitas requisições rápidas. Aguarde alguns segundos." }, { status: 429 });

    // 3) Validação Body
    const bodyRaw = await req.json().catch(() => ({}));
    const parsed = generateSchema.safeParse(bodyRaw);
    if (!parsed.success) {
      return noStoreJson({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;

    // 4) Busca Dados Pedagógicos no Banco
    // Necessário para compor o prompt com nomes reais
    const [curso, uc, objeto, subObj, funcao, subfuncao, capacidade] = await Promise.all([
      prisma.cursoTecnico.findUnique({ where: { id: data.cursoTecnicoId } }),
      prisma.unidadeCurricular.findFirst({ where: { id: data.unidadeCurricularId } }),
      prisma.conhecimento.findUnique({ where: { id: data.objetoConhecimentoId } }),
      data.subConhecimentoId ? prisma.subConhecimento.findUnique({ where: { id: Number(data.subConhecimentoId) } }) : null,
      prisma.funcao.findUnique({ where: { id: data.funcaoId } }),
      prisma.subfuncao.findFirst({ where: { id: data.subfuncaoId } }),
      prisma.capacidade.findUnique({ where: { id: data.capacidadeId } }),
    ]);

    if (!curso || !uc || !objeto || !funcao || !subfuncao || !capacidade) {
      return noStoreJson({ error: "Dados pedagógicos não encontrados no banco." }, { status: 400 });
    }

    // 5) VERIFICAÇÃO DE COTA DIÁRIA (ANTES DA IA)
    // Se não houver variável de ambiente, usa LIMIT_DIARIO_PADRAO (5)
    const limitProf = safeEnvInt("AI_GEN_DAILY_LIMIT_PROFESSOR", LIMIT_DIARIO_PADRAO);
    const limitSuper = safeEnvInt("AI_GEN_DAILY_LIMIT_SUPER_ADMIN", LIMIT_DIARIO_PADRAO); // Também 5 se não configurado diferente
    
    const dailyLimit = role === "SUPER_ADMIN" ? limitSuper : limitProf;
    const day = getSaoPauloDay();
    
    quotaKey = `rate_limit:ai_generate:${userId}:${day}`;
    
    // Incrementa atômico
    const current = await redis.incr(quotaKey);
    
    // Se for o primeiro uso do dia, define expiração
    if (current === 1) await redis.expire(quotaKey, secondsUntilNextSaoPauloMidnight());
    
    // Se estourou, retorna erro e NÃO chama a OpenAI
    if (current > dailyLimit) {
      // Não precisamos decrementar aqui, pois o usuário de fato tentou ultrapassar
      const resetInHours = Math.ceil(secondsUntilNextSaoPauloMidnight() / 3600);
      return noStoreJson(
          { error: `Limite diário de geração atingido (${dailyLimit} questões).`, resetIn: resetInHours }, 
          { status: 429 }
      );
    }
    
    // Marca que reservamos uma cota. Se a IA falhar lá embaixo, devolvemos.
    quotaReserved = true;

    // 6) Construção do Prompt
    const palavrasChave = sanitizeString(data.palavrasChave ?? "").slice(0, 500);
    // Modelo padrão robusto
    const modelo = process.env.OPENAI_MODEL_GERAR_QUESTOES || "gpt-4o-mini"; 

    const contextoStr = `
- Curso Técnico: ${curso.nome}
- Unidade Curricular: ${uc.nome}
- Capacidade Técnica: ${capacidade.descricao}
- Objeto de Conhecimento: ${objeto.nome}
${subObj ? `- Detalhamento: ${subObj.nome}` : ''}
`.trim();

    const systemPrompt = `
Você é um Especialista Sênior em elaboração de itens para o SAEP (Sistema de Avaliação da Educação Profissional), com domínio em Automação Industrial. Gere questões de múltipla escolha INÉDITAS, técnicas e compatíveis com a Matriz de Referência fornecida.

Regras críticas (seguir estritamente):
- **Use apenas** os nomes e termos exatos da Matriz de Referência fornecida (unidade curricular, objetos de conhecimento, funções, subfunções, capacidades). Não invente, não altere grafia, não use abreviações ou sinônimos.
- **Formato do item:** cada questão deve conter **Contexto (situação-problema 2–5 linhas)** + **Comando** (direcionador ligado ao contexto; sem negativos como "NÃO", "EXCETO", "INCORRETO") + **5 alternativas** (A, B, C, D, E) com **apenas 1 correta**.
- **Alternativas:** plausíveis; distratores baseados em erros conceituais comuns; similaridade de extensão entre opções; **proibido** "Todas as anteriores", "Nenhuma das anteriores" e termos absolutos ("sempre", "nunca", "apenas").
- **Proibições de conteúdo:** sem marcas comerciais, sem gírias regionais, sem referências a produtos proprietários.
- **Nível cognitivo e dificuldade:** respeite rigorosamente o \`nivelCognitivo\` (LEMBRAR, ENTENDER, APLICAR, ANALISAR, AVALIAR, CRIAR) e \`dificuldade\` (MUITO_FACIL, FACIL, MEDIO, DIFICIL, MUITO_DIFICIL). Verbo do comando deve corresponder ao nível.
- **Lógica de avaliação:** cada questão deve mapear exatamente uma combinação válida do mapa (funcao, subfuncao, capacidade, objetoConhecimento) fornecido no contexto.
- **Saída obrigatória:** retorne **APENAS** um JSON válido com a estrutura abaixo (sem texto adicional):
{
"enunciado": "...",
"alternativaA": "...",
"alternativaB": "...",
"alternativaC": "...",
"alternativaD": "...",
"alternativaE": "...",
"alternativaCorreta": "a|b|c|d|e",
"comentario": "Explicação breve da resposta correta (1-2 frases)."
},
- **Qualidade das questões:** enunciados contextualizados (chão de fábrica, manutenção, projeto), dados suficientes no contexto para resolver; comandos dependentes do contexto; alternativas com tamanho similar; comentário explicativo curto e técnico.
- **Originalidade:** não reproduza questões existentes; gere conteúdo inédito.
- **Idioma e tom:** português claro, técnico e objetivo.
- **Validações:** cada campo de texto deve ter conteúdo coerente e legível; evite ambiguidade que permita mais de uma alternativa correta.

Siga estas regras estritas ao pé da letra.
${contextoStr}
`.trim();

    const userPrompt = `
Gere exatamente ${data.quantidade} questão(ões) seguindo as regras do sistema acima.
Contexto pedagógico (preenchido pelo sistema):
- Curso Técnico: ${curso.nome}
- Unidade Curricular: ${uc.nome}
- Capacidade Técnica: ${capacidade.descricao}
- Objeto de Conhecimento: ${objeto.nome}
${subObj ? `- Detalhamento: ${subObj.nome}` : ''}

Se houver palavras-chave: "${palavrasChave}"

Retorne **APENAS** o JSON especificado no systemPrompt, sem texto adicional.
`.trim();

    // 7) Chamada OpenAI
    const jsonSchema = {
      name: "questoes_saep",
      strict: true,
      schema: {
        type: "object",
        properties: {
          questoes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                enunciado: { type: "string" },
                alternativaA: { type: "string" },
                alternativaB: { type: "string" },
                alternativaC: { type: "string" },
                alternativaD: { type: "string" },
                alternativaE: { type: "string" },
                alternativaCorreta: { type: "string", enum: ["a", "b", "c", "d", "e"] },
                comentario: { type: "string" }
              },
              required: ["enunciado", "alternativaA", "alternativaB", "alternativaC", "alternativaD", "alternativaE", "alternativaCorreta", "comentario"],
              additionalProperties: false
            }
          }
        },
        required: ["questoes"],
        additionalProperties: false
      }
    };

    const started = Date.now();

    // Configuração para modelos
    const completion = await openai.chat.completions.create({
      model: modelo,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: jsonSchema
      },
      // Temperatura recomendada para enunciados técnicos e provas oficiais:
      temperature: 0.2, // determinístico; use 0.5 para gerar variações controladas
      // reasoning_effort pode ser mantido como opcional se seu ambiente suportar:
      // ...({ reasoning_effort: "medium" } as any),
      max_completion_tokens: 4500,
    });



    
    // ------ Modelo para o gpt-5-mini
    // // Configuração para modelos
    // const completion = await openai.chat.completions.create({
    //   model: modelo,
    //   messages: [
    //     { role: "system", content: systemPrompt },
    //     { role: "user", content: userPrompt },
    //   ],
    //   response_format: {
    //     type: "json_schema",
    //     json_schema: jsonSchema
    //   },
    //   // Removemos temperature pois alguns modelos novos (o1, gpt-5-preview) não suportam ou preferem reasoning_effort
    //   // Se estiver usando gpt-4o, pode adicionar temperature: 0.7 se quiser variar.
    //   // Mantendo configuração compatível com o1/gpt-5-mini conforme seu pedido anterior:
    //   ...({ reasoning_effort: "medium" } as any), 
      
    //   max_completion_tokens: 4500, 
    // });
    
    const tempoGeracaoMs = Date.now() - started;
    const content = completion.choices?.[0]?.message?.content ?? "";

    if (!content) throw new Error("A IA retornou uma resposta vazia.");

    // 8) Parse e Validação da Resposta
    let json: any;
    try {
      json = JSON.parse(content);
    } catch {
      throw new Error("A IA gerou um JSON inválido.");
    }

    const validated = genResponseSchema.safeParse(json);
    if (!validated.success) throw new Error("A estrutura do JSON gerado pela IA está incorreta.");

    // Sanitização final
    const questoesGeradas = validated.data.questoes.map((q) => ({
      enunciado: sanitizeString(q.enunciado),
      alternativaA: sanitizeString(stripAltPrefix(q.alternativaA)),
      alternativaB: sanitizeString(stripAltPrefix(q.alternativaB)),
      alternativaC: sanitizeString(stripAltPrefix(q.alternativaC)),
      alternativaD: sanitizeString(stripAltPrefix(q.alternativaD)),
      alternativaE: sanitizeString(stripAltPrefix(q.alternativaE)),
      alternativaCorreta: q.alternativaCorreta,
      comentario: q.comentario ? sanitizeString(q.comentario) : null,
    }));

    // Sucesso! Remove a flag de reembolso pois o serviço foi entregue.
    quotaReserved = false;

    // Logs de Auditoria
    await registrarLog({
      acao: AuditAction.IA_GERAR_QUESTOES,
      usuarioId: userId,
      usuarioNome: (session as any).name ?? null,
      recurso: "/api/ai/generate",
      ip,
      detalhes: {
        qtd: questoesGeradas.length,
        modelo,
        tempoMs: tempoGeracaoMs,
        tokens: completion.usage?.total_tokens ?? 0,
        curso: curso.nome
      },
    }).catch(() => {});

    return noStoreJson({
        data: questoesGeradas,
        usage: { current, limit: dailyLimit, remaining: Math.max(0, dailyLimit - current) },
      }, { status: 200 }
    );

  } catch (error: any) {
    // 🔄 REEMBOLSO: Se reservou cota mas deu erro antes de entregar, devolve.
    if (quotaReserved && quotaKey) {
        try { 
            await redis.decr(quotaKey); 
            console.log(`[AI] Cota reembolsada para usuário devido a erro.`);
        } catch (e) {
            console.error("Erro em ai/generate:", e instanceof Error ? e.message : String(e));
        }
    }

    console.error("Erro AI Generate:", error);
    
    // Tratamento de erro amigável
    const msg = error?.error?.message || error.message || "Erro interno na geração.";
    return noStoreJson({ error: "Falha na geração.", details: msg }, { status: 500 });
  }
}