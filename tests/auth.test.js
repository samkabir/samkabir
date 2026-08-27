import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Prisma is mocked so these tests never need a database.
 *
 * The gates being tested are decisions, not queries — "is this address allowed",
 * "does an account exist", "was a row created". Mocking lets each of those be
 * asserted directly, including the negative that matters most: that a rejected
 * Google sign-in never calls `adminUser.create`. Against a real database that
 * would be an absence you infer from a count; here it is an assertion.
 */
const prismaMock = {
  adminUser: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  oAuthAccount: { upsert: vi.fn() },
  auditLog: { create: vi.fn(), count: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock, default: prismaMock }));

const { isAdminEmail, adminEmails } = await import('@/lib/adminEmails');
const {
  describePasswordProblem,
  hashPassword,
  verifyPassword,
  MAX_PASSWORD_BYTES,
  MIN_PASSWORD_LENGTH,
} = await import('@/lib/password');
const { safeReturnPath, DEFAULT_RETURN_PATH } = await import('@/lib/returnPath');
const { authOptions, authorizeCredentials } = await import('@/lib/authOptions');
const { loginRateLimitStatus, RATE_LIMIT } = await import('@/lib/rateLimit');

const ALLOWED = 'allowed@example.invalid';

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.auditLog.count.mockResolvedValue(0);
  prismaMock.auditLog.create.mockResolvedValue({});
  prismaMock.$transaction.mockResolvedValue([]);
  process.env.ADMIN_EMAILS = ALLOWED;
});

afterEach(() => {
  process.env.ADMIN_EMAILS = ALLOWED;
});

// ---------------------------------------------------------------------------
// The allowlist
// ---------------------------------------------------------------------------

