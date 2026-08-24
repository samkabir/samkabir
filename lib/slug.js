/**
 * Derives a URL-safe slug from a title.
 *
 * Used when a create request omits the slug. It is not a substitute for
 * validation: the result is fed back through the `slug()` schema, so a title
 * that slugifies to nothing (all punctuation, or a non-Latin script this
 * transliteration cannot handle) fails loudly instead of producing an empty
 * public URL.
 *
 * NFKD then stripping combining marks turns "Café" into "cafe" rather than
 * "caf", which is the difference between a readable URL and a broken one.
 */
export function slugify(input) {
  return String(input)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
    .replace(/-+$/g, '');
}

/**
 * Appends `-2`, `-3`, … until the slug is not taken.
 *
 * `isTaken` is injected rather than querying here so this stays a pure function
 * and the caller controls which table is checked and whether the current row is
 * excluded. The cap exists so a bug in `isTaken` cannot spin forever; hitting it
 * means something is wrong, not that 50 posts share a title.
 */
export async function uniqueSlug(base, isTaken, { limit = 50 } = {}) {
  if (!(await isTaken(base))) return base;

  for (let suffix = 2; suffix <= limit; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!(await isTaken(candidate))) return candidate;
  }

  throw new Error(`Could not find a free slug based on "${base}" after ${limit} attempts.`);
}
