import bcrypt from 'bcryptjs';

/**
 * Password hashing and the policy that governs it.
 *
 * bcrypt at 12 rounds: roughly 250 ms per hash on current hardware, which is
 * imperceptible on a login that happens a few times a week and expensive enough
 * to make offline cracking of a leaked hash impractical.
 */
export const BCRYPT_ROUNDS = 12;

export const MIN_PASSWORD_LENGTH = 12;

/**
 * bcrypt reads at most 72 bytes and **silently ignores the rest**.
 *
 * That is not a theoretical concern: with a 90-character passphrase, a truncated
 * variant sharing the first 72 bytes authenticates just as well, so the user
 * believes they have more entropy than they do. Rejecting the input is honest;
 * some implementations pre-hash with SHA-256 to lift the limit, which is a
 * reasonable choice but adds a construction to get subtly wrong for one account.
 *
 * Bytes, not characters — a passphrase with emoji or non-Latin script reaches
 * the limit sooner than its length suggests.
 */
export const MAX_PASSWORD_BYTES = 72;

/**
 * A bcrypt hash of a value nobody knows, used to spend the same time verifying a
 * password for an account that does not exist as for one that does.
 *
 * Without it, "no such user" returns in microseconds while a real user's wrong
 * password takes ~250 ms, and that difference tells an attacker which addresses
 * have accounts. Not a secret: it is a hash of random bytes discarded at
 * generation.
 */
const TIMING_EQUALISER_HASH = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewZBLDJhOl7pP9Zu';

/**
 * Describes what is wrong with a password, or returns null when it is fine.
 *
 * Returns a sentence rather than a boolean so the same text can be shown in the
 * form and returned by the API, and so the CLI can print it.
 */
export function describePasswordProblem(password) {
  if (typeof password !== 'string' || password.length === 0) {
    return 'Enter a password.';
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters. A short phrase of a few words is both stronger and easier to remember than a short scramble.`;
  }

  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    return `Too long — bcrypt only reads the first ${MAX_PASSWORD_BYTES} bytes, so anything beyond that would be silently ignored rather than protecting you.`;
  }

  if (password.trim().length === 0) {
    return 'A password of only whitespace is almost certainly a mistake.';
  }

  return null;
}

export async function hashPassword(password) {
  const problem = describePasswordProblem(password);
  // Checked here as well as at the call sites: this is the last point before a
  // weak password becomes a stored hash, and a caller that forgets to validate
  // should fail rather than succeed quietly.
  if (problem) throw new Error(`Refusing to hash an unacceptable password: ${problem}`);

  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verifies a password against a stored hash.
 *
 * A null hash — an account that only ever signs in with Google — still performs
 * a comparison against the equaliser, so the response time does not reveal
 * whether the account has a password set.
 */
export async function verifyPassword(password, hash) {
  if (typeof password !== 'string' || password.length === 0) {
    await bcrypt.compare('', TIMING_EQUALISER_HASH);
    return false;
  }

  if (!hash) {
    await bcrypt.compare(password, TIMING_EQUALISER_HASH);
    return false;
  }

  return bcrypt.compare(password, hash);
}
