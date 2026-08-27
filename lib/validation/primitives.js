import { z } from 'zod';

/**
 * Shared building blocks for every entity schema.
 *
 * Two rules hold throughout this directory:
 *
 *   1. **Every object schema is strict.** Unknown keys are an error, not
 *      something to silently drop. The dashboard is the only client, so an
 *      unexpected key means either a bug or an attempt to smuggle a field the
 *      form does not own — `role`, `passwordHash`, `id`. Rejecting is the
 *      cheaper failure.
 *
 *   2. **Length limits are explicit and always present.** An unbounded `String`
 *      column plus an unbounded validator is an easy way to have a form post a
 *      50 MB body into the database. The limits below are generous relative to
 *      real content and small relative to what would hurt.
 *
 * These schemas run in the browser and on the server from the same file. That is
 * the point: one definition means the two can never disagree, which is how a
 * field ends up validated in the form and unvalidated at the endpoint.
 */

/** Character ceilings by role of the field, not by entity. */
export const MAX = {
  slug: 120,
  label: 200,
  line: 500,
  prose: 5_000,
  markdown: 200_000,
  url: 2_048,
  listItem: 1_000,
  listLength: 50,
};

/**
 * A required human-entered string.
 *
 * Trimmed before the emptiness check, so a field holding only spaces fails
 * rather than storing whitespace that renders as a blank heading.
 */
export function requiredText(max = MAX.label) {
  return z.string().trim().min(1, 'Required.').max(max, `Must be ${max} characters or fewer.`);
}

/**
 * An optional human-entered string, normalised so "absent" has one
 * representation.
 *
 * An HTML input that the user clears posts `''`, not `null`. Left alone, the
 * database ends up with a mix of empty strings and nulls in the same column and
 * every read has to test for both. Everything falsy becomes `null` here.
 */
export function optionalText(max = MAX.label) {
  return z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer.`)
    .nullish()
    .transform((value) => value || null);
}

/**
 * An optional string for a column that is **NOT NULL with a default of `''`**.
 *
 * The distinction from `optionalText` matters and is not cosmetic.
 * `Project.description` and `BlogPost.excerpt` are `String @default("")` — the
 * column rejects null. Sending `null` for a cleared field produces
 * `Argument 'description' must not be null`, a 500 from a request that was
 * entirely valid. Sending `undefined` would be wrong in the other direction: on
 * a PATCH, Prisma reads it as "leave unchanged", so clearing the field in the
 * form would silently not clear it.
 *
 * `''` is the only value that means "empty" to both the column and an update.
 */
export function textOrEmpty(max = MAX.label) {
  return z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer.`)
    .nullish()
    .transform((value) => value || '');
}

/** Long-form prose for a nullable column. */
export const prose = () => optionalText(MAX.prose);

/**
 * URL-safe identifier: lowercase alphanumerics separated by single hyphens.
 *
 * Validated rather than merely slugified because slugs appear in public URLs and
 * are matched against `getStaticPaths`. A slug that round-trips through
 * `encodeURIComponent` unchanged is one class of routing bug avoided.
 */
export const slug = () =>
  z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Required.')
    .max(MAX.slug, `Must be ${MAX.slug} characters or fewer.`)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Use lowercase letters, numbers and single hyphens — no spaces or punctuation.'
    );

/**
 * An absolute http(s) URL.
 *
 * The scheme allowlist is the security-relevant part: `z.url()` alone accepts
 * `javascript:` and `data:`, and these values are rendered straight into `href`
 * attributes. Rejecting anything but http and https here means the render side
 * does not have to re-check.
 */
export function httpUrl() {
  // Trimmed *before* the format check, not after. `z.url()` rejects a string
  // with surrounding whitespace, so chaining `.trim()` after it would reject a
  // pasted URL that only had a trailing space — a real thing users do, and a
  // baffling error to receive. The scheme check still sees the trimmed value.
  return z
    .string()
    .trim()
    .max(MAX.url, `Must be ${MAX.url} characters or fewer.`)
    .pipe(z.url({ protocol: /^https?$/, message: 'Must be a valid http:// or https:// URL.' }));
}

/** Optional http(s) URL, with the same empty-string normalisation as text. */
export function optionalHttpUrl() {
  return z
    .union([z.literal(''), z.null(), httpUrl()])
    .nullish()
    .transform((value) => value || null);
}

// Same ordering point as httpUrl: normalise first, then validate. A copied
// address arriving as "  Sam@Example.com " is valid once trimmed, and the stored
// form is lowercase so two spellings of one address cannot both exist.
export const email = () =>
  z
    .string()
    .trim()
    .toLowerCase()
    .max(MAX.label)
    .pipe(z.email('Must be a valid email address.'));

export const optionalEmail = () =>
  z
    .union([z.literal(''), z.null(), email()])
    .nullish()
    .transform((value) => value || null);

/**
 * A cuid — the id format every model uses.
 *
 * Checked before it reaches Prisma so a malformed id returns 400 with a useful
 * message rather than 500 from the driver.
 */
export const id = () => z.cuid('Not a valid id.');

export const publishStatus = () => z.enum(['DRAFT', 'PUBLISHED']);

export const experienceKind = () => z.enum(['FULL_TIME', 'CONTRACT']);

/**
 * A sort position. Coerced because it arrives as a string from query strings and
 * as a number from JSON bodies, and both are legitimate.
 */
export const order = () =>
  z.coerce.number().int('Must be a whole number.').min(0, 'Cannot be negative.').max(100_000);

/** A year, bounded to values that make sense on a CV. */
export const year = () =>
  z.coerce
    .number()
    .int('Must be a whole year, e.g. 2021.')
    .min(1900, 'Too early to be plausible.')
    .max(2100, 'Too far in the future.')
    .nullish()
    .transform((value) => (value === undefined ? null : value));

/**
 * A calendar date as `YYYY-MM-DD`, converted to the `Date` Prisma wants.
 *
 * Deliberately not `z.coerce.date()`, which accepts anything `new Date()` will
 * chew on — including `"next tuesday"`-shaped garbage that silently becomes
 * `Invalid Date`. The `@db.Date` columns hold days, so the wire format is a day.
 * Parsed as UTC noon so that a client in any timezone reads back the same
 * calendar day.
 */
export const calendarDate = () =>
  z.iso
    .date('Must be a date in YYYY-MM-DD format.')
    .transform((value) => new Date(`${value}T12:00:00.000Z`));

export const optionalCalendarDate = () =>
  z
    .union([z.literal(''), z.null(), calendarDate()])
    .nullish()
    .transform((value) => value || null);

/**
 * A `String[]` column: responsibilities, stacks.
 *
 * Blank entries are dropped rather than rejected, because a form with a
 * repeating row leaves an empty last row as a matter of course and failing the
 * whole save for it would be obnoxious. Everything else — count, length,
 * whitespace — is enforced.
 */
export function stringList({ max = MAX.listLength, itemMax = MAX.listItem } = {}) {
  return z
    .array(z.string().trim().max(itemMax, `Each entry must be ${itemMax} characters or fewer.`))
    .max(max, `At most ${max} entries.`)
    .default([])
    .transform((items) => items.filter(Boolean));
}

/** A boolean from a checkbox, tolerant of the string forms a query string gives. */
export const flag = (defaultValue = false) =>
  z
    .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
    .default(defaultValue);
