import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Mirrors the `@/*` alias in jsconfig.json, so tests import modules by the
    // same path the application uses.
    alias: { '@': import.meta.dirname },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],

    /**
     * A syntactically valid but unreachable connection string.
     *
     * `lib/prisma.js` throws at import time without one, and every admin route
     * imports it. Constructing a PrismaClient does not open a connection, and no
     * test here gets far enough to issue a query: the auth guard denies first.
     * A real URL would mean the suite silently depended on network access and a
     * live database.
     */
    env: {
      DATABASE_URL: 'postgresql://test:test@127.0.0.1:5432/test?sslmode=disable',
      DIRECT_URL: 'postgresql://test:test@127.0.0.1:5432/test?sslmode=disable',

      /**
       * Auth configuration the modules read at import time.
       *
       * A fixed throwaway secret, not the real one: the suite must not depend on
       * `.env.local` existing, and a test that silently used production
       * credentials would be worse than one that fails without them.
       *
       * `ADMIN_EMAILS` is deliberately set to an address no test signs in as, so
       * the allowlist is exercised as a real filter rather than as a no-op.
       */
      NEXTAUTH_SECRET: 'test-secret-not-used-anywhere-real',
      NEXTAUTH_URL: 'http://localhost:3000',
      ADMIN_EMAILS: 'allowed@example.invalid',
    },
  },
});
