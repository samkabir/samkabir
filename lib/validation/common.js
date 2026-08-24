import { z } from 'zod';
import { id, order, publishStatus } from './primitives.js';

/**
 * Turns a create schema into an update schema.
 *
 * Every field becomes optional, because PATCH sends only what changed — but an
 * empty body is rejected. A PATCH with nothing in it is always a bug on the
 * caller's side, and silently returning the unchanged record hides it while
 * still writing an audit entry that claims an update happened.
 */
export function partialOf(schema) {
  // The emptiness check runs against the *raw* body, before the schema fills in
  // defaults. Checking the parsed output instead lets `{}` through on any entity
  // whose create schema has a `.default()` — the defaults become keys, the count
  // is non-zero, and a PATCH with nothing in it silently "succeeds" while
  // writing an audit entry claiming an update happened. Caught by test, not by
  // inspection.
  return z
    .record(z.string(), z.unknown())
    .refine((value) => Object.keys(value).length > 0, { message: 'No fields to update.' })
    .pipe(schema.partial());
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
