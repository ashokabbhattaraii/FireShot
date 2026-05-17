import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    ...(process.env.TRANSACTIONAL_POOLER_DATABASE_URL
      ? { datasources: { db: { url: process.env.TRANSACTIONAL_POOLER_DATABASE_URL } } }
      : {}),
    log: ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') global.__prisma = prisma;

export * from '@prisma/client';
