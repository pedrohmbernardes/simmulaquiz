import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { safeApiError } from '@/lib/server-utils';
import { getSession } from '@/lib/auth';
import { Redis } from '@upstash/redis';
import { apiRateLimit } from '@/lib/ratelimit'; // ✅ Proteção contra DoS
import { registrarLog, AuditAction } from '@/lib/audit'; // ✅ Auditoria
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

const CACHE_TTL = 60 * 60; // 1 hora
const CACHE_KEY = 'admin:options:data_v3_pivot_fix';

// Helper de ordenação natural
const naturalSort = (a: any, b: any, key: string) => {
  if (!a[key] || !b[key]) return 0;
  return a[key].toString().localeCompare(b[key].toString(), undefined, { numeric: true, sensitivity: 'base' });
};

// Helper de IP
async function getClientIpAsync() {
    const h = await headers();
    const xff = h.get('x-forwarded-for');
    if (xff) return xff.split(',')[0]?.trim() || '127.0.0.1';
    return h.get('x-real-ip') ?? h.get('cf-connecting-ip') ?? '127.0.0.1';
}

export async function GET() {
  try {
    const ip = await getClientIpAsync();

    // 🛡️ 1. SEGURANÇA: Autenticação & Autorização
    const session = await getSession();
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'PROFESSOR')) {
      await registrarLog({
        acao: AuditAction.SEGURANCA_ACESSO_NEGADO,
        detalhes: { rota: '/api/admin/options', ip, erro: 'Role inválida ou sem sessão' }
      });
      return NextResponse.json({ error: 'Acesso Negado' }, { status: 401 });
    }

    // 🛡️ 2. SEGURANÇA: Rate Limit (Proteção de Infraestrutura)
    // Impede que queries pesadas sejam spawnadas excessivamente
    if (apiRateLimit) {
      const { success } = await apiRateLimit.limit(`admin_opts:${session.sub}`);
      if (!success) {
        await registrarLog({
            acao: AuditAction.SEGURANCA_RATE_LIMIT,
            usuarioId: Number(session.sub),
            detalhes: { rota: '/api/admin/options', ip }
        });
        return NextResponse.json({ error: 'Muitas requisições. Aguarde.' }, { status: 429 });
      }
    }

    // 3. CACHE (Redis - Cache-Aside)
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      try {
        const redis = Redis.fromEnv();
        const cachedData = await redis.get(CACHE_KEY);
        if (cachedData) {
          // Retorna com header indicando cache HIT
          return NextResponse.json(cachedData, { 
            headers: { 
                'X-Cache': 'HIT',
                'Cache-Control': 'no-store' // Browser não deve cachear, apenas o server
            } 
          });
        }
      } catch (redisError) {
        console.warn("⚠️ Falha no Redis, ignorando cache.", redisError);
      }
    }

    // 4. BUSCA NO DB (Queries Otimizadas)
    // Nota: Mantido findMany sem select estrito para compatibilidade, 
    // mas em refatoração futura, liste apenas os campos necessários (id, nome, codigo).
    const [
      cursos, 
      ucs, 
      funcoes, 
      subfuncoesRaw, 
      capacidadesRaw, 
      conhecimentosRaw, 
      subConhecimentosRaw, 
      instituicoes,
      bancas,
      // Tabelas Pivô (Busca apenas IDs para performance)
      cursoFuncoes, 
      subfuncaoCapacidades,
      ucConhecimentos,
      capacidadeConhecimentos
    ] = await Promise.all([
      // Entidades Principais
      prisma.cursoTecnico.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } }),
      prisma.unidadeCurricular.findMany({ orderBy: { codigo: 'asc' } }), // Ativo check removido propositalmente
      prisma.funcao.findMany({ where: { ativo: true }, orderBy: { codigo: 'asc' } }),
      prisma.subfuncao.findMany({ where: { ativo: true } }), 
      prisma.capacidade.findMany({ where: { ativo: true } }),
      prisma.conhecimento.findMany({ where: { ativo: true } }), 
      prisma.subConhecimento.findMany({ where: { ativo: true } }),
      prisma.instituicao.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } }),
      prisma.banca.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } }),

      // Relacionamentos (Leve: apenas IDs)
      prisma.cursoFuncao.findMany({ select: { cursoTecnicoId: true, funcaoId: true } }),
      prisma.subfuncaoCapacidade.findMany({ select: { subfuncaoId: true, capacidadeId: true } }),
      prisma.unidadeCurricularConhecimento.findMany({ select: { unidadeCurricularId: true, conhecimentoId: true } }),
      prisma.capacidadeConhecimento.findMany({ select: { capacidadeId: true, conhecimentoId: true } })
    ]);

    // 5. PROCESSAMENTO E NORMALIZAÇÃO (Mapeamento Manual para Frontend)
    
    // Funções -> quais cursos?
    const funcoesFormatadas = funcoes.map((f: any) => ({
        ...f,
        cursosIds: cursoFuncoes
            .filter((cf: any) => cf.funcaoId === f.id)
            .map((cf: any) => cf.cursoTecnicoId)
    }));

    // Capacidades -> quais subfunções?
    const capacidadesFormatadas = capacidadesRaw.map((c: any) => ({
        ...c,
        subfuncoesIds: subfuncaoCapacidades
            .filter((sfc: any) => sfc.capacidadeId === c.id)
            .map((sfc: any) => sfc.subfuncaoId)
    })).sort((a, b) => naturalSort(a, b, 'sigla'));

    // Objetos (Conhecimentos) -> quais UCs?
    const objetosFormatados = conhecimentosRaw.map((o: any) => ({
        ...o,
        ucsIds: ucConhecimentos
            .filter((ucc: any) => ucc.conhecimentoId === o.id)
            .map((ucc: any) => ucc.unidadeCurricularId)
    })).sort((a, b) => naturalSort(a, b, 'codigo'));

    // Ordenações simples
    const subfuncoes = subfuncoesRaw.sort((a, b) => naturalSort(a, b, 'codigo'));
    const subconhecimentos = subConhecimentosRaw.sort((a, b) => naturalSort(a, b, 'codigo'));

    // Payload Final
    const payload = {
      cursos,
      ucs,
      funcoes: funcoesFormatadas,
      subfuncoes,
      capacidades: capacidadesFormatadas,
      objetos: objetosFormatados,
      subconhecimentos,
      instituicoes,
      bancas
    };

    // 6. SALVAR NO CACHE
    if (process.env.UPSTASH_REDIS_REST_URL) {
      try {
        const redis = Redis.fromEnv();
        await redis.set(CACHE_KEY, JSON.stringify(payload), { ex: CACHE_TTL });
      } catch (e) { 
          console.error("Erro ao salvar cache options:", e instanceof Error ? e.message : String(e)); 
      }
    }

    return NextResponse.json(payload, { 
        headers: { 
            'X-Cache': 'MISS',
            'Cache-Control': 'no-store' 
        } 
    });

  } catch (error) {
    return safeApiError(error, 'Erro ao carregar opções do sistema.');
  }
}