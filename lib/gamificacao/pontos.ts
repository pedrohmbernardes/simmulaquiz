import { prisma } from '@/lib/prisma';

/**
 * Adiciona pontos de forma atômica (Thread-Safe).
 */
export async function adicionarPontos(userId: number, pontosGanhos: number) {
  try {
    const perfil = await prisma.usuarioGamificacao.update({
      where: { usuarioId: userId },
      data: {
        pontos: { increment: pontosGanhos }
      },
      select: { pontos: true }
    });

    await verificarEAtualizarTitulo(userId, perfil.pontos);
    
    return { totalPontos: perfil.pontos };
  } catch (error) {
    console.error('Erro ao adicionar pontos:', error);
    throw error;
  }
}

/**
 * Subtrai pontos de forma ATÔMICA e SEGURA (V2.1).
 * Evita race conditions de leitura/escrita e garante que nunca fique negativo.
 */
export async function subtrairPontos(userId: number, pontosPerdidos: number) {
  try {
    // Tenta decrementar APENAS se o saldo for suficiente
    const updateSeguro = await prisma.usuarioGamificacao.updateMany({
      where: { 
        usuarioId: userId,
        pontos: { gte: pontosPerdidos } // Só subtrai se tiver pontos >= perda
      },
      data: {
        pontos: { decrement: pontosPerdidos }
      }
    });

    // Se count for 0, significa que o usuário tinha menos pontos do que a perda.
    // Nesse caso, zeramos o saldo (Floor em 0).
    if (updateSeguro.count === 0) {
      await prisma.usuarioGamificacao.update({
        where: { usuarioId: userId },
        data: { pontos: 0 } // Zera o saldo
      });
      return 0;
    }

    // Retorna saldo atualizado (opcional, requer nova leitura se precisar do valor exato)
    return true;

  } catch (error) {
    console.error('Erro ao subtrair pontos:', error);
    throw error;
  }
}

/**
 * Lógica interna para mapear a pontuação atual ao ID do título correspondente.
 */
async function verificarEAtualizarTitulo(userId: number, pontosAtuais: number) {
  const tituloCerto = await prisma.titulo.findFirst({
    where: { minPontos: { lte: pontosAtuais } },
    orderBy: { nivel: 'desc' }
  });

  if (!tituloCerto) return null;

  // Atualiza apenas se o nível mudou (evita writes desnecessários)
  const perfilAtual = await prisma.usuarioGamificacao.findUnique({
    where: { usuarioId: userId },
    select: { nivel: true }
  });

  if (perfilAtual && tituloCerto.nivel > perfilAtual.nivel) {
    await prisma.usuarioGamificacao.update({
      where: { usuarioId: userId },
      data: { 
        tituloId: tituloCerto.id,
        nivel: tituloCerto.nivel
      }
    });
    return tituloCerto.nome;
  }
  return null;
}