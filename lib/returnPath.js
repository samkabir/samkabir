/**
 * Where a successful sign-in may send the user.
 *
 * Only a path under `/admin` is accepted. Without this check, `?from=` is an
 * open redirect: a link to `/admin/login?from=https://evil.example` would bounce
 * the admin to another origin immediately after authenticating — a convincing
 * place to put a fake "your session expired, sign in again" form, arrived at
 * from a genuine sign-in on the real site.
 *
 * Lives in `lib/` rather than in the page so it can be tested directly. An
 * open-redirect guard exercised only by clicking through the UI is one that gets
 * refactored without anyone noticing.
 */
export const DEFAULT_RETURN_PATH = '/admin';

export function safeReturnPath(from) {
  if (typeof from !== 'string' || from.length === 0) return DEFAULT_RETURN_PATH;

  // Protocol-relative: starts with a slash, but a browser reads `//host/path` as
  // another origin. This is the case a naive `startsWith('/')` check misses.
  if (from.startsWith('//')) return DEFAULT_RETURN_PATH;

  // Some browsers normalise backslashes to forward slashes, so `/\evil.example`
  // can escape the origin too.
  if (from.includes('\\')) return DEFAULT_RETURN_PATH;

  // A newline or other control character could split a header in the redirect
  // response.
  if (/[\u0000-\u001f\u007f]/.test(from)) return DEFAULT_RETURN_PATH;

  // Finally, it has to plainly be a path under /admin. Checked last so the
  // cheaper structural rejections happen first.
  if (from !== '/admin' && !from.startsWith('/admin/') && !from.startsWith('/admin?')) {
    return DEFAULT_RETURN_PATH;
  }

  return from;
}

/**
 * The login URL to send an expired session to, carrying where it was.
 *
 * The counterpart to `safeReturnPath`: this writes the `?from=` value that the
 * function above later has to trust. Written here rather than in the client so
 * the two halves of the same contract sit together — and so the loop case is
 * handled once. A login page that returns to the login page would sign the user
 * in and put them straight back on the form.
 */
export function loginUrlFor(pathAndQuery) {
  const from = typeof pathAndQuery === 'string' ? pathAndQuery : '';

  if (!from || from.startsWith('/admin/login')) return '/admin/login';

  return `/admin/login?from=${encodeURIComponent(from)}`;
}
