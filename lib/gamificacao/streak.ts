import { prisma } from '@/lib/prisma';
import { concederConquista } from './engine';
import { MAPA_CRITERIOS } from './badges';

/**
 * Processa a ofensiva (streak) diária do usuário.
 * Integrado com o sistema de conquistas v2.0.
 */
export async function processarStreak(userId: number) {
  try {
    // Usamos transaction para garantir consistência entre atualização de streak e entrega de conquista
    await prisma.$transaction(async (tx) => {
      const perfil = await tx.usuarioGamificacao.findUnique({
        where: { usuarioId: userId },
      });

      if (!perfil) return;

      const agora = new Date();
      // Normaliza a data para 00:00:00 para comparar apenas o dia
      const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
      
      if (!perfil.ultimoLoginStreak) {
        // Primeiro acesso contando streak
        await atualizarDadosStreak(tx, userId, 1, 1, hoje);
        await checarConquistasStreak(tx, userId, 1);
        return;
      }

      const ultimoLogin = new Date(perfil.ultimoLoginStreak);
      const dataUltimo = new Date(ultimoLogin.getFullYear(), ultimoLogin.getMonth(), ultimoLogin.getDate());

      const diffTempo = hoje.getTime() - dataUltimo.getTime();
      const diffDias = Math.floor(diffTempo / (1000 * 60 * 60 * 24));

      if (diffDias === 0) {
        // Já realizou atividade hoje
        return;
      } 
      
      let novoStreak = 1;
      const maiorStreakAnterior = perfil.maiorStreak || 0;

      if (diffDias === 1) {
        // Sequência mantida: realizou atividade ontem e hoje
        novoStreak = (perfil.streakAtual || 0) + 1;
      } else {
        // Quebrou o streak: mais de 24h sem atividade
        novoStreak = 1;
      }

      const novoMaior = Math.max(novoStreak, maiorStreakAnterior);
      
      await atualizarDadosStreak(tx, userId, novoStreak, novoMaior, hoje);
      
      // Dispara a verificação de conquistas baseada no novo valor
      await checarConquistasStreak(tx, userId, novoStreak);
    });

  } catch (error) {
    console.error(`❌ Erro ao processar streak do usuário ${userId}:`, error);
  }
}

/**
 * Atualiza os valores de ofensiva no banco de dados
 */
async function atualizarDadosStreak(tx: any, userId: number, atual: number, maior: number, data: Date) {
  await tx.usuarioGamificacao.update({
    where: { usuarioId: userId },
    data: {
      streakAtual: atual,
      maiorStreak: maior,
      ultimoLoginStreak: data
    }
  });
}

/**
 * Gatilhos dinâmicos para as conquistas de dias seguidos.
 * Agora utiliza o MAPA_CRITERIOS para ser escalável.
 */
async function checarConquistasStreak(tx: any, userId: number, streak: number) {
  // Criamos um contexto fake de stats apenas com o streak para o validador
  const statsFake = { streakAtual: streak };

  // Buscamos todas as conquistas de engajamento que o usuário ainda não tem
  // Nota: Usamos 'conquista' no findMany, mas o correto no prisma é tx.conquista
  const conquistasPendentes = await tx.conquista.findMany({
    where: {
      categoria: 'INICIO_ENGAJAMENTO',
      usuarios: { none: { usuarioId: userId } } // Usuário ainda não tem a conquista
    },
    select: { key: true } // Trazemos a key para buscar no MAPA_CRITERIOS
  });

  for (const c of conquistasPendentes) {
    // Busca a função validadora no mapa (ex: 'STREAK_3_DIAS')
    const validador = MAPA_CRITERIOS[c.key];
    
    // Se a conquista tem uma regra definida no código e o critério foi atingido
    if (validador && validador(statsFake)) {
      // ✅ CORREÇÃO: Passamos 'tx' como terceiro argumento obrigatório
      await concederConquista(userId, c.key, tx);
    }
  }
}