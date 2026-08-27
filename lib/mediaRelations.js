/**
 * Every relation that can hold a `Media` id.
 *
 * Written out rather than derived from the Prisma client, because getting this
 * list wrong deletes files that are in use — and the failure is silent: the
 * prune script would report a referenced image as unreferenced and remove it.
 *
 * Lives here rather than in `scripts/prune-media.mjs` so a test can import it
 * without running the script, and so the list has one home if anything else ever
 * needs to ask "is this file in use". `tests/mediaRelations.test.js` checks it
 * against `schema.prisma`: adding a relation to the `Media` model and forgetting
 * this list fails there rather than in production.
 */
export const MEDIA_RELATIONS = [
  'profileAvatars',
  'seoOgImages',
  'projectCovers',
  'resumes',
  'blogCovers',
  'blogOgImages',
];
