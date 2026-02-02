// __tests__/simulado-flow.test.ts

/**
 * @jest-environment node
 */

// ✅ Mockar o dompurify ANTES das importações das rotas
jest.mock('isomorphic-dompurify', () => ({
  sanitize: (str: string) => str,
  default: {
    sanitize: (str: string) => str,
  },
}));

import { POST as createSimulado } from '@/app/api/simulados/route';
import { POST as finishSimulado } from '@/app/api/simulados/[id]/finalizar/route';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { NextRequest } from 'next/server';

jest.mock('next/headers', () => ({
  headers: jest.fn().mockResolvedValue({
    get: jest.fn((key) => (key === 'x-forwarded-for' ? '127.0.0.1' : null)),
  }),

  // ✅ Adicione cookies, porque sua rota chama cookies().getAll()
  cookies: jest.fn().mockResolvedValue({
    get: jest.fn(),
    getAll: jest.fn().mockReturnValue([
      { name: 'csrf-token', value: 'mocked-csrf-token-1234567890' },
      { name: 'session', value: 'mocked-session-1234567890' },
    ]),
    set: jest.fn(),
    delete: jest.fn(),
  }),
}));


jest.mock('@/lib/mail', () => ({
  enviarEmailSimuladoConcluido: jest.fn().mockResolvedValue(true),
  enviarAlertaSegurancaLogin: jest.fn()
}));

jest.mock('@/lib/csrf', () => ({
  verifyCSRFToken: jest.fn().mockResolvedValue(true)
}));

// ✅ MOCK DO PRISMA
jest.mock('@/lib/prisma', () => {
  const createMockModel = () => ({
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
    upsert: jest.fn(),
    aggregate: jest.fn().mockResolvedValue({ _sum: { qtdeQuestoes: 0 } }),
  });

  const mockTx = {
    usuario: createMockModel(),
    cursoTecnico: createMockModel(),
    unidadeCurricular: createMockModel(),
    questao: createMockModel(),
    simulado: createMockModel(),
    simuladosQuestao: createMockModel(),
    questaoTentativa: createMockModel(),
    questaoErro: createMockModel(),
    logAuditoria: createMockModel(),
    conhecimentoObjeto: createMockModel(),
    funcao: createMockModel(),
    subfuncao: createMockModel(),
    capacidade: createMockModel(),
    usuarioGamificacao: createMockModel(),
    historicoPontos: createMockModel(),
    $queryRaw: jest.fn().mockResolvedValue([]), 
  };

  return { 
    prisma: {
      ...mockTx,
      $transaction: jest.fn((callback) => callback(mockTx))
    }
  };
});

jest.mock('@/lib/auth', () => ({ 
  getSession: jest.fn() 
}));

jest.mock('@/lib/audit', () => ({ 
  registrarLog: jest.fn(), 
  AuditAction: { 
    SIMULADO_INICIAR: 'SIMULADO_INICIAR', 
    SIMULADO_FINALIZAR: 'SIMULADO_FINALIZAR', 
    SISTEMA_ERRO: 'SISTEMA_ERRO' 
  } 
}));

jest.mock('@/lib/gamificacao/engine', () => ({ 
  processarGamificacaoSimulado: jest.fn().mockResolvedValue({ 
    success: true, 
    data: { xpGanhoTotal: 100, novoNivel: 2, conquistas: [] } 
  }) 
}));

// 🔴 CORREÇÃO: Adicionado mock para expensiveOpsRateLimit
jest.mock('@/lib/ratelimit', () => ({ 
  authRateLimit: { 
    limit: jest.fn().mockResolvedValue({ success: true, limit: 10, remaining: 9, reset: 0 }) 
  },
  expensiveOpsRateLimit: { 
    limit: jest.fn().mockResolvedValue({ success: true, limit: 5, remaining: 4, reset: 0 }) 
  }
}));

const createReq = (body: any, url: string = 'http://localhost:3000/api/simulados') => {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }) as unknown as NextRequest;
};

describe('🚀 Fluxo de Simulado (Integração)', () => {
  const userId = 100;

  beforeEach(() => {
    jest.clearAllMocks();
    (getSession as jest.Mock).mockResolvedValue({ sub: userId.toString(), name: 'Aluno Teste', role: 'ALUNO' });
    
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ id: userId, ativo: true, tipo: 'ALUNO' });
    (prisma.cursoTecnico.findUnique as jest.Mock).mockResolvedValue({ id: 1, nome: 'Curso Teste' });
    (prisma.unidadeCurricular.count as jest.Mock).mockResolvedValue(2);
    (prisma.simulado.count as jest.Mock).mockResolvedValue(0);
  });

  describe('Criação (POST /api/simulados)', () => {
    test('✅ Deve criar simulado com sucesso quando payload é válido', async () => {
      (prisma.questao.findMany as jest.Mock).mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]);
      (prisma.simulado.create as jest.Mock).mockResolvedValue({ id: 50 });

      const payload = { 
        tipo: 'CUSTOM', 
        config: { cursoId: 1, ucsSelecionadas: [10, 11], qtdeQuestoes: 5 } 
      };
      
      const res = await createSimulado(createReq(payload));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.simuladoId).toBe(50);
    });
  });

  describe('Finalização (POST /api/simulados/[id]/finalizar)', () => {
    const simuladoId = 50;
    const params = Promise.resolve({ id: simuladoId.toString() });

    test('✅ Deve calcular nota corretamente e finalizar', async () => {
      (prisma.simulado.findFirst as jest.Mock).mockResolvedValue({
        id: simuladoId,
        usuarioId: userId,
        status: 'EM_ANDAMENTO',
        qtdeQuestoes: 2,
        usuario: { email: 'teste@teste.com', nome: 'Teste' },
        simuladosQuestoes: [{ questaoId: 10 }, { questaoId: 11 }]
      });

      (prisma.simuladosQuestao.findMany as jest.Mock).mockResolvedValue([
         { questaoId: 10, alternativaMarcada: 'a' },
         { questaoId: 11, alternativaMarcada: 'c' }
      ]);
      
      (prisma.questao.findMany as jest.Mock).mockResolvedValue([
         { id: 10, alternativaCorreta: 'a' },
         { id: 11, alternativaCorreta: 'b' }
      ]);

      const req = createReq({ respostas: { 10: 'a', 11: 'c' } }, `http://localhost/api/simulados/${simuladoId}/finalizar`);
      const res = await finishSimulado(req, { params });
      
      const json = await res.json();

      if (res.status !== 200) {
        console.error("Erro na Finalização:", json);
      }

      expect(res.status).toBe(200);
      expect(json.acertos).toBe(1);
    });
  });
});