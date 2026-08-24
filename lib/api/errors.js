/**
 * One error shape for the whole admin API: `{ error: { message, fields? } }`.
 *
 * `message` is safe to show a human. `fields` maps a form input name to the
 * problem with it, so the dashboard can put the message next to the input rather
 * than in a toast at the top of the page. Anything without a field goes in
 * `message` alone.
 *
 * Nothing here ever carries a stack trace, a SQL fragment, or a constraint name.
 * Those go to the server log; the client gets a sentence.
 */

/** An error with an intended HTTP status. Anything else becomes a 500. */
export class ApiError extends Error {
  constructor(status, message, { fields, cause } = {}) {
    super(message, { cause });
    this.name = 'ApiError';
    this.status = status;
    this.fields = fields;
  }
}

export const badRequest = (message = 'Invalid request.', fields) =>
  new ApiError(400, message, { fields });

export const unauthorized = (message = 'You must be signed in.') => new ApiError(401, message);

export const forbidden = (message = 'You do not have access to this.') => new ApiError(403, message);

export const notFound = (message = 'Not found.') => new ApiError(404, message);

export const conflict = (message, fields) => new ApiError(409, message, { fields });

/**
 * Turns Zod issues into the `fields` map.
 *
 * Only the first issue per field survives: a form input shows one message, and
 * the first is the most specific one Zod produced. `unrecognized_keys` reports
 * with an empty path, so its keys are pulled out of the issue itself — otherwise
 * a smuggled field would produce an error with nothing pointing at it.
 */
export function fieldsFromZod(error) {
  const fields = {};

  for (const issue of error.issues) {
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys ?? []) {
        fields[key] ??= 'This field is not editable.';
      }
      continue;
    }

    const key = issue.path.length ? issue.path.join('.') : '_';
    fields[key] ??= issue.message;
  }

  return fields;
}

/** Column name in a Postgres constraint → the form field that owns it. */
function fieldFromTarget(target) {
  if (!target) return null;
  const columns = Array.isArray(target) ? target : [target];
  const column = String(columns[0] ?? '');

  // Prisma reports either the column list or the constraint name, depending on
  // the connector; both are snake_case, and the form fields are camelCase.
  return column
    .replace(/_key$|_unique$/, '')
    .replace(/^[a-z_]+?_(?=[a-z_]+$)/, '')
    .replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Maps a database-level failure onto an HTTP status.
 *
 * The cases here are the ones a *valid* request can still hit: a slug someone
 * else took, a row deleted in another tab, a file still referenced by a résumé.
 * They are user-facing outcomes, not faults, and they deserve a specific message
 * rather than a 500.
 *
 * Prisma does not always classify a RESTRICT violation — the smoke test in Phase
 * 2 saw one arrive as an unmapped connector error carrying the raw Postgres code
 * — so the SQLSTATE fallback below catches what the code check misses.
 */
export function fromPrismaError(error) {
  const code = error?.code;
  const message = String(error?.message ?? '');

  if (code === 'P2002') {
    const field = fieldFromTarget(error.meta?.target);
    return conflict(
      field ? 'That value is already used by another record.' : 'That record already exists.',
      field ? { [field]: 'Already taken.' } : undefined
    );
  }

  if (code === 'P2025') {
    return notFound('That record no longer exists — it may have been deleted elsewhere.');
  }

  if (code === 'P2003' || code === 'P2014' || /23503/.test(message)) {
    return conflict(
      'Another record still refers to this one, so it cannot be changed or removed yet.'
    );
  }

  // 23001 is a RESTRICT violation: the row is pointed at by something that
  // explicitly forbids deletion — a Media row under an active résumé.
  if (/23001/.test(message)) {
    return conflict('This file is in use and cannot be deleted while something still uses it.');
  }

  return null;
}
