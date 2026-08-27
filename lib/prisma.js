import { PrismaClient } from '@prisma/client';

/**
 * A single PrismaClient shared across the whole process.
 *
 * Two separate problems make this necessary:
 *
 *   1. In development, Next.js hot-reloads modules on every edit. A `new
 *      PrismaClient()` at module scope would therefore create a fresh client —
 *      and a fresh connection pool — on every save, until Postgres refuses new
 *      connections. Caching on `globalThis` survives hot reload because the
 *      module registry is cleared but the global object is not.
 *
 *   2. In production on Vercel, each serverless function instance runs this
 *      module once and may then serve many requests. One client per instance is
 *      exactly right; the pooled DATABASE_URL handles the fan-out across
 *      instances.
 *
 * The guard is deliberately not applied in production: caching on the global
 * there would be harmless but pointless, and leaving it out keeps the reason
 * for the cache honest — it exists for hot reload.
 */

const globalForPrisma = globalThis;

function createClient() {
  if (!process.env.DATABASE_URL) {
    // Failing here with a readable message beats Prisma's connection error
    // several stack frames deeper, which reads like a network fault rather than
    // a missing setup step.
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env.local and fill it in — see docs/setup.md.'
    );
  }

  return new PrismaClient({
    // Errors and warnings always; full query logging only when explicitly asked
    // for, because it is extremely noisy and can echo content into the terminal.
    log:
      process.env.PRISMA_LOG_QUERIES === 'true'
        ? ['query', 'warn', 'error']
        : ['warn', 'error'],
  });
}

export const prisma = globalForPrisma.__portfolioPrisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__portfolioPrisma = prisma;
}

export default prisma;
