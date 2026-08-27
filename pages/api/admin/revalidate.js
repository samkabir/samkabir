import { requestIp } from '@/lib/auth';
import { recordAudit } from '@/lib/api/audit';
import { createHandler } from '@/lib/api/handler';
import { prisma } from '@/lib/prisma';
import { REVALIDATE_PATHS, revalidatePublicPages } from '@/lib/revalidate';

/**
 * `POST /api/admin/revalidate` — the manual rebuild control.
 *
 * Deliberately under `pages/api/admin/` rather than at `pages/api/revalidate.js`
 * as Phase 7's plan sketched it. Two things follow from the location, and both
 * are why it moved:
 *
 *   * `createHandler` applies `withAdmin` with no way to opt out, so this is
 *     guarded by the same code as every other admin route rather than by a check
 *     written here.
 *   * `tests/adminRoutes.test.js` discovers routes by globbing this directory, so
 *     the 401-unauthenticated and no-store assertions now cover this endpoint
 *     automatically. A route that has to remember to add itself to a test is a
 *     route that eventually forgets.
 *
 * The alternative the plan mentioned — a shared secret compared with
 * `timingSafeEqual` — is what this would need if anything outside the dashboard
 * ever called it. Nothing does, and a secret that exists for no caller is another
 * thing to leak.
 *
 * Unlike the automatic revalidation after a save, this one reports failure. It
 * was pressed on purpose, so "did it work" is the only question being asked.
 */
async function rebuild(req, res) {
  const result = await revalidatePublicPages(res, REVALIDATE_PATHS);

  /**
   * Recorded so `/admin` can answer "when was the last rebuild".
   *
   * Only the manual press is logged, not the automatic revalidation after every
   * save — that would double the size of the audit table to record something
   * already implied by the mutation next to it. This keeps the timestamp
   * meaningful: it is the last time someone asked for a rebuild directly.
   */
  await recordAudit(prisma, {
    actorId: req.adminUser.id,
    action: 'revalidate',
    entity: 'Site',
    entityId: null,
    diff: {
      paths: { from: null, to: result.revalidated },
      ...(result.failed.length ? { failed: { from: null, to: result.failed } } : {}),
    },
    ip: requestIp(req),
  });

  if (!result.ok) {
    res.status(502).json({
      error: {
        message:
          result.reason === 'unsupported'
            ? 'This deployment cannot rebuild pages on demand.'
            : `Could not rebuild ${result.failed.map((f) => f.path).join(', ')}.`,
      },
    });
    return;
  }

  res.status(200).json({ revalidated: result.revalidated, at: new Date().toISOString() });
}

export default createHandler({ POST: rebuild });
