import { getServerSession } from 'next-auth/next';

import { authOptions } from './authOptions.js';
import { isAdminEmail } from './adminEmails.js';
import { prisma } from './prisma.js';
import { unauthorized } from './api/errors.js';

/**
 * Gate 3 — server-side authorisation for the admin API.
 *
 * This is the gate that matters. The `/admin` route protection in
 * `middleware.js` is a convenience for humans clicking around; it does nothing
 * about a request made with curl, Postman, or a script. Every `/api/admin/*`
 * handler goes through `withAdmin` below, so all of those hit the same check as
 * the dashboard does.
 *
 * There is still no development bypass — no `SKIP_AUTH`, no
 * `NODE_ENV === 'development'` shortcut. That was true when this file denied
 * everything in Phase 3 and it stays true now that it works.
 */

/**
 * Fields of an admin that may leave the server.
 *
 * An explicit allowlist rather than the whole row, so adding a sensitive column
 * to `AdminUser` cannot start leaking it through every authenticated response.
 * `passwordHash` is the one that matters today.
 */
const SAFE_USER_FIELDS = {
  id: true,
  email: true,
  name: true,
  image: true,
  role: true,
  lastLoginAt: true,
};

/**
 * Resolves the signed-in admin from the request, or null.
 *
 * Three things have to hold, and all three are checked on **every request**
 * rather than once at sign-in:
 *
 *   1. A valid session cookie exists and carries an `AdminUser` id.
 *   2. That row still exists — a deleted account cannot keep working because
 *      its cookie has not expired yet.
 *   3. Its address is *still* on `ADMIN_EMAILS`. This is the important one: a
 *      JWT session is self-contained and stays cryptographically valid until it
 *      expires, so without re-checking, removing an address from the allowlist
 *      would have no effect for up to seven days. With it, revocation is
 *      immediate.
 *
 * The cost is one indexed primary-key lookup per admin request, on a dashboard
 * used by one person. That is a good trade for revocation that actually works.
 */
export async function getSessionUser(req, res) {
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.id;

  if (!userId) return null;

  const user = await prisma.adminUser.findUnique({
    where: { id: userId },
    select: SAFE_USER_FIELDS,
  });

  if (!user) return null;
  if (!isAdminEmail(user.email)) return null;

  return user;
}

/**
 * Wraps a handler so it runs only for a signed-in admin.
 *
 * The resolved user is attached as `req.adminUser`, which is what the audit log
 * records as the actor. Handlers never read the session themselves — if they
 * did, one could read it without checking it.
 */
export function withAdmin(handler) {
  return async function guarded(req, res) {
    const user = await getSessionUser(req, res);

    if (!user) {
      throw unauthorized();
    }

    req.adminUser = user;
    return handler(req, res);
  };
}

/**
 * Best-effort client IP for the audit trail.
 *
 * `x-forwarded-for` is client-supplied and therefore forgeable in general;
 * behind Vercel's proxy the first entry is the real peer. It is recorded as a
 * hint for reading the audit log, never as an authorisation input — which is the
 * only reason trusting it is acceptable here.
 */
export function requestIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (first?.split(',')[0] ?? req.socket?.remoteAddress ?? '').trim() || null;
}
