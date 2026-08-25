import bcrypt from 'bcryptjs';

import { describePasswordProblem } from './passwordPolicy.js';

/**
 * Password hashing.
 *
 * bcrypt at 12 rounds: roughly 250 ms per hash on current hardware, which is
 * imperceptible on a login that happens a few times a week and expensive enough
 * to make offline cracking of a leaked hash impractical.
 *
 * The *policy* — length, byte limit, the wording of each rejection — lives in
 * `lib/passwordPolicy.js`, which imports nothing. That is what lets the
 * change-password form apply the identical rule without pulling bcryptjs into the
 * browser bundle. Re-exported here so every existing import keeps working and
 * there is still one obvious place to look.
 */
export { describePasswordProblem, MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH, passwordByteLength } from './passwordPolicy.js';

export const BCRYPT_ROUNDS = 12;

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
