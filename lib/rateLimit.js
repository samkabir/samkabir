import { prisma } from './prisma.js';

/**
 * Throttling for the credentials endpoint, backed by the audit log.
 *
 * **Why not an in-memory counter.** The obvious implementation is a `Map` of
 * attempts, and on Vercel it would be close to useless: each serverless instance
 * has its own memory, so an attacker's requests spread across instances each see
 * a fresh counter, and every cold start forgets everything. A limit that only
 * holds under conditions production does not have is worse than none, because it
 * reads as protection.
 *
 * Every failure is already written to `AuditLog` — that is the record the log
 * exists for — so counting recent rows gives a limit that is shared across
 * instances, survives restarts, and needs no new table or dependency. Login is
 * rare enough that the extra query costs nothing.
 */

const WINDOW_MINUTES = 15;

/**
 * Per-account, then per-address.
 *
 * The account limit is the tighter one: it is the specific thing being attacked.
 * The address limit is looser because one address is also a whole household or
 * office behind NAT, and locking out a legitimate admin is its own kind of
 * failure.
 */
const MAX_FAILURES_PER_ACCOUNT = 5;
const MAX_FAILURES_PER_IP = 10;

const windowStart = () => new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);

/**
 * Whether this attempt should be refused before the password is even checked.
 *
 * `accountId` is null when the address matches no account. Only the address
 * limit applies then — counting attempts against a non-existent account would
 * need the attempted address to be queryable, and storing it that way would turn
 * the audit log into a list of addresses someone guessed.
 */
export async function loginRateLimitStatus({ accountId, ip }) {
  const since = windowStart();

  const [accountFailures, ipFailures] = await Promise.all([
    accountId
      ? prisma.auditLog.count({
          where: { action: 'login_failed', actorId: accountId, createdAt: { gte: since } },
        })
      : Promise.resolve(0),
    ip
      ? prisma.auditLog.count({
          where: { action: 'login_failed', ip, createdAt: { gte: since } },
        })
      : Promise.resolve(0),
  ]);

  if (accountFailures >= MAX_FAILURES_PER_ACCOUNT || ipFailures >= MAX_FAILURES_PER_IP) {
    return {
      limited: true,
      // The message says how long, because "try again later" with no number
      // invites the user to retry immediately and conclude it is broken.
      message: `Too many failed sign-in attempts. Wait ${WINDOW_MINUTES} minutes and try again.`,
    };
  }

  return { limited: false };
}

/**
 * Records a failed attempt.
 *
 * `actorId` is the account the attempt was *against*, not the person making it —
 * a stretch of the field's usual meaning, noted here because it is what makes
 * the per-account count possible without a second table. Null when the address
 * matched nothing.
 *
 * The attempted password is of course never recorded, and neither is an
 * unrecognised address: an audit log full of guessed addresses is a liability,
 * not a record.
 */
export async function recordLoginFailure({ accountId, ip, provider, reason }) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: accountId ?? null,
        action: 'login_failed',
        entity: 'AdminUser',
        entityId: accountId ?? null,
        diff: { provider, reason },
        ip: ip ?? null,
      },
    });
  } catch (error) {
    console.error('[auth] failed to record a failed sign-in:', error);
  }
}

/** Records a successful sign-in and stamps `lastLoginAt`. */
export async function recordLoginSuccess({ accountId, ip, provider }) {
  try {
    await prisma.$transaction([
      prisma.adminUser.update({ where: { id: accountId }, data: { lastLoginAt: new Date() } }),
      prisma.auditLog.create({
        data: {
          actorId: accountId,
          action: 'login',
          entity: 'AdminUser',
          entityId: accountId,
          diff: { provider },
          ip: ip ?? null,
        },
      }),
    ]);
  } catch (error) {
    // A sign-in that worked must not fail because the bookkeeping did.
    console.error('[auth] failed to record a successful sign-in:', error);
  }
}

export const RATE_LIMIT = {
  WINDOW_MINUTES,
  MAX_FAILURES_PER_ACCOUNT,
  MAX_FAILURES_PER_IP,
};
