// __tests__/admin-security.test.ts

/**
 * @jest-environment node
 */
import { DELETE } from '@/app/api/admin/usuarios/route';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// 1. MOCK DAS DEPENDÊNCIAS

// Mock do next/headers
jest.mock('next/headers', () => ({
  headers: jest.fn().mockResolvedValue({
    get: jest.fn((key) => {
      if (key === 'x-forwarded-for') return '127.0.0.1';
      return null;
    })
  })
}));

// ✅ MOCK DO CSRF
jest.mock('@/lib/csrf', () => ({
  verifyCSRFToken: jest.fn().mockResolvedValue(true), 
}));

// ✅ MOCK DO RATE LIMIT
jest.mock('@/lib/ratelimit', () => ({
  authRateLimit: {
    limit: jest.fn().mockResolvedValue({ success: true })
  }
}));

// Mock do Mail
jest.mock('@/lib/mail', () => ({
  enviarCodigoExclusaoConta: jest.fn(),
  enviarEmailBoasVindas: jest.fn()
}));

// Mock do Prisma
jest.mock('@/lib/prisma', () => {
  const mockTx = {
    usuario: { findUnique: jest.fn(), delete: jest.fn() },
    simulado: { deleteMany: jest.fn() },
    historicoPontos: { deleteMany: jest.fn() },
    usuarioConquista: { deleteMany: jest.fn() },
    usuarioGamificacao: { deleteMany: jest.fn() },
    logAuditoria: { create: jest.fn() },
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
    SISTEMA_ERRO: 'SISTEMA_ERRO',
    USUARIO_EXCLUIR: 'USUARIO_EXCLUIR',
    SEGURANCA_CSRF_INVALIDO: 'SEGURANCA_CSRF_INVALIDO'
  }
}));

jest.mock('@/lib/sanitize', () => ({
  sanitizeObject: jest.fn((obj) => obj),
  sanitizeText: jest.fn((str) => str),
  sanitizeHTML: jest.fn((str) => str)
}));

const createRequest = (id: number) => 
  new Request(`http://localhost:3000/api/admin/usuarios?id=${id}`, { 
    method: 'DELETE',
    headers: {
      'x-csrf-token': 'mock-token-valido' 
    }
  });

describe('🔒 Segurança da API Admin (RBAC)', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('⛔ Deve BLOQUEAR acesso se o usuário não for SUPER_ADMIN', async () => {
    (getSession as jest.Mock).mockResolvedValue({ 
      sub: '10', 
      role: 'PROFESSOR',
      name: 'Professor Teste'
    });

    const response = await DELETE(createRequest(5));
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe('Proibido');
    expect(prisma.usuario.delete).not.toHaveBeenCalled();
  });

  test('🛡️ Deve IMPEDIR que um Super Admin exclua outro Super Admin', async () => {
    (getSession as jest.Mock).mockResolvedValue({ 
      sub: '1', 
      role: 'SUPER_ADMIN',
      name: 'Admin Supremo'
    });

    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ 
      id: 99, 
      tipo: 'SUPER_ADMIN', 
      email: 'outro@admin.com' 
    });

    const response = await DELETE(createRequest(99));
    const json = await response.json();

    expect(response.status).toBe(403);
    
    // ✅ CORREÇÃO AQUI: Texto ajustado para bater com a API
    expect(json.error).toMatch(/não é possível excluir outro Super Admin/i);
    
    expect(prisma.usuario.delete).not.toHaveBeenCalled();
  });

  test('✅ Deve PERMITIR a exclusão de um Aluno por um Super Admin', async () => {
    (getSession as jest.Mock).mockResolvedValue({ 
      sub: '1', 
      role: 'SUPER_ADMIN',
      name: 'Admin Supremo'
    });

    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ 
      id: 50, 
      tipo: 'ALUNO', 
      email: 'aluno@teste.com' 
    });

    const response = await DELETE(createRequest(50));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(prisma.usuario.delete).toHaveBeenCalledWith({ where: { id: 50 } });
  });
});