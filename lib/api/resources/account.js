import { z } from 'zod';

import { prisma } from '../../prisma.js';
import { requestIp } from '../../auth.js';
import { describePasswordProblem, hashPassword, verifyPassword } from '../../password.js';
import { badRequest } from '../errors.js';
import { recordAudit } from '../audit.js';
import { createHandler, parseBody } from '../handler.js';

/**
 * The signed-in admin's own account.
 *
 * Separate from the entity resources because it is not CRUD over a collection:
 * there is no create, no delete, and no list. An admin can read their own
 * details and change their own password. Nothing here can act on another
 * account, and `role` is not writable by anything — the enum has one value and
 * the only way to make an admin is the CLI script.
 */

export const accountHandler = createHandler({
  /**
   * `GET /api/admin/account` — who am I.
   *
   * Returns exactly what `getSessionUser` resolved, which is already an explicit
   * field allowlist, plus two derived facts about how this account can sign in.
   *
   * `hasPassword` is a boolean, not the hash: the dashboard needs it to decide
   * between "change password" and "set a password" for an account that has only
   * ever used Google.
   *
   * `linkedProviders` says which OAuth identities are attached and when. The
   * `providerAccountId` is deliberately **not** included — it identifies the
   * Google account itself, the dashboard has no use for it, and a value with no
   * use is a value that only has downsides if it leaks.
   */
  GET: async (req, res) => {
    const { passwordHash, oauthAccounts } = await prisma.adminUser.findUniqueOrThrow({
      where: { id: req.adminUser.id },
      select: {
        passwordHash: true,
        oauthAccounts: { select: { provider: true, createdAt: true } },
      },
    });

    res.status(200).json({
      item: {
        ...req.adminUser,
        hasPassword: Boolean(passwordHash),
        linkedProviders: oauthAccounts.map((account) => ({
          provider: account.provider,
          linkedAt: account.createdAt,
        })),
      },
    });
  },
});

/**
 * Body of a password change.
 *
 * `currentPassword` is optional at the schema level and required at the logic
 * level, because whether it is needed depends on whether one is set: an account
 * that has only ever signed in with Google has no current password to give, and
 * demanding one would make setting the first password impossible.
 */
const changePasswordBody = z.strictObject({
  currentPassword: z.string().max(500).optional(),
  newPassword: z.string().max(500),
});

export const changePasswordHandler = createHandler({
  /**
   * `POST /api/admin/account/password`.
   *
   * Requires the current password when one exists. This is the check that makes
   * a stolen session cookie insufficient to lock the real owner out: without it,
   * anyone holding a session could set a new password and take the account
   * permanently. Session theft becomes a temporary problem instead of a
   * terminal one.
   */
  POST: async (req, res) => {
    const { currentPassword, newPassword } = parseBody(changePasswordBody, req);

    const account = await prisma.adminUser.findUniqueOrThrow({
      where: { id: req.adminUser.id },
      select: { id: true, passwordHash: true },
    });

    if (account.passwordHash) {
      if (!currentPassword) {
        throw badRequest('Enter your current password.', {
          currentPassword: 'Required to change your password.',
        });
      }

      const matches = await verifyPassword(currentPassword, account.passwordHash);

      if (!matches) {
        // Recorded, because a failed password change on an authenticated session
        // is a more interesting event than a failed login — it means either a
        // typo or someone else holding the cookie.
        await recordAudit(prisma, {
          actorId: account.id,
          action: 'login_failed',
          entity: 'AdminUser',
          entityId: account.id,
          diff: { reason: 'wrong_current_password_on_change' },
          ip: requestIp(req),
        });

        throw badRequest('That is not your current password.', {
          currentPassword: 'Incorrect.',
        });
      }
    }

    const problem = describePasswordProblem(newPassword);
    if (problem) {
      throw badRequest(problem, { newPassword: problem });
    }

    // Rejecting a no-op change: it is almost always a mistake, and letting it
    // succeed would write an audit entry saying the password changed when it did
    // not.
    if (account.passwordHash && (await verifyPassword(newPassword, account.passwordHash))) {
      throw badRequest('That is already your password.', {
        newPassword: 'Choose a different password.',
      });
    }

    const passwordHash = await hashPassword(newPassword);

    await prisma.$transaction(async (tx) => {
      await tx.adminUser.update({ where: { id: account.id }, data: { passwordHash } });

      await recordAudit(tx, {
        actorId: account.id,
        action: 'update',
        entity: 'AdminUser',
        entityId: account.id,
        // `computeDiff` would redact this anyway; written explicitly so the
        // intent is visible at the call site rather than relying on the
        // redaction list to catch it.
        diff: { passwordHash: { from: '[redacted]', to: '[redacted]' } },
        ip: requestIp(req),
      });
    });

    // No body. There is nothing useful to return, and echoing any part of an
    // account record on a password change invites adding the wrong field later.
    res.status(204).end();
  },
});
