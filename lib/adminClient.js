/**
 * The dashboard's only way of talking to the admin API.
 *
 * One module rather than a `fetch` in each screen, for three reasons that each
 * bit at least once while Phases 3–5 were being verified by hand:
 *
 *   1. **The error envelope is parsed in one place.** Every endpoint answers
 *      `{ error: { message, fields? } }`, and `fields` is what lets a message
 *      land beside the input it belongs to. A screen that reads
 *      `response.statusText` instead shows "Bad Request" and loses the sentence
 *      the server wrote for the user.
 *
 *   2. **A 401 means the session went away**, not that this particular request
 *      was malformed. Sessions last seven days and are revoked the moment an
 *      address leaves `ADMIN_EMAILS`, so a signed-in dashboard *will* eventually
 *      get one. Handled centrally it becomes a redirect to the login form with a
 *      return path; handled per-screen it becomes ten different error messages.
 *
 *   3. **`credentials: 'same-origin'`, always.** The session is an httpOnly
 *      cookie. Omitting this on a cross-origin-looking request sends no cookie
 *      and produces a 401 that looks exactly like an expired session.
 *
 * Nothing here caches. Every response already carries `no-store` from
 * `createHandler`, and a dashboard that shows a stale list after a save is worse
 * than one that waits.
 */

import { loginUrlFor } from './returnPath.js';

/**
 * A failed request, carrying what the UI needs to render it.
 *
 * `fields` maps input name → message, straight from the server. `status` is kept
 * so a caller can distinguish a 409 (someone else changed it — reload) from a
 * 400 (this form is wrong — fix it).
 */
export class ApiError extends Error {
  constructor(message, { status = 0, fields = null, cause } = {}) {
    super(message, { cause });
    this.name = 'ApiError';
    this.status = status;
    this.fields = fields;
  }

  /** True when the server rejected specific inputs rather than the whole call. */
  get hasFieldErrors() {
    return Boolean(this.fields && Object.keys(this.fields).length > 0);
  }
}

/** Set once by `AdminLayout`, so a 401 can be shown before the page navigates. */
let onSessionLost = null;

export function setSessionLostHandler(handler) {
  onSessionLost = handler;
}

const SESSION_EXPIRED = 'Your session has expired. Sign in again.';

/**
 * Reacts to a 401 by leaving the page.
 *
 * A full location assignment rather than the Next router: the session cookie is
 * gone, so every piece of data on the current page is unauthorised, and a
 * client-side transition would keep the stale screen mounted while its fetches
 * fail one after another. The redirect is deliberately the last thing that
 * happens, after the error has been thrown, so the layout can show the reason
 * for a beat rather than the page vanishing unexplained.
 */
function handleUnauthorised() {
  // The handler first, and without a `window` check: it is registered by the
  // layout and is the whole point of the mechanism. Only the fallback needs a
  // browser, and only the fallback should be skipped without one.
  if (onSessionLost) {
    onSessionLost(SESSION_EXPIRED);
    return;
  }

  if (typeof window === 'undefined') return;

  window.location.assign(loginUrlFor(window.location.pathname + window.location.search));
}

/**
 * Turns a response into data, or throws an `ApiError`.
 *
 * The body is read as text first and then parsed, because a non-JSON response is
 * a real case — a proxy error page, or an HTML 500 from the platform — and
 * `response.json()` on one of those throws a `SyntaxError` whose message
 * ("Unexpected token '<'") tells the user nothing.
 */
async function readResponse(response) {
  if (response.status === 204) return null;

  const text = await response.text();

  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (response.ok) {
    if (body === null && text) {
      throw new ApiError('The server sent a response the dashboard could not read.', {
        status: response.status,
      });
    }
    return body;
  }

  if (response.status === 401) {
    handleUnauthorised();
    throw new ApiError(body?.error?.message ?? SESSION_EXPIRED, { status: 401 });
  }

  throw new ApiError(
    body?.error?.message ?? `The request failed (${response.status}).`,
    { status: response.status, fields: body?.error?.fields ?? null }
  );
}

async function request(method, path, { body, signal } = {}) {
  let response;

  try {
    response = await fetch(path, {
      method,
      // Sends the session cookie. Without it every request is anonymous.
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    // An aborted request is not a failure — it is a screen that unmounted or a
    // search box whose earlier keystroke no longer matters. Rethrown untouched
    // so callers can recognise it by name rather than by message.
    if (error?.name === 'AbortError') throw error;

    throw new ApiError('Could not reach the server. Check your connection.', { cause: error });
  }

  return readResponse(response);
}

/** Builds `?a=1&b=2`, dropping anything empty so a blank search box sends nothing. */
export function queryString(params = {}) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }

  const rendered = search.toString();
  return rendered ? `?${rendered}` : '';
}

export const api = {
  get: (path, options) => request('GET', path, options),
  post: (path, body, options) => request('POST', path, { ...options, body: body ?? {} }),
  patch: (path, body, options) => request('PATCH', path, { ...options, body }),
  put: (path, body, options) => request('PUT', path, { ...options, body }),
  del: (path, options) => request('DELETE', path, options),
};

export default api;
