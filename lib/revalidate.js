/**
 * Busting the static cache after a save.
 *
 * `revalidate: 60` on the home page already means an edit appears within a
 * minute. This makes it appear on the next reload, which is the difference
 * between a CMS that feels like a CMS and one that feels broken — someone who
 * saves, reloads, sees the old text and saves again has learned to distrust the
 * dashboard.
 *
 * The timer stays as the backstop. On-demand revalidation is a network call that
 * can fail, and a failed call must degrade to "up to a minute late" rather than
 * to "stale until the next deploy".
 */

/**
 * Pages built from database content.
 *
 * A list rather than a call site per entity, because almost every entity appears
 * on the home page and working out which ones do would be a lookup table that
 * has to stay correct. `/blog` and `/blog/[slug]` join this in Phase 8.
 */
export const REVALIDATE_PATHS = ['/'];

/**
 * Rebuilds the public pages, and never throws.
 *
 * The swallowed error is the whole design. This runs after a mutation the
 * database has already committed, so raising here would report a successful save
 * as a failure and invite a retry that saves the same thing twice. The cost of
 * staying quiet is bounded: the page is at most `revalidate` seconds stale, which
 * is exactly where it would have been without this function.
 *
 * `res.revalidate` is what Next.js gives an API route for this; it needs the real
 * response object, so this takes one rather than importing something global.
 *
 * Returns what happened, so a caller that *does* want to report it — the manual
 * rebuild button — can.
 */
export async function revalidatePublicPages(res, paths = REVALIDATE_PATHS) {
  if (typeof res?.revalidate !== 'function') {
    // Reachable in tests and in any context that fakes a response. Worth
    // returning honestly rather than throwing: the caller's own work succeeded.
    return { ok: false, revalidated: [], failed: [], reason: 'unsupported' };
  }

  const revalidated = [];
  const failed = [];

  for (const path of paths) {
    try {
      await res.revalidate(path);
      revalidated.push(path);
    } catch (error) {
      failed.push({ path, message: String(error?.message ?? error) });
      console.error('[revalidate] %s failed:', path, error);
    }
  }

  return { ok: failed.length === 0, revalidated, failed };
}
