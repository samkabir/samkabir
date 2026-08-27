/**
 * What makes a password acceptable — with no dependency on bcrypt.
 *
 * Split out of `lib/password.js` for one reason: the change-password form needs
 * to apply the same rule the server applies, and importing the hashing module
 * into a page would pull bcryptjs into the browser bundle. A second copy of the
 * rule in the form would be worse — it would eventually disagree, and the
 * disagreement would show up as a password the form accepts and the server
 * refuses.
 *
 * `lib/password.js` re-exports everything here, so nothing that already imported
 * these from there has to change.
 */

export const MIN_PASSWORD_LENGTH = 12;

/**
 * bcrypt reads at most 72 bytes and **silently ignores the rest**.
 *
 * Not a theoretical concern: with a 90-character passphrase, a truncated variant
 * sharing the first 72 bytes authenticates just as well, so the user believes
 * they have more entropy than they do. Rejecting the input is honest; pre-hashing
 * with SHA-256 lifts the limit and is a reasonable choice, but it adds a
 * construction to get subtly wrong for one account.
 *
 * Bytes, not characters — a passphrase with emoji or non-Latin script reaches the
 * limit sooner than its length suggests.
 */
export const MAX_PASSWORD_BYTES = 72;

/**
 * UTF-8 byte length, measured the same way in both runtimes.
 *
 * `Buffer.byteLength` is Node-only and `TextEncoder` is in both, so this is the
 * one that can live in a module the browser also loads. The two agree on every
 * input; this is not an approximation.
 */
export function passwordByteLength(password) {
  return new TextEncoder().encode(password).length;
}

/**
 * Describes what is wrong with a password, or returns null when it is fine.
 *
 * A sentence rather than a boolean, so the same words appear in the form, in the
 * API response and in the CLI — three places that would otherwise each invent
 * their own phrasing for the same rule.
 */
export function describePasswordProblem(password) {
  if (typeof password !== 'string' || password.length === 0) {
    return 'Enter a password.';
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters. A short phrase of a few words is both stronger and easier to remember than a short scramble.`;
  }

  if (passwordByteLength(password) > MAX_PASSWORD_BYTES) {
    return `Too long — bcrypt only reads the first ${MAX_PASSWORD_BYTES} bytes, so anything beyond that would be silently ignored rather than protecting you.`;
  }

  if (password.trim().length === 0) {
    return 'A password of only whitespace is almost certainly a mistake.';
  }

  return null;
}
