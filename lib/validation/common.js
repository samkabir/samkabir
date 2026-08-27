import { z } from 'zod';
import { id, order, publishStatus } from './primitives.js';

/**
 * Turns a create schema into an update schema.
 *
 * Every field becomes optional, because PATCH sends only what changed — but an
 * empty body is rejected. A PATCH with nothing in it is always a bug on the
 * caller's side, and silently returning the unchanged record hides it while
 * still writing an audit entry that claims an update happened.
 *
 * **The output contains only the keys the caller actually sent**, and that is the
 * load-bearing part. `.partial()` makes a field optional but does *not* remove
 * its `.default()`, so a defaulted field reappears in the parsed output even when
 * the request never mentioned it — and the resource layer writes whatever it is
 * handed. The consequences were not subtle:
 *
 *   * `PATCH /blog/:id {title}` → `status: 'DRAFT'` and `tagIds: []`, so renaming
 *     a published post unpublished it and stripped every tag.
 *   * `PATCH /projects/:id {title}` → `order: 0` and `isFeatured: false`, so
 *     renaming a project moved it to the top of the list and dropped it from the
 *     homepage.
 *   * `PATCH /experience/:id {jobPosition}` → `kind: 'FULL_TIME'`, so renaming a
 *     contract role moved it into the full-time tab.
 *
 * Every one of those is silent: the request succeeds, the response looks right
 * because it echoes the row that was just written, and the audit entry faithfully
 * records the damage as an intentional change.
 *
 * Phase 3 half-found this — it is why the emptiness check below reads the raw body
 * rather than the parsed output — but stopped at `{}` and did not follow the same
 * mechanism into non-empty bodies. Filtering by the raw key set fixes the whole
 * class at once, for every entity, rather than per schema.
 */
export function partialOf(schema) {
  const partial = schema.partial();

  return (
    z
      .record(z.string(), z.unknown())
      // Checked against the *raw* body. Checking the parsed output instead lets
      // `{}` through on any entity whose create schema has a `.default()` — the
      // defaults become keys, the count is non-zero, and a PATCH with nothing in
      // it silently "succeeds".
      .refine((value) => Object.keys(value).length > 0, { message: 'No fields to update.' })
      .transform((raw, ctx) => {
        const result = partial.safeParse(raw);

        if (!result.success) {
          // Forwarded rather than re-thrown, so `fieldsFromZod` still sees each
          // issue with its original path and the dashboard still attaches the
          // message to the input it belongs to.
          for (const issue of result.error.issues) ctx.addIssue(issue);
          return z.NEVER;
        }

        const sent = {};
        for (const key of Object.keys(raw)) {
          // `key in result.data` rather than a truthiness check: a field
          // legitimately set to `null`, `false`, `0` or `''` must survive, and
          // those are exactly the values an "unset this" edit sends.
          if (key in result.data) sent[key] = result.data[key];
        }

        return sent;
      })
  );
}

/** `?id=` / `[id]` route parameter. */
export const idParam = z.object({ id: id() });

/**
 * Body of a reorder request: the ids in their new order.
 *
 * Sending the whole list rather than a single {id, order} pair is deliberate. A
 * drag-and-drop reorder changes many positions at once, and applying them one
 * request at a time leaves the list visibly wrong if the third call fails. One
 * body, one transaction, one outcome.
 *
 * Duplicate ids are rejected: they can only come from a client bug, and the
 * result would be two rows silently sharing a position.
 */
export const reorderBody = z.strictObject({
  ids: z
    .array(id())
    .min(1, 'Send at least one id.')
    .max(500, 'Too many items in one reorder.')
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'The same id appears twice.',
    }),
});

/** Body of a publish/unpublish request. */
export const publishBody = z.strictObject({ status: publishStatus() });

/**
 * Query parameters shared by every collection endpoint.
 *
 * `q` is a free-text search, `status` filters by publication state, and the
 * cursor pair pages results. Everything is optional, so a bare GET returns the
 * default listing — which is what the dashboard asks for on first paint.
 */
export const listQuery = z.object({
  q: z.string().trim().max(200).optional(),
  status: publishStatus().optional(),
  take: z.coerce.number().int().min(1).max(200).default(100),
  skip: z.coerce.number().int().min(0).default(0),
  order: order().optional(),
});
