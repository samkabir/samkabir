/**
 * Runs a command with `.env.local` loaded into the environment.
 *
 *     node scripts/with-env.mjs prisma migrate dev
 *
 * Why this exists: secrets live in `.env.local` because that is what Next.js
 * loads and what `.gitignore` covers. The Prisma CLI, however, only reads
 * `.env` — so `prisma migrate` would run with no DATABASE_URL and fail with a
 * confusing "environment variable not found". Rather than keep a second copy of
 * the credentials in `.env`, every db: script goes through here.
 *
 * `process.loadEnvFile` is built into Node (>= 20.12), so this costs no
 * dependency. `.env` is also loaded first, if present, so a checked-out clone
 * that happens to use `.env` still works; `.env.local` wins on conflict, which
 * is the same precedence Next.js applies.
 *
 * A variable already present in the environment is **not** overwritten by either
 * file — verified, not assumed. That is the precedence that matters in
 * production: on Vercel the connection string comes from the platform, and a
 * stray `.env.local` in a deployment must not silently replace it. It also means
 * `ADMIN_EMAILS= npm run admin:create` works for testing a guard, since the
 * explicit value wins.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

for (const file of ['.env', '.env.local']) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error('usage: node scripts/with-env.mjs <command> [args…]');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error(
    '\nDATABASE_URL is not set.\n\n' +
      'Create a `.env.local` in the project root holding DATABASE_URL and\n' +
      'DIRECT_URL from Neon. See `.env.example` for the shape.\n'
  );
  process.exit(1);
}

/**
 * Resolve a local binary without a shell.
 *
 * `shell: true` would find `prisma` on the PATH npm sets up, but Node warns
 * about it (DEP0190) because arguments are concatenated rather than escaped.
 * Looking the binary up in node_modules/.bin ourselves lets us spawn directly,
 * which is both quieter and safer. Anything not installed locally — `node`
 * itself, for instance — falls through to normal PATH resolution.
 */
function resolveLocal(bin) {
  const suffix = process.platform === 'win32' ? '.cmd' : '';
  const local = path.join('node_modules', '.bin', bin + suffix);
  return existsSync(local) ? path.resolve(local) : bin;
}

// stdio: 'inherit' keeps Prisma's interactive prompts and colour working.
const child = spawn(resolveLocal(command), args, { stdio: 'inherit' });

child.on('error', (error) => {
  console.error(`\nFailed to run \`${command}\`: ${error.message}\n`);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
