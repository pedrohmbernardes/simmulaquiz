import { prisma } from '@/lib/prisma';

/**
 * Cores e estilos mapeados por raridade baseados no design system.
 */
const MAPA_RARIDADE: Record<string, { cor: string; bg: string; border: string }> = {
  COMUM: { cor: '#94a3b8', bg: 'bg-slate-100', border: 'border-slate-200' },
  INCOMUM: { cor: '#22c55e', bg: 'bg-green-100', border: 'border-green-200' },
  RARO: { cor: '#3b82f6', bg: 'bg-blue-100', border: 'border-blue-200' },
  EPICO: { cor: '#a855f7', bg: 'bg-purple-100', border: 'border-purple-200' },
  LENDARIO: { cor: '#eab308', bg: 'bg-yellow-100', border: 'border-yellow-200' },
  MITICO: { cor: '#ec4899', bg: 'bg-pink-100', border: 'border-pink-200' },
};

/**
 * Mapa de critérios para validação de conquistas via código (ex: Streak).
 * Chave = Key da Conquista no Banco
 * Valor = Função que recebe stats e retorna boolean
 */
export const MAPA_CRITERIOS: Record<string, (stats: any) => boolean> = {
  // Exemplo: Conquistas de Streak Diário
  'STREAK_3_DIAS': (stats) => (stats.streakAtual || 0) >= 3,
  'STREAK_7_DIAS': (stats) => (stats.streakAtual || 0) >= 7,
  'STREAK_30_DIAS': (stats) => (stats.streakAtual || 0) >= 30,
  
  // Você pode adicionar outras chaves aqui conforme criar no banco
};

/**
 * Busca todas as medalhas conquistadas por um usuário e as formata para o frontend.
 */
export async function buscarBadgesUsuario(userId: number) {
  try {
    const conquistasUsuario = await prisma.usuarioConquista.findMany({
      where: { usuarioId: userId },
      include: {
        conquista: true
      },
      orderBy: { dataConquista: 'desc' }
    });

    return conquistasUsuario.map(uc => {
      const c = uc.conquista;
      const visual = MAPA_RARIDADE[c.raridade] || MAPA_RARIDADE.COMUM;

      return {
        key: c.key,
        nome: c.nome,
        descricao: c.descricao,
        categoria: c.categoria,
        raridade: c.raridade,
        data: uc.dataConquista,
        estilo: visual,
        multiplicador: c.bonusMultiplier,
        // Cálculo de pontos para exibição no perfil
        pontosGanhos: Math.floor(c.pontos * (c.impossivel ? 5.0 : c.oculta ? 1.5 : 1.0))
      };
    });
  } catch (error) {
    console.error('Erro ao buscar badges:', error);
    return [];
  }
}

/**
 * Retorna as estatísticas rápidas de conquistas (Ex: "15/329 conquistadas").
 */
export async function obterResumoConquistas(userId: number) {
  try {
    const totalConquistas = await prisma.conquista.count({ where: { ativo: true } });
    const conquistasObtidas = await prisma.usuarioConquista.count({ where: { usuarioId: userId } });

    return {
      obtidas: conquistasObtidas,
      total: totalConquistas,
      percentual: totalConquistas > 0 ? Math.floor((conquistasObtidas / totalConquistas) * 100) : 0
    };
  } catch (error) {
    console.error('Erro ao obter resumo de conquistas:', error);
    return { obtidas: 0, total: 0, percentual: 0 };
  }
}