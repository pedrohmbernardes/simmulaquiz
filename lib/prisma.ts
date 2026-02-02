import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  // Logs apenas em desenvolvimento para não vazar dados em produção
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// 🛡️ SEGURANÇA: Timeout Global (Anti-DoS)
// Se uma query demorar mais de 10s, ela é cancelada automaticamente.
prisma.$use(async (params, next) => {
  const timeoutMs = 10000; // 10 segundos

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Query timeout após ${timeoutMs}ms em ${params.model}.${params.action}`)), timeoutMs);
  });

  return Promise.race([
    next(params),
    timeoutPromise
  ]);
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;