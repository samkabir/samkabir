/**
 * Sets a new password on an existing admin account.
 *
 *     npm run admin:reset-password
 *
 * This is the recovery path, and it is deliberately CLI-only: there is no
 * "forgot password" email flow. Adding one would mean an email provider, an
 * API key, a token table, and a public endpoint that accepts an address and acts
 * on it — a meaningful amount of new attack surface for a single-user dashboard
 * whose owner has shell access to the machine that can reach the database.
 *
 * The trade-off is real and worth naming: losing the password while away from a
 * machine with the connection string means being locked out until you reach one.
 * Google sign-in is the mitigation — two independent ways in, so one failing
 * does not lock you out.
 */

import { prisma } from '../lib/prisma.js';
import { isAdminEmail, adminEmails } from '../lib/adminEmails.js';
import { describePasswordProblem, hashPassword } from '../lib/password.js';
import { ask, askNewPassword } from './prompt.mjs';

const emailArg = process.argv.slice(2).find((arg) => !arg.startsWith('--'));

function fail(message) {
  console.error(`\n${message}\n`);
  process.exitCode = 1;
}

async function main() {
  const accounts = await prisma.adminUser.findMany({
    select: { id: true, email: true, passwordHash: true },
    orderBy: { createdAt: 'asc' },
  });

  if (accounts.length === 0) {
    fail('There is no admin account yet. Create one first:\n\n  npm run admin:create');
    return;
  }

  const email = (emailArg ?? (accounts.length === 1 ? accounts[0].email : await ask(
    `Which account? (${accounts.map((a) => a.email).join(', ')}) `
  ))).trim().toLowerCase();

  const account = accounts.find((candidate) => candidate.email === email);

  if (!account) {
    fail(
      `No admin account for "${email}".\n\n` +
        `Existing: ${accounts.map((a) => a.email).join(', ')}`
    );
    return;
  }

  // A warning rather than a refusal. The row can legitimately outlive its
  // presence on the allowlist — an address temporarily removed, say — and
  // silently setting a password that cannot be used would be worse than saying
  // so and continuing.
  if (!isAdminEmail(account.email)) {
    console.warn(
      `\nWarning: ${account.email} is not currently in ADMIN_EMAILS ` +
        `(${adminEmails().join(', ') || 'unset'}).\n` +
        `The password will be set, but sign-in will still be refused until the\n` +
        `address is added back to the allowlist.\n`
    );
  }

  console.log(
    `\n${account.passwordHash ? 'Changing' : 'Setting'} the password for ${account.email}.`
  );
  console.log('Use at least 12 characters.\n');

  const password = await askNewPassword();

  const problem = describePasswordProblem(password);
  if (problem) {
    fail(`${problem}\n\nNothing was changed. Run this again.`);
    return;
  }

  const passwordHash = await hashPassword(password);

  await prisma.$transaction([
    prisma.adminUser.update({ where: { id: account.id }, data: { passwordHash } }),
    prisma.auditLog.create({
      data: {
        actorId: account.id,
        action: 'update',
        entity: 'AdminUser',
        entityId: account.id,
        diff: { source: 'cli', passwordHash: { from: '[redacted]', to: '[redacted]' } },
        ip: null,
      },
    }),
  ]);

  console.log(`\nDone. ${account.email} can sign in with the new password.`);
  console.log(
    'Existing sessions are unaffected — signing out everywhere is not something\n' +
      'a JWT session can do without a session table. If that matters, rotate\n' +
      'NEXTAUTH_SECRET, which invalidates every session immediately.\n'
  );
}

try {
  await main();
} catch (error) {
  fail(error.message);
} finally {
  await prisma.$disconnect();
}
