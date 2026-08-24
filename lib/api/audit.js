/**
 * Writes the append-only record of what the dashboard changed.
 *
 * Worth being precise about why this exists at all: one person edits production
 * content directly, with no review step and no second pair of eyes. When the
 * site is wrong, the only available question is "what changed recently", and
 * without this the answer is a guess.
 */

/**
 * Field names never written to the log, whatever the entity.
 *
 * The audit table is queried casually — it is the thing you read when something
 * is broken — so it must not become the place a password hash or an access token
 * is sitting in plain sight. Matching is by normalised name, so `passwordHash`,
 * `password_hash` and `PasswordHash` are all caught.
 */
const REDACTED = new Set([
  'passwordhash',
  'password',
  'newpassword',
  'currentpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'apikey',
]);

/** Longest value stored per field. */
const MAX_VALUE_LENGTH = 500;

const isRedacted = (field) => REDACTED.has(String(field).toLowerCase().replace(/[^a-z]/g, ''));

/**
 * Prepares one value for storage as JSON.
 *
 * Dates become ISO strings because `Json` columns do not round-trip a `Date`.
 * Long strings are truncated: a 200 KB Markdown body would make the audit row
 * larger than the post it describes, and "the content changed" is the useful
 * fact — the content itself is in the row being audited.
 */
function summarise(value) {
  if (value instanceof Date) return value.toISOString();
  if (value === null || value === undefined) return null;

  if (typeof value === 'string' && value.length > MAX_VALUE_LENGTH) {
    return `${value.slice(0, MAX_VALUE_LENGTH)}… (${value.length} characters)`;
  }

  if (Array.isArray(value)) {
    return value.length > 20 ? [...value.slice(0, 20).map(summarise), `… ${value.length} total`] : value.map(summarise);
  }

  return value;
}

/** Structural equality, good enough for scalars, dates and string arrays. */
function isEqual(a, b) {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => isEqual(item, b[index]));
  }
  if (a == null || b == null) return a == null && b == null;
  if (typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

/**
 * `{ field: { from, to } }` for changed fields only.
 *
 * Unchanged fields are omitted rather than recorded as no-ops, so reading the
 * log answers "what changed" directly instead of requiring a diff of the diff.
 * Keys are taken from `after` — a PATCH only sends what it touches, and listing
 * every column of the row as "unchanged" would bury the one line that matters.
 * `updatedAt` is dropped for the same reason: it changes on every write and
 * says nothing.
 */
export function computeDiff(before, after) {
  const diff = {};

  for (const [field, next] of Object.entries(after ?? {})) {
    if (field === 'updatedAt' || field === 'createdAt') continue;

    if (isRedacted(field)) {
      // Recorded as having changed, without either value. That a password was
      // changed is exactly the kind of thing the log should show.
      if (!before || !isEqual(before[field], next)) diff[field] = { from: '[redacted]', to: '[redacted]' };
      continue;
    }

    const previous = before ? before[field] : undefined;
    if (before && isEqual(previous, next)) continue;

    diff[field] = { from: before ? summarise(previous) : null, to: summarise(next) };
  }

  return Object.keys(diff).length ? diff : null;
}

/**
 * Appends one entry.
 *
 * `client` is a PrismaClient or a transaction handle — passing the transaction
 * is what makes the audit entry and the change it describes commit or fail
 * together. A log that can disagree with the data is worse than no log, because
 * it is trusted.
 *
 * Failures here are logged and swallowed. Losing an audit row is bad; failing
 * the user's save because the audit insert failed is worse, and the save has
 * already succeeded by the time this runs outside a transaction.
 */
export async function recordAudit(client, { actorId, action, entity, entityId, diff, ip }) {
  try {
    await client.auditLog.create({
      data: {
        actorId: actorId ?? null,
        action,
        entity,
        entityId: entityId ?? null,
        diff: diff ?? undefined,
        ip: ip ?? null,
      },
    });
  } catch (error) {
    console.error('[audit] failed to record %s %s %s:', action, entity, entityId, error);
  }
}