describe('the email allowlist', () => {
  it('accepts a configured address', () => {
    expect(isAdminEmail(ALLOWED)).toBe(true);
  });

  it('is case- and whitespace-insensitive', () => {
    expect(isAdminEmail('  ALLOWED@Example.Invalid ')).toBe(true);
  });

  it('rejects anything else', () => {
    for (const email of ['stranger@example.invalid', 'allowed@example.com', '', null, undefined]) {
      expect(isAdminEmail(email), String(email)).toBe(false);
    }
  });

  it('rejects an address that merely contains an allowed one', () => {
    // A substring match here would let `allowed@example.invalid.evil.example`
    // through, which is a domain an attacker can own.
    expect(isAdminEmail(`${ALLOWED}.evil.example`)).toBe(false);
    expect(isAdminEmail(`x${ALLOWED}`)).toBe(false);
  });

  it('fails closed when ADMIN_EMAILS is unset or empty', () => {
    // The critical property. A missing environment variable is a plausible
    // accident; this makes its consequence "nobody can sign in" rather than
    // "anybody can".
    for (const value of ['', '   ', ',,,', undefined]) {
      if (value === undefined) delete process.env.ADMIN_EMAILS;
      else process.env.ADMIN_EMAILS = value;

      expect(adminEmails()).toEqual([]);
      expect(isAdminEmail(ALLOWED)).toBe(false);
      expect(isAdminEmail('anyone@example.invalid')).toBe(false);
    }
  });

  it('supports several addresses', () => {
    process.env.ADMIN_EMAILS = 'a@example.invalid,b@example.invalid';
    expect(isAdminEmail('b@example.invalid')).toBe(true);
    expect(isAdminEmail('c@example.invalid')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Passwords
// ---------------------------------------------------------------------------

describe('password policy', () => {
  it('accepts a reasonable passphrase', () => {
    expect(describePasswordProblem('correct horse battery staple')).toBe(null);
  });

  it('rejects an empty or missing password', () => {
    for (const value of ['', null, undefined, 42]) {
      expect(describePasswordProblem(value)).toBeTruthy();
    }
  });

  it(`requires at least ${MIN_PASSWORD_LENGTH} characters`, () => {
    expect(describePasswordProblem('a'.repeat(MIN_PASSWORD_LENGTH - 1))).toBeTruthy();
    expect(describePasswordProblem('a'.repeat(MIN_PASSWORD_LENGTH))).toBe(null);
  });

  it(`refuses to exceed bcrypt's ${MAX_PASSWORD_BYTES}-byte limit`, () => {
    // bcrypt silently ignores bytes past 72, so a longer passphrase would give
    // less protection than the user believes — a truncated variant sharing the
    // first 72 bytes authenticates identically. Rejecting is honest.
    expect(describePasswordProblem('a'.repeat(MAX_PASSWORD_BYTES))).toBe(null);
    expect(describePasswordProblem('a'.repeat(MAX_PASSWORD_BYTES + 1))).toBeTruthy();
  });

  it('counts bytes, not characters', () => {
    // Emoji are four bytes each, so 20 of them exceed the limit at 20 characters.
    const emoji = 'x'.repeat(0) + '\u{1F600}'.repeat(20);
    expect(emoji.length).toBeLessThan(MAX_PASSWORD_BYTES);
    expect(Buffer.byteLength(emoji, 'utf8')).toBeGreaterThan(MAX_PASSWORD_BYTES);
    expect(describePasswordProblem(emoji)).toBeTruthy();
  });

  it('rejects whitespace-only', () => {
    expect(describePasswordProblem(' '.repeat(20))).toBeTruthy();
  });
});

describe('password verification', () => {
  it('accepts the correct password and rejects a wrong one', async () => {
    const hash = await hashPassword('correct horse battery staple');

    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
    expect(await verifyPassword('Correct horse battery staple', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
  });

  it('returns false for an account with no password without throwing', async () => {
    // An account that only ever signs in with Google has a null hash. This must
    // be a plain "no", not a crash that becomes a 500.
    expect(await verifyPassword('anything at all', null)).toBe(false);
    expect(await verifyPassword('anything at all', undefined)).toBe(false);
  });

  it('spends comparable time whether or not the account has a hash', async () => {
    // Guards the timing equaliser. A missing hash must not return in
    // microseconds while a real comparison takes ~250ms, because that difference
    // reveals which addresses have accounts. The bound is deliberately loose —
    // this is a smoke test for "a bcrypt comparison happened", not a benchmark.
    const hash = await hashPassword('correct horse battery staple');

    const realStart = performance.now();
    await verifyPassword('wrong password here', hash);
    const realMs = performance.now() - realStart;

    const nullStart = performance.now();
    await verifyPassword('wrong password here', null);
    const nullMs = performance.now() - nullStart;

    expect(nullMs).toBeGreaterThan(realMs / 10);
  });

  it('refuses to hash a password that violates the policy', async () => {
    await expect(hashPassword('short')).rejects.toThrow(/unacceptable password/i);
  });

  it('produces a distinct hash each time', async () => {
    const [a, b] = await Promise.all([hashPassword('a'.repeat(20)), hashPassword('a'.repeat(20))]);
    // Per-hash salt: two identical passwords must not produce identical hashes,
    // or a leaked table reveals which accounts share one.
    expect(a).not.toBe(b);
    expect(await verifyPassword('a'.repeat(20), a)).toBe(true);
    expect(await verifyPassword('a'.repeat(20), b)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Gate 1 — the signIn callback
// ---------------------------------------------------------------------------

describe('gate 1: the signIn callback', () => {
  const googleAccount = { provider: 'google', providerAccountId: '110000000000000000000' };

  it('rejects an address that is not on the allowlist', async () => {
    const allowed = await authOptions.callbacks.signIn({
      user: { email: 'stranger@example.invalid' },
      account: googleAccount,
      profile: { email: 'stranger@example.invalid', email_verified: true },
    });

    expect(allowed).toBe(false);
  });

  it('creates no account row for a rejected sign-in', async () => {
    await authOptions.callbacks.signIn({
      user: { email: 'stranger@example.invalid', name: 'A Stranger' },
      account: googleAccount,
      profile: { email: 'stranger@example.invalid', email_verified: true },
    });

    // The requirement in one assertion: a stranger with a perfectly valid Google
    // account leaves no trace. This is why no Prisma adapter is used — the
    // adapter would have written a user row before this callback ever ran.
    expect(prismaMock.adminUser.create).not.toHaveBeenCalled();
    expect(prismaMock.adminUser.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.oAuthAccount.upsert).not.toHaveBeenCalled();
  });

  it('rejects an allowlisted address whose email Google has not verified', async () => {
    const allowed = await authOptions.callbacks.signIn({
      user: { email: ALLOWED },
      account: googleAccount,
      profile: { email: ALLOWED, email_verified: false },
    });

    expect(allowed).toBe(false);
    expect(prismaMock.oAuthAccount.upsert).not.toHaveBeenCalled();
  });

  it('rejects an allowlisted address with no existing account', async () => {
    prismaMock.adminUser.findUnique.mockResolvedValue(null);

    const allowed = await authOptions.callbacks.signIn({
      user: { email: ALLOWED },
      account: googleAccount,
      profile: { email: ALLOWED, email_verified: true },
    });

    // Google sign-in links an identity to an admin; it does not create one. The
    // account has to come from the CLI first.
    expect(allowed).toBe(false);
    expect(prismaMock.adminUser.create).not.toHaveBeenCalled();
  });

  it('accepts an allowlisted address with an account, and links the identity', async () => {
    prismaMock.adminUser.findUnique.mockResolvedValue({
      id: 'admin-1',
      name: 'Samiul',
      image: 'https://example.invalid/a.png',
    });

    const allowed = await authOptions.callbacks.signIn({
      user: { email: ALLOWED, name: 'Samiul', image: 'https://example.invalid/a.png' },
      account: googleAccount,
      profile: { email: ALLOWED, email_verified: true },
    });

    expect(allowed).toBe(true);
    expect(prismaMock.oAuthAccount.upsert).toHaveBeenCalledOnce();

    const call = prismaMock.oAuthAccount.upsert.mock.calls[0][0];
    expect(call.create.userId).toBe('admin-1');
    expect(call.create.provider).toBe('google');
  });

  it('does not overwrite a name already set in the dashboard', async () => {
    prismaMock.adminUser.findUnique.mockResolvedValue({
      id: 'admin-1',
      name: 'Chosen Name',
      image: 'https://example.invalid/chosen.png',
    });

    await authOptions.callbacks.signIn({
      user: { email: ALLOWED, name: 'Google Name', image: 'https://example.invalid/google.png' },
      account: googleAccount,
      profile: { email: ALLOWED, email_verified: true },
    });

    // `recordLoginSuccess` also updates the row to stamp `lastLoginAt`, so the
    // assertion is about *what* was written, not how many writes happened. An
    // earlier version counted calls and failed for the wrong reason.
    const wroteName = prismaMock.adminUser.update.mock.calls.some(
      ([args]) => 'name' in (args.data ?? {}) || 'image' in (args.data ?? {})
    );
    expect(wroteName).toBe(false);
  });

  it('backfills a name only when there is none', async () => {
    prismaMock.adminUser.findUnique.mockResolvedValue({ id: 'admin-1', name: null, image: null });

    await authOptions.callbacks.signIn({
      user: { email: ALLOWED, name: 'Google Name', image: 'https://example.invalid/google.png' },
      account: googleAccount,
      profile: { email: ALLOWED, email_verified: true },
    });

    const nameWrite = prismaMock.adminUser.update.mock.calls.find(
      ([args]) => 'name' in (args.data ?? {})
    );

    expect(nameWrite).toBeTruthy();
    expect(nameWrite[0].data.name).toBe('Google Name');
    expect(nameWrite[0].data.image).toBe('https://example.invalid/google.png');
  });

  it('denies an unrecognised provider rather than falling through', async () => {
    // Fails closed: adding a provider without thinking about this callback gets
    // a refusal, not a free pass.
    expect(
      await authOptions.callbacks.signIn({
        user: { email: ALLOWED },
        account: { provider: 'github', providerAccountId: '1' },
        profile: { email: ALLOWED, email_verified: true },
      })
    ).toBe(false);

    expect(await authOptions.callbacks.signIn({ user: {}, account: null, profile: {} })).toBe(false);
  });

  it('trusts the credentials provider, which has already checked everything', async () => {
    expect(
      await authOptions.callbacks.signIn({
        user: { email: ALLOWED },
        account: { provider: 'credentials' },
      })
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Gate 2 — credentials
// ---------------------------------------------------------------------------

describe('gate 2: credentials', () => {
  const req = { headers: {}, socket: { remoteAddress: '127.0.0.1' } };

  it('is registered on the NextAuth config', () => {
    const provider = authOptions.providers.find((p) => p.id === 'credentials');
    expect(provider).toBeTruthy();
    // NextAuth replaces the passed `authorize` with a stub and merges the real
    // one from `options` at request time, so the assertions below call
    // `authorizeCredentials` directly rather than through the provider.
    expect(typeof provider.options.authorize).toBe('function');
  });

  it('rejects a wrong password with a message that does not name the cause', async () => {
    const hash = await hashPassword('the real password here');
    prismaMock.adminUser.findUnique.mockResolvedValue({
      id: 'admin-1',
      email: ALLOWED,
      name: null,
      image: null,
      passwordHash: hash,
    });

    await expect(
      authorizeCredentials({ email: ALLOWED, password: 'wrong password here' }, req)
    ).rejects.toThrow('Incorrect email or password.');
  });

  it('accepts the correct password and returns no hash', async () => {
    const hash = await hashPassword('the real password here');
    prismaMock.adminUser.findUnique.mockResolvedValue({
      id: 'admin-1',
      email: ALLOWED,
      name: 'Samiul',
      image: null,
      passwordHash: hash,
    });

    const user = await authorizeCredentials(
      { email: ALLOWED, password: 'the real password here' },
      req
    );

    expect(user).toEqual({ id: 'admin-1', email: ALLOWED, name: 'Samiul', image: null });
    expect(user).not.toHaveProperty('passwordHash');
  });

  it('gives an unknown address the same error as a wrong password', async () => {
    prismaMock.adminUser.findUnique.mockResolvedValue(null);

    await expect(
      authorizeCredentials(
        { email: 'nobody@example.invalid', password: 'any password here' },
        req
      )
    ).rejects.toThrow('Incorrect email or password.');
  });

  it('refuses an account whose address has been removed from the allowlist', async () => {
    // The session-revocation counterpart: even with the right password, an
    // address taken off ADMIN_EMAILS cannot sign in again.
    const hash = await hashPassword('the real password here');
    prismaMock.adminUser.findUnique.mockResolvedValue({
      id: 'admin-1',
      email: 'removed@example.invalid',
      name: null,
      image: null,
      passwordHash: hash,
    });

    await expect(
      authorizeCredentials(
        { email: 'removed@example.invalid', password: 'the real password here' },
        req
      )
    ).rejects.toThrow('Incorrect email or password.');
  });

  it('rejects a malformed address before touching the database', async () => {
    await expect(
      authorizeCredentials({ email: 'not-an-email', password: 'x'.repeat(20) }, req)
    ).rejects.toThrow('Incorrect email or password.');

    expect(prismaMock.adminUser.findUnique).not.toHaveBeenCalled();
  });

  it('records every failure', async () => {
    prismaMock.adminUser.findUnique.mockResolvedValue(null);

    await authorizeCredentials({ email: 'nobody@example.invalid', password: 'any password here' }, req)
      .catch(() => {});

    expect(prismaMock.auditLog.create).toHaveBeenCalledOnce();
    const row = prismaMock.auditLog.create.mock.calls[0][0].data;
    expect(row.action).toBe('login_failed');
    // The attempted password must never appear anywhere in the log.
    expect(JSON.stringify(row)).not.toContain('any password here');
  });

  it('never records an unrecognised address', async () => {
    prismaMock.adminUser.findUnique.mockResolvedValue(null);

    await authorizeCredentials({ email: 'guessed@example.invalid', password: 'any password here' }, req)
      .catch(() => {});

    // An audit log full of guessed addresses is a liability, not a record.
    const row = prismaMock.auditLog.create.mock.calls[0][0].data;
    expect(JSON.stringify(row)).not.toContain('guessed@example.invalid');
  });
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

describe('rate limiting', () => {
  it('permits an attempt when there are no recent failures', async () => {
    prismaMock.auditLog.count.mockResolvedValue(0);
    expect((await loginRateLimitStatus({ accountId: 'admin-1', ip: '1.2.3.4' })).limited).toBe(false);
  });

  it('trips on the per-account threshold', async () => {
    prismaMock.auditLog.count.mockResolvedValue(RATE_LIMIT.MAX_FAILURES_PER_ACCOUNT);

    const status = await loginRateLimitStatus({ accountId: 'admin-1', ip: '1.2.3.4' });

    expect(status.limited).toBe(true);
    // The message says how long, because "try again later" with no number
    // invites an immediate retry and the conclusion that it is broken.
    expect(status.message).toContain(String(RATE_LIMIT.WINDOW_MINUTES));
  });

  it('blocks a credentials attempt once the limit is reached', async () => {
    prismaMock.auditLog.count.mockResolvedValue(RATE_LIMIT.MAX_FAILURES_PER_ACCOUNT);
    prismaMock.adminUser.findUnique.mockResolvedValue({
      id: 'admin-1',
      email: ALLOWED,
      name: null,
      image: null,
      passwordHash: await hashPassword('the real password here'),
    });

    // Even the *correct* password is refused while the limit holds — otherwise
    // the limit would only slow down an attacker who never guesses right.
    await expect(
      authorizeCredentials(
        { email: ALLOWED, password: 'the real password here' },
        { headers: {}, socket: { remoteAddress: '1.2.3.4' } }
      )
    ).rejects.toThrow(/too many failed sign-in attempts/i);
  });

  it('counts only failures inside the window', async () => {
    await loginRateLimitStatus({ accountId: 'admin-1', ip: '1.2.3.4' });

    const where = prismaMock.auditLog.count.mock.calls[0][0].where;
    expect(where.action).toBe('login_failed');
    expect(where.createdAt.gte).toBeInstanceOf(Date);
    expect(Date.now() - where.createdAt.gte.getTime()).toBeCloseTo(
      RATE_LIMIT.WINDOW_MINUTES * 60 * 1000,
      -3
    );
  });
});

// ---------------------------------------------------------------------------
// Session and cookies
// ---------------------------------------------------------------------------

describe('session shape', () => {
  it('exposes our own account id, not the provider subject', async () => {
    const session = await authOptions.callbacks.session({
      session: {},
      token: { adminUserId: 'admin-1', email: ALLOWED, name: 'Samiul', role: 'ADMIN' },
    });

    expect(session.user.id).toBe('admin-1');
    expect(session.user.email).toBe(ALLOWED);
  });

  it('exposes nothing beyond the known fields', async () => {
    const session = await authOptions.callbacks.session({
      session: {},
      token: {
        adminUserId: 'admin-1',
        email: ALLOWED,
        passwordHash: 'should-never-appear',
        secretField: 'nor-this',
      },
    });

    // The callback rebuilds `user` rather than spreading the token, so a field
    // added to the token cannot leak to the client by default.
    expect(Object.keys(session.user).sort()).toEqual(['email', 'id', 'image', 'name', 'role']);
    expect(JSON.stringify(session)).not.toContain('should-never-appear');
    expect(JSON.stringify(session)).not.toContain('nor-this');
  });

  it('resolves the account id by email on sign-in', async () => {
    prismaMock.adminUser.findUnique.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' });

    const token = await authOptions.callbacks.jwt({ token: {}, user: { email: ALLOWED } });

    expect(token.adminUserId).toBe('admin-1');
    expect(token.role).toBe('ADMIN');
  });

  it('leaves the token alone on subsequent requests', async () => {
    const token = await authOptions.callbacks.jwt({ token: { adminUserId: 'admin-1' } });

    expect(token).toEqual({ adminUserId: 'admin-1' });
    expect(prismaMock.adminUser.findUnique).not.toHaveBeenCalled();
  });
});

describe('session cookie', () => {
  const cookie = () => authOptions.cookies.sessionToken.options;

  it('is httpOnly, so no script on the page can read it', () => {
    expect(cookie().httpOnly).toBe(true);
  });

  it('is SameSite=Lax, so another site cannot make authenticated requests', () => {
    // Lax rather than Strict: Strict would drop the cookie on the top-level
    // redirect back from Google, breaking OAuth sign-in entirely.
    expect(cookie().sameSite).toBe('lax');
  });

  it('is scoped to the whole site', () => {
    expect(cookie().path).toBe('/');
  });

  it('is not Secure on http://localhost, and the name matches', () => {
    // Secure on plain http means the browser silently discards the cookie:
    // sign-in appears to succeed and then does not work. The test env sets
    // NEXTAUTH_URL to http://localhost:3000.
    expect(cookie().secure).toBe(false);
    expect(authOptions.cookies.sessionToken.name).toBe('next-auth.session-token');
  });

  it('becomes Secure with the __Secure- prefix over https', async () => {
    // Re-imported with a different NEXTAUTH_URL, because the flag is computed at
    // module load — which is the behaviour worth pinning, since getting it from
    // NODE_ENV instead would break local development.
    vi.resetModules();
    const previous = process.env.NEXTAUTH_URL;
    process.env.NEXTAUTH_URL = 'https://samkabir.com';

    const fresh = await import('@/lib/authOptions?https');

    expect(fresh.authOptions.cookies.sessionToken.options.secure).toBe(true);
    expect(fresh.authOptions.cookies.sessionToken.name).toBe('__Secure-next-auth.session-token');

    process.env.NEXTAUTH_URL = previous;
  });
});

describe('session strategy', () => {
  it('uses JWTs with a bounded lifetime', () => {
    expect(authOptions.session.strategy).toBe('jwt');
    expect(authOptions.session.maxAge).toBe(7 * 24 * 60 * 60);
  });

  it('has a secret', () => {
    expect(authOptions.secret).toBeTruthy();
  });

  it('sends sign-in errors to our own page rather than the default', () => {
    expect(authOptions.pages.signIn).toBe('/admin/login');
    expect(authOptions.pages.error).toBe('/admin/login');
  });
});

// ---------------------------------------------------------------------------
// Open redirect
// ---------------------------------------------------------------------------

describe('post-sign-in redirect target', () => {
  it('keeps a legitimate admin path', () => {
    for (const path of ['/admin', '/admin/blog', '/admin/blog/new', '/admin?tab=1']) {
      expect(safeReturnPath(path)).toBe(path);
    }
  });

  it('refuses to send the user to another origin', () => {
    for (const hostile of [
      'https://evil.example',
      'http://evil.example/admin',
      '//evil.example',
      '//evil.example/admin',
      '/\\evil.example',
      '\\\\evil.example',
      'javascript:alert(1)',
      '/adminsomething-else',
      '/not-admin',
      '',
      null,
      undefined,
      42,
    ]) {
      expect(safeReturnPath(hostile), String(hostile)).toBe(DEFAULT_RETURN_PATH);
    }
  });

  it('refuses a path carrying a newline that could split a header', () => {
    expect(safeReturnPath('/admin\nLocation: https://evil.example')).toBe(DEFAULT_RETURN_PATH);
    expect(safeReturnPath('/admin\r\nSet-Cookie: x=1')).toBe(DEFAULT_RETURN_PATH);
  });
});
