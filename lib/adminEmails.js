/**
 * The allowlist of addresses permitted to sign in.
 *
 * This is the primary access control for the whole dashboard, and it is
 * deliberately server-side environment configuration rather than a database
 * table: a table can be written to by a bug, and an attacker who can add a row
 * has added themselves an account. `ADMIN_EMAILS` can only be changed by
 * whoever controls the deployment.
 */

/** Parsed allowlist, lowercased. Empty when unset. */
export function adminEmails() {
  return String(process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Whether an address may sign in.
 *
 * **Fails closed.** An unset or empty `ADMIN_EMAILS` denies everyone rather than
 * allowing everyone — the difference between a misconfigured deployment that is
 * unusable and one that is wide open. A missing environment variable is a
 * plausible accident; this makes its consequence the safe one.
 *
 * Compared case-insensitively because email domains are case-insensitive and
 * Google may return a differently-cased local part than the one configured.
 */
export function isAdminEmail(email) {
  if (!email) return false;

  const allowed = adminEmails();
  if (allowed.length === 0) return false;

  return allowed.includes(String(email).trim().toLowerCase());
}
