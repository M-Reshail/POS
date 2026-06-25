/**
 * Prisma Client Singleton
 *
 * In development, ts-node-dev restarts the module on file changes,
 * which would create a new PrismaClient on every restart and exhaust
 * the PostgreSQL connection pool. This pattern stores the client on
 * the global object to survive hot-reloads.
 *
 * In production, a fresh module-level instance is used normally.
 *
 * Usage:
 *   import { prisma } from '../lib/prisma';
 *   const users = await prisma.user.findMany();
 */

import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const createPrismaClient = (): PrismaClient => {
  return new PrismaClient({
    log: env.isDevelopment
      ? ['query', 'info', 'warn', 'error']
      : ['warn', 'error'],
  });
};

export const prisma: PrismaClient =
  global.__prisma ?? createPrismaClient();

if (env.isDevelopment) {
  global.__prisma = prisma;
}

export default prisma;
