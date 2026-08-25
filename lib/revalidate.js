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
 * on the home page and working out which ones do would be a lookup table that has
 * to stay correct. `/blog` is here for the same reason: publishing a post changes
 * the archive, and so does editing a tag name, and so does the home page's nav
 * gaining a Blog link the moment the first post goes live.
 *
 * Individual post pages are **not** listed, because the list is fixed and their
 * slugs are not. `postPaths` builds those per mutation instead.
 */
export const REVALIDATE_PATHS = ['/', '/blog'];

/**
 * The paths affected by a change to one post.
 *
 * A post's own page has to be revalidated by slug, and the slug can *change* in
 * the same save that changes the content — so both the old and the new one are
 * rebuilt. Missing the old slug would leave the previous URL serving the previous
 * content indefinitely, which is the confusing failure: the post looks un-edited
 * at the address someone already shared.
 *
 * The archive and the home page come along because a title or a publish date
 * changes what the listing shows.
 */
export function postPaths({ slug, previousSlug } = {}) {
  const slugs = [slug, previousSlug].filter(
    (value) => typeof value === 'string' && value.length > 0
  );

  return [...REVALIDATE_PATHS, ...new Set(slugs.map((value) => `/blog/${value}`))];
}

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
