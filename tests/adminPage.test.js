import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The dashboard's server-side page guard, exercised directly.
 *
 * `tests/adminPages.test.js` proves every screen delegates to this function;
 * this file proves the function is worth delegating to. Split that way because
 * the pages are JSX in `.js` files and cannot be imported by the test runner —
 * see the note there.
 */

const getSessionUser = vi.fn();

vi.mock('@/lib/auth', () => ({
  getSessionUser: (...args) => getSessionUser(...args),
  withAdmin: (handler) => handler,
  requestIp: () => '127.0.0.1',
}));

const { withAdminPage, serialiseUser } = await import('@/lib/adminPage');
const { activeNavHref } = await import('@/lib/adminNav');

const ADMIN = {
  id: 'clx0000000000000000000000',
  email: 'admin@example.invalid',
  name: 'Sam',
  image: null,
  role: 'ADMIN',
  lastLoginAt: new Date('2026-08-25T09:30:00.000Z'),
};

const context = (resolvedUrl = '/admin/projects') => ({
  req: { headers: {} },
  res: { setHeader() {} },
  query: {},
  resolvedUrl,
});

beforeEach(() => vi.clearAllMocks());

describe('withAdminPage, signed out', () => {
  beforeEach(() => getSessionUser.mockResolvedValue(null));

  it('redirects to the login form', async () => {
    const result = await withAdminPage()(context());

    expect(result.redirect.destination).toMatch(/^\/admin\/login/);
  });

  it('is never a permanent redirect', async () => {
    // The answer changes the moment they sign in. A 308 would be cached by the
    // browser and keep redirecting afterwards, which is a dashboard that stays
    // broken until the user clears their cache.
    const result = await withAdminPage()(context());

    expect(result.redirect.permanent).toBe(false);
  });

  it('renders nothing — not even an empty shell', async () => {
    const result = await withAdminPage()(context());

    expect(result.props).toBeUndefined();
  });

  it('carries where they were going', async () => {
    const result = await withAdminPage()(context('/admin/projects'));

    expect(result.redirect.destination).toBe(
      `/admin/login?from=${encodeURIComponent('/admin/projects')}`
    );
  });

  it('does not add a return path for the dashboard root', async () => {
    // `/admin` is where a bare sign-in lands anyway, so the parameter would be
    // noise in the URL.
    const result = await withAdminPage()(context('/admin'));

    expect(result.redirect.destination).toBe(`/admin/login?from=${encodeURIComponent('/admin')}`);
  });

  it('never reaches the loader', async () => {
    // The loader is where a page queries the database. Running it for an
    // anonymous visitor would mean the redirect costs a query, and any mistake
    // in the loader would be reachable without a session.
    const loader = vi.fn();
    await withAdminPage(loader)(context());

    expect(loader).not.toHaveBeenCalled();
  });
});

describe('withAdminPage, signed in', () => {
  beforeEach(() => getSessionUser.mockResolvedValue(ADMIN));

  it('renders the page', async () => {
    const result = await withAdminPage()(context());

    expect(result.redirect).toBeUndefined();
    expect(result.props).toBeDefined();
  });

  it('passes the admin to the page', async () => {
    const result = await withAdminPage()(context());

    expect(result.props.adminUser.email).toBe(ADMIN.email);
  });

  it('gives the loader the resolved user', async () => {
    const loader = vi.fn(async () => ({ props: {} }));
    await withAdminPage(loader)(context());

    expect(loader).toHaveBeenCalledWith(expect.objectContaining({ user: ADMIN }));
  });

  it('merges the loader’s props with the admin', async () => {
    const loader = async () => ({ props: { counts: { skills: 3 } } });
    const result = await withAdminPage(loader)(context());

    expect(result.props.counts).toEqual({ skills: 3 });
    expect(result.props.adminUser).toBeDefined();
  });

  it('lets the loader redirect on its own terms', async () => {
    // A missing record, say. Merging props into that result would produce a
    // response with both a redirect and props, which Next rejects.
    const loader = async () => ({ redirect: { destination: '/admin', permanent: false } });
    const result = await withAdminPage(loader)(context());

    expect(result.redirect.destination).toBe('/admin');
    expect(result.props).toBeUndefined();
  });

  it('lets the loader 404', async () => {
    const loader = async () => ({ notFound: true });
    const result = await withAdminPage(loader)(context());

    expect(result.notFound).toBe(true);
    expect(result.props).toBeUndefined();
  });

  it('re-resolves the session on every render, not once at sign-in', async () => {
    await withAdminPage()(context());
    await withAdminPage()(context());

    // Which is what makes removing an address from ADMIN_EMAILS take effect
    // immediately rather than when the seven-day cookie expires.
    expect(getSessionUser).toHaveBeenCalledTimes(2);
  });
});

describe('serialiseUser', () => {
  it('turns the last sign-in into a string', () => {
    // Next cannot serialise a Date into props. The error names the field but not
    // the cause, and it only appears once an account has actually signed in
    // before — so the first person to see it is the user.
    expect(serialiseUser(ADMIN).lastLoginAt).toBe('2026-08-25T09:30:00.000Z');
  });

  it('handles an account that has never signed in', () => {
    expect(serialiseUser({ ...ADMIN, lastLoginAt: null }).lastLoginAt).toBe(null);
  });

  it('is an allowlist, not a spread', () => {
    // Props are rendered into the HTML the browser receives, so this is the last
    // place a sensitive column could leak into a page source. `getSessionUser`
    // already excludes the hash; this is the second line of the same defence.
    const serialised = serialiseUser({ ...ADMIN, passwordHash: '$2b$12$nope', secret: 'x' });

    expect(serialised).not.toHaveProperty('passwordHash');
    expect(serialised).not.toHaveProperty('secret');
    expect(Object.keys(serialised).sort()).toEqual([
      'email',
      'id',
      'image',
      'lastLoginAt',
      'name',
      'role',
    ]);
  });
});

describe('activeNavHref', () => {
  it('marks the dashboard root only on an exact match', () => {
    // As a prefix, `/admin` would light up on every screen — since every screen
    // is under it.
    expect(activeNavHref('/admin')).toBe('/admin');
    expect(activeNavHref('/admin/projects')).toBe('/admin/projects');
  });

  it('matches a screen by prefix, so a sub-route stays highlighted', () => {
    expect(activeNavHref('/admin/blogs/some-post')).toBe('/admin/blogs');
  });

  it('returns null for a path with no nav item', () => {
    expect(activeNavHref('/admin/login')).toBe(null);
    expect(activeNavHref(undefined)).toBe(null);
  });
});
