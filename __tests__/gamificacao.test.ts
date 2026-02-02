// __tests__/gamificacao.test.ts

import { concederConquista } from '@/lib/gamificacao/engine';
import { adicionarPontos } from '@/lib/gamificacao/pontos';
import { PrismaClient } from '@prisma/client';

// 1. MOCK DO PRISMA
// Precisamos simular o comportamento do banco de dados para não depender de uma conexão real nos testes unitários.
jest.mock('@/lib/prisma', () => {
  const mockTx = {
    conquista: { findUnique: jest.fn() },
    usuarioConquista: { findUnique: jest.fn(), create: jest.fn() },
    usuarioGamificacao: { update: jest.fn(), findUnique: jest.fn() },
    titulo: { findFirst: jest.fn() },
    historicoPontos: { findFirst: jest.fn(), create: jest.fn() },
  };

  return {
    prisma: {
      ...mockTx,
      // Simulamos o $transaction para simplesmente executar o callback passando o nosso mockTx
      $transaction: jest.fn((callback) => callback(mockTx))
    }
  };
});

// Importamos o prisma mockado para poder definir os retornos (mockResolvedValue)
import { prisma } from '@/lib/prisma';

// Helper para dizer ao TypeScript que 'prisma' é um Mock do Jest
const prismaMock = prisma as unknown as {
  conquista: { findUnique: jest.Mock };
  usuarioConquista: { findUnique: jest.Mock; create: jest.Mock };
  usuarioGamificacao: { update: jest.Mock; findUnique: jest.Mock };
  titulo: { findFirst: jest.Mock };
  $transaction: jest.Mock;
};

describe('🛡️ Segurança da Gamificação', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('✅ Deve conceder medalha e pontos se o usuário NÃO tiver a conquista', async () => {
    // --- PREPARAÇÃO DO CENÁRIO (MOCKS) ---
    
    // 1. O banco encontra a conquista "first_win" configurada
    prismaMock.conquista.findUnique.mockResolvedValue({ 
      id: 1, key: 'first_win', pontos: 100, bonusMultiplier: 1.0, ativo: true 
    });
    
    // 2. O banco diz que o usuário AINDA NÃO tem essa conquista
    prismaMock.usuarioConquista.findUnique.mockResolvedValue(null);
    
    // 3. Mock do update de pontos (apenas para não quebrar o fluxo)
    prismaMock.usuarioGamificacao.update.mockResolvedValue({ 
      pontos: 100, nivel: 1 
    });

    // --- EXECUÇÃO ---
    // Passamos o próprio prismaMock como se fosse a transação (tx), pois configuramos o mock assim
    // O type assertion 'as any' é necessário aqui apenas porque o Mock do Jest não tem todas as propriedades complexas do Prisma Client real, mas tem as que usamos.
    await concederConquista(99, 'first_win', prismaMock as any);

    // --- VERIFICAÇÃO (ASSERT) ---
    
    // Deve ter criado o registro na tabela usuarioConquista
    expect(prismaMock.usuarioConquista.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.usuarioConquista.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ usuarioId: 99, conquistaId: 1 })
    }));
    
    // Deve ter dado os pontos ao usuário
    expect(prismaMock.usuarioGamificacao.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { usuarioId: 99 },
      data: expect.objectContaining({ pontos: { increment: 100 } })
    }));
  });

  test('🛡️ NÃO deve duplicar pontos se a medalha já existir (Idempotência)', async () => {
    // --- PREPARAÇÃO ---
    
    // 1. A conquista existe
    prismaMock.conquista.findUnique.mockResolvedValue({ 
      id: 1, key: 'first_win', pontos: 100, ativo: true 
    });

    // 2. Simulamos que o banco JÁ TEM o registro (usuarioConquista.findUnique retorna algo)
    prismaMock.usuarioConquista.findUnique.mockResolvedValue({ id: 500, usuarioId: 99, conquistaId: 1 });

    // --- EXECUÇÃO ---
    const resultado = await concederConquista(99, 'first_win', prismaMock as any);

    // --- VERIFICAÇÃO ---
    
    // A função deve retornar null imediatamente
    expect(resultado).toBeNull();
    
    // NÃO deve tentar criar registro duplicado
    expect(prismaMock.usuarioConquista.create).not.toHaveBeenCalled();
    
    // NÃO deve dar pontos novamente
    expect(prismaMock.usuarioGamificacao.update).not.toHaveBeenCalled(); 
  });

  test('🏆 Deve processar upgrade de título ao atingir pontuação (via adicionarPontos)', async () => {
    // --- PREPARAÇÃO ---
    
    // 1. O update de pontos retorna que o usuário agora tem 500 pontos
    prismaMock.usuarioGamificacao.update.mockResolvedValue({ 
      pontos: 500, nivel: 1 
    });

    // 2. O banco encontra um título para quem tem <= 500 pontos
    prismaMock.titulo.findFirst.mockResolvedValue({ 
      id: 10, nivel: 4, nome: 'Técnico Júnior', minPontos: 400 
    });

    // 3. O usuário atual está no nível 1
    prismaMock.usuarioGamificacao.findUnique.mockResolvedValue({ 
      nivel: 1 
    });

    // --- EXECUÇÃO ---
    // Aqui testamos a função 'adicionarPontos' que chama a lógica de level up internamente
    await adicionarPontos(99, 500);

    // --- VERIFICAÇÃO ---
    
    // Deve ter chamado update para mudar o nível para 4
    expect(prismaMock.usuarioGamificacao.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ nivel: 4 }) 
    }));
  });

});