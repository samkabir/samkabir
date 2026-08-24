import { slugify, uniqueSlug } from '../slug.js';
import { slug as slugSchema } from '../validation/primitives.js';
import { badRequest } from './errors.js';

/**
 * Resolves the slug for a create or update.
 *
 * The two cases are treated differently on purpose:
 *
 *   * **Explicit slug** — returned unchanged. If it collides, the unique
 *     constraint produces a 409 and the user is told. Quietly turning the
 *     `my-post` they typed into `my-post-2` would publish a URL they did not
 *     choose and cannot see they got.
 *
 *   * **Derived from the title** — a free variant is found automatically. The
 *     user never asked for a slug here, so a collision is not their decision to
 *     make and interrupting the save with an error about a field they did not
 *     fill in would be obtuse.
 */
export async function resolveSlug({ tx, delegate, requested, source, currentId }) {
  if (requested) return requested;

  const derived = slugify(source);
  const validated = slugSchema().safeParse(derived);

  if (!validated.success) {
    // Reached when the title is entirely punctuation or a script this
    // transliteration cannot reduce to ASCII. The fix is for the user to supply
    // a slug, so the error points at that field.
    throw badRequest('Could not build a URL from this title — enter a slug yourself.', {
      slug: 'Required, because the title contains no usable characters.',
    });
  }

  return uniqueSlug(validated.data, async (candidate) => {
    const existing = await tx[delegate].findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    return existing ? existing.id !== currentId : false;
  });
}
