/**
 * Creates the admin account.
 *
 *     npm run admin:create
 *
 * This is the **only** way an admin account comes into existence. There is no
 * registration endpoint, no signup form, and no seed file containing a password.
 * That is what makes the brief's requirement — "an authenticated user cannot
 * simply register another account and gain access to the dashboard" — true by
 * construction rather than by a check that could be missed.
 *
 * The address must already be on `ADMIN_EMAILS`. Creating a row for an address
 * that cannot sign in would be a confusing dead end: the account would exist,
 * the password would be correct, and every attempt would still be refused.
 */

import { prisma } from '../lib/prisma.js';
import { isAdminEmail, adminEmails } from '../lib/adminEmails.js';
import { describePasswordProblem, hashPassword } from '../lib/password.js';
import { ask, askNewPassword } from './prompt.mjs';

const args = process.argv.slice(2);
const force = args.includes('--force');
const emailArg = args.find((arg) => !arg.startsWith('--'));

function fail(message) {
  console.error(`\n${message}\n`);
  process.exitCode = 1;
}

async function main() {
  const allowed = adminEmails();

  if (allowed.length === 0) {
    fail(
      'ADMIN_EMAILS is not set in .env.local.\n\n' +
        'That variable is the allowlist of addresses permitted to sign in, and\n' +
        'without it nobody can — including an account this script would create.\n' +
        'Set it first. See Todo/02-set-up-google-sign-in.md.'
    );
    return;
  }

  // With a single allowlisted address there is nothing to choose, so do not make
  // the user retype it. This is the normal case.
  const email = (emailArg ?? (allowed.length === 1 ? allowed[0] : await ask(
    `Which address? (${allowed.join(', ')}) `
  ))).trim().toLowerCase();

  if (!isAdminEmail(email)) {
    fail(
      `"${email}" is not in ADMIN_EMAILS, so it could never sign in.\n\n` +
        `Currently allowed: ${allowed.join(', ')}\n\n` +
        'Add it to ADMIN_EMAILS in .env.local, or use one of the above.'
    );
    return;
  }

  const existing = await prisma.adminUser.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, createdAt: true },
  });

  if (existing && !force) {
    fail(
      `An account for ${email} already exists (created ${existing.createdAt.toISOString().slice(0, 10)}).\n\n` +
        (existing.passwordHash
          ? 'To change its password, run: npm run admin:reset-password'
          : 'It has no password yet — run: npm run admin:reset-password') +
        '\n\nOr pass --force to overwrite it here.'
    );
    return;
  }

  console.log(`\nCreating the admin account for ${email}.`);
  console.log(
    `Use at least 12 characters. A few unrelated words is stronger than a short\n` +
      `scramble and far easier to type correctly when you cannot see it.\n`
  );

  const password = await askNewPassword();

  const problem = describePasswordProblem(password);
  if (problem) {
    fail(`${problem}\n\nNothing was created. Run this again.`);
    return;
  }

  const passwordHash = await hashPassword(password);
  const name = (await ask('Display name (optional): ')) || null;

  const user = await prisma.adminUser.upsert({
    where: { email },
    create: { email, name, passwordHash },
    update: { passwordHash, ...(name ? { name } : {}) },
    select: { id: true, email: true, name: true },
  });

  // Not the transaction that a mutation gets, because this is not a request:
  // there is no session, so there is no actor other than whoever holds the
  // terminal. Recorded so that "who created this account and when" is answerable.
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: existing ? 'update' : 'create',
      entity: 'AdminUser',
      entityId: user.id,
      diff: { source: 'cli', passwordHash: { from: '[redacted]', to: '[redacted]' } },
      ip: null,
    },
  });

  console.log(`\nDone. ${user.email} can now sign in at /admin/login.`);
  console.log('The password was never written to disk, a log, or your shell history.\n');
}

try {
  await main();
} catch (error) {
  fail(error.message);
} finally {
  await prisma.$disconnect();
}
