import { fieldsFromZod } from './api/errors.js';

/**
 * The pure parts of a form: building initial values, turning values back into a
 * request body, working out what actually changed, and validating.
 *
 * Separated from the components on purpose. These four operations are where a
 * form is most likely to be subtly wrong — a cleared field that silently keeps
 * its old value, a PATCH that sends every field and so overwrites a change made
 * in another tab, a validator that runs on the wrong shape — and none of that is
 * visible in a screenshot. As plain functions they are covered by
 * `tests/adminForm.test.js`; inside a component they would only be exercised by
 * clicking.
 *
 * `fieldsFromZod` is imported from the API's error module rather than
 * reimplemented, so a client-side rejection and a server-side one produce the
 * same `{ field: message }` shape and the form renders them identically. That
 * file has no imports of its own, so nothing server-only follows it into the
 * browser bundle.
 */

/**
 * A field's declared type decides how it is stored, rendered and serialised.
 *
 * Kept as a closed set with one place per type below, so adding a type means
 * touching this file and only this file.
 */
export const FIELD_TYPES = [
  'text',
  'slug',
  'textarea',
  'markdown',
  'number',
  'year',
  'date',
  'select',
  'checkbox',
  'list',
  'image',
  'file',
];

/**
 * Turns a record from the API into form state.
 *
 * The important line is `?? ''`. A nullable column arrives as `null`, and `null`
 * in a controlled `<input value>` makes React treat the input as uncontrolled and
 * warn — then the field silently stops updating. Every text-shaped field is
 * normalised to a string here and back to null by the Zod schema on the way out,
 * which is the pair `optionalText` exists to complete.
 */
export function formValues(item, fields) {
  const values = {};
  const record = item ?? {};

  for (const field of fields) {
    const raw = record[field.name];

    switch (field.type) {
      case 'checkbox':
        values[field.name] = Boolean(raw ?? field.default ?? false);
        break;

      case 'list':
        values[field.name] = Array.isArray(raw) ? [...raw] : [];
        break;

      case 'date':
        // `@db.Date` columns come back as a full ISO timestamp; the input wants
        // the calendar day, which is the first ten characters.
        values[field.name] = raw ? String(raw).slice(0, 10) : '';
        break;

      case 'image':
      case 'file':
        // The value is the whole Media row, not its id: the preview needs the
        // url, the dimensions and the alt text. `toPayload` reduces it to an id.
        values[field.name] = (field.mediaKey ? record[field.mediaKey] : null) ?? null;
        break;

      case 'number':
      case 'year':
        values[field.name] = raw === null || raw === undefined ? '' : String(raw);
        break;

      default:
        values[field.name] = raw ?? field.default ?? '';
    }
  }

  return values;
}

/**
 * Turns form state into a request body.
 *
 * Numbers are the case worth reading twice. An `<input type="number">` holds a
 * string, and an empty one holds `''`. `Number('')` is `0` — so a cleared "end
 * year" would post 1900's rejection or, worse, a plausible zero. Empty becomes
 * `null`, which is what a nullable column means by empty.
 */
export function toPayload(values, fields) {
  const payload = {};

  for (const field of fields) {
    const value = values[field.name];

    switch (field.type) {
      /**
       * An empty slug is **omitted**, not sent as `''`.
       *
       * The endpoint derives a slug from the title when the field is absent, and
       * leaves an existing one alone — which is the whole point: a URL that is
       * already public must not change every time the title is edited. But
       * `slug()` requires at least one character, so posting `''` is a validation
       * error reading "Required." on a field the user deliberately left blank.
       *
       * Omission is the only value that means "you decide". Found by creating a
       * project without touching the slug field.
       */
      case 'slug':
        if (value !== null && value !== undefined && String(value).trim() !== '') {
          payload[field.name] = value;
        }
        break;

      case 'image':
      case 'file':
        payload[field.name] = value?.id ?? null;
        break;

      case 'number':
      case 'year':
        payload[field.name] = value === '' || value === null || value === undefined
          ? null
          : Number(value);
        break;

      case 'list':
        payload[field.name] = Array.isArray(value) ? value : [];
        break;

      case 'checkbox':
        payload[field.name] = Boolean(value);
        break;

      default:
        payload[field.name] = value;
    }
  }

  return payload;
}

/** Structural comparison, good enough for the JSON-shaped values a form holds. */
function sameValue(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((entry, index) => sameValue(entry, b[index]));
  }
  // Both null-ish counts as unchanged: a field that was null and is now '' was
  // never touched, it was just rendered.
  if ((a === null || a === undefined || a === '') && (b === null || b === undefined || b === '')) {
    return true;
  }
  return false;
}

/**
 * The fields that differ, as a PATCH body.
 *
 * This is what makes an update safe to run while another tab is open: sending
 * only what this form changed means a field someone else edited is left alone,
 * rather than being overwritten with the value this page loaded three minutes
 * ago. It is also required by the API — a PATCH carrying every field would write
 * an audit entry claiming ten fields changed when one did.
 */
export function changedFields(before, after) {
  const changed = {};

  for (const [key, value] of Object.entries(after)) {
    if (!sameValue(before?.[key], value)) changed[key] = value;
  }

  return changed;
}

export function hasChanges(before, after) {
  return Object.keys(changedFields(before, after)).length > 0;
}

/**
 * Runs a Zod schema over a candidate body.
 *
 * The same schema the endpoint uses, imported from `lib/validation/`. Not a
 * convenience: two validators inevitably disagree, and the disagreement is
 * always discovered as "the form accepted it and the server did not", which
 * looks like a broken save.
 *
 * Validating client-side does not make the server's check redundant — the server
 * is the only one that counts, since anything can post to the endpoint. It makes
 * the *message* immediate, which is a different job.
 */
export function validateWith(schema, body) {
  const result = schema.safeParse(body);

  if (result.success) return { ok: true, data: result.data, fields: null };

  return { ok: false, data: null, fields: fieldsFromZod(result.error) };
}

/**
 * Merges client-side and server-side field errors, server winning.
 *
 * Only the server knows about uniqueness, foreign keys and anything else that
 * depends on the rest of the database, so when both have an opinion about a
 * field, the server's is the one that will still be true after a retry.
 */
export function mergeFieldErrors(clientFields, serverFields) {
  return { ...(clientFields ?? {}), ...(serverFields ?? {}) };
}
