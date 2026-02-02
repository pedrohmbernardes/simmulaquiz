import { prisma } from '@/lib/prisma';

// Cache simples em memória para evitar hits excessivos no banco (opcional, mas recomendado)
// Zera a cada restart da aplicação (deploy)
let cacheTitulos: any[] = [];

async function getTitulosOrdenados() {
  if (cacheTitulos.length > 0) return cacheTitulos;
  
  const titulos = await prisma.titulo.findMany({
    orderBy: { minPontos: 'asc' }
  });
  
  cacheTitulos = titulos;
  return titulos;
}

/**
 * Calcula os dados de nível e progresso consultando o banco de dados.
 */
export async function calcularProgressoNivel(xp: number) {
  const titulos = await getTitulosOrdenados();

  // 1. Encontrar o título atual (o maior minPontos que é <= XP do usuário)
  // Vamos varrer de trás pra frente (do maior nível para o menor)
  let indiceAtual = -1;
  for (let i = titulos.length - 1; i >= 0; i--) {
    if (xp >= titulos[i].minPontos) {
      indiceAtual = i;
      break;
    }
  }

  // Fallback se não encontrar (nível 1)
  if (indiceAtual === -1) indiceAtual = 0;

  const tituloAtual = titulos[indiceAtual];
  const tituloProximo = titulos[indiceAtual + 1]; // Pode ser undefined se for nível máximo

  // Se for nível máximo (300)
  if (!tituloProximo) {
    return {
      nivelAtual: tituloAtual.nivel,
      nomeTitulo: tituloAtual.nome,
      proximoTitulo: 'NÍVEL MÁXIMO',
      percentual: 100,
      pontosRestantes: 0,
      xpAtual: xp,
      xpProximo: xp
    };
  }

  // Cálculos para o próximo nível
  const xpBaseNivel = tituloAtual.minPontos;
  const xpNecessarioProximo = tituloProximo.minPontos;
  
  const range = xpNecessarioProximo - xpBaseNivel;
  const conquistadoNoNivel = xp - xpBaseNivel;
  
  // Evita divisão por zero
  const percentual = range > 0 
    ? Math.min(100, Math.floor((conquistadoNoNivel / range) * 100))
    : 100;

  return {
    nivelAtual: tituloAtual.nivel,
    nomeTitulo: tituloAtual.nome,
    proximoTitulo: tituloProximo.nome,
    percentual,
    pontosRestantes: xpNecessarioProximo - xp,
    xpAtual: xp,
    xpProximo: xpNecessarioProximo
  };
}