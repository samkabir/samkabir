/**
 * Display formatting for the dashboard.
 *
 * Locale-independent by design. `toLocaleString()` renders differently on the
 * server and in the browser — a different default locale, or a different
 * timezone — and Next.js then reports a hydration mismatch on a date that was
 * only ever decoration. Fixed formats avoid the whole class of problem, and this
 * dashboard has exactly one reader, whose date format is known.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Parses whatever the API sent — an ISO string, a Date — or null. */
function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `July 2025`. What a CV timeline reads like. */
export function formatMonth(value) {
  const date = toDate(value);
  if (!date) return '';
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** `2025-07-14`. Read in UTC, because `@db.Date` values are stored at UTC noon. */
export function formatDay(value) {
  const date = toDate(value);
  if (!date) return '';
  return date.toISOString().slice(0, 10);
}

/** `2025-07-14 09:32`. For audit entries and last-sign-in. */
export function formatDateTime(value) {
  const date = toDate(value);
  if (!date) return '';
  return date.toISOString().slice(0, 16).replace('T', ' ');
}

/**
 * `July 2025 – Present`, the label the public site shows for a role.
 *
 * Mirrors what the site renders so the dashboard is not the only place the
 * result is a surprise. `timelineOverride` wins, because that is the entire
 * reason the column exists.
 */
export function formatTimeline({ startDate, endDate, isCurrent, timelineOverride }) {
  if (timelineOverride) return timelineOverride;

  const start = formatMonth(startDate);
  if (!start) return '';

  if (isCurrent) return `${start} – Present`;

  const end = formatMonth(endDate);
  return end ? `${start} – ${end}` : start;
}

/** `1900 – 2004`, for an education row. Handles either year being unknown. */
export function formatYearRange(startYear, endYear) {
  if (startYear && endYear) return `${startYear} – ${endYear}`;
  return String(startYear ?? endYear ?? '');
}

/** `412 KB`. Binary units, because that is what the upload limit is expressed in. */
export function formatBytes(bytes) {
  if (typeof bytes !== 'number' || Number.isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * A one-line summary of an audit entry, for the Overview feed.
 *
 * The diff is deliberately not rendered field by field here — a Markdown body
 * change would fill the screen. The field *names* are enough to answer "what did
 * I touch yesterday", and the full diff is one query away in the audit endpoint.
 */
export function describeAuditEntry(entry) {
  const fields = entry?.diff && typeof entry.diff === 'object' ? Object.keys(entry.diff) : [];

  const verb = {
    create: 'created',
    update: 'edited',
    delete: 'deleted',
    publish: 'published',
    unpublish: 'unpublished',
    reorder: 'reordered',
    login: 'signed in',
    login_failed: 'failed to sign in',
  }[entry?.action] ?? entry?.action ?? 'changed';

  if (entry?.action === 'login' || entry?.action === 'login_failed') return verb;
  if (entry?.action === 'reorder') return `reordered ${entry.entity}`;

  const subject = entry?.entity ?? 'record';
  if (entry?.action === 'update' && fields.length) {
    const shown = fields.slice(0, 3).join(', ');
    const rest = fields.length > 3 ? ` and ${fields.length - 3} more` : '';
    return `${verb} ${subject} — ${shown}${rest}`;
  }

  return `${verb} ${subject}`;
}
