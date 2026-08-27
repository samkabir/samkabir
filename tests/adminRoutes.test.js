import { describe, expect, it } from 'vitest';
import { invoke } from './helpers/http.js';

/**
 * The load-bearing test of Phase 3.
 *
 * Every admin route must refuse an unauthenticated request. The route list is
 * **discovered from the filesystem**, not enumerated here, and that is the whole
 * point: a hand-written list is exactly as good as whoever last remembered to
 * update it, and the failure mode is a new unguarded endpoint that no test
 * mentions. Globbing means adding a route file automatically adds it to this
 * suite, and a route that skips `createHandler` fails the moment it is created.
 *
 * `lib/auth.js` denies everything until Phase 4, so 401 is the expected answer
 * for every one of them right now. When real sessions arrive, these assertions
 * keep their meaning: an unauthenticated request still gets 401.
 */
const modules = import.meta.glob('../pages/api/admin/**/*.js');
const routePaths = Object.keys(modules).sort();

/**
 * Asks the route which methods it serves.
 *
 * Read from the `Allow` header rather than inferred from the filename, so the
 * probe below covers exactly what each route registers — no more, and crucially
 * no less. An earlier version of this test guessed the methods from the path and
 * asserted 401 for a POST that `media` does not implement; the route correctly
 * answered 405 and the test was wrong. Asking removes the guess, and means a
 * route that quietly gains a method gains a 401 assertion with it.
 */
async function methodsOf(handler) {
  const res = await invoke(handler, { method: 'OPTIONS' });
  return String(res.getHeader('allow') ?? '')
    .split(',')
    .map((method) => method.trim())
    .filter((method) => method && method !== 'OPTIONS' && method !== 'HEAD');
}

describe('admin route discovery', () => {
  it('finds every route file', () => {
    // A floor, not an exact count — the assertion is that globbing worked at
    // all. A typo in the glob would otherwise make the whole suite below pass
    // by testing nothing, which is the failure this guards against.
    expect(routePaths.length).toBeGreaterThanOrEqual(30);
  });

  it('exports a handler function from every route file', async () => {
    for (const file of routePaths) {
      const routeModule = await modules[file]();
      expect(typeof routeModule.default, `${file} default export`).toBe('function');
    }
  });
});

describe('every admin route denies unauthenticated requests', () => {
  for (const file of routePaths) {
    it(`${file.replace('../pages/api', '')} → 401 on every method it serves`, async () => {
      const { default: handler } = await modules[file]();
      const methods = await methodsOf(handler);

      expect(methods.length, `${file} registers no methods`).toBeGreaterThan(0);

      for (const method of methods) {
        const res = await invoke(handler, {
          method,
          body: method === 'GET' || method === 'DELETE' ? undefined : {},
          query: { id: 'clx0000000000000000000000' },
        });

        expect(res.statusCode, `${method} ${file}`).toBe(401);
        expect(res.body?.error?.message).toBeTruthy();
        // The 401 must come from the guard, before any field validation — an
        // empty body would otherwise produce 400, which would look like a pass
        // for the wrong reason and hide a missing check.
        expect(res.body?.error?.fields).toBeUndefined();
      }
    });
  }
});

describe('cache headers', () => {
  it('marks every admin response uncacheable', async () => {
    for (const file of routePaths) {
      const { default: handler } = await modules[file]();
      const res = await invoke(handler, { method: 'GET' });
      expect(res.getHeader('cache-control'), file).toContain('no-store');
    }
  });
});

describe('method allowlist', () => {
  it('rejects an unsupported method with 405 and an Allow header', async () => {
    const { default: handler } = await modules['../pages/api/admin/skills/index.js']();
    const res = await invoke(handler, { method: 'DELETE' });

    expect(res.statusCode).toBe(405);
    expect(res.getHeader('allow')).toContain('GET');
    expect(res.getHeader('allow')).toContain('POST');
  });

  it('answers OPTIONS without requiring auth', async () => {
    const { default: handler } = await modules['../pages/api/admin/skills/index.js']();
    const res = await invoke(handler, { method: 'OPTIONS' });

    expect(res.statusCode).toBe(204);
    expect(res.getHeader('allow')).toContain('OPTIONS');
  });

  it('does not register POST on media, which has no create route', async () => {
    const { default: handler } = await modules['../pages/api/admin/media/index.js']();
    const res = await invoke(handler, { method: 'POST', body: {} });

    expect(res.statusCode).toBe(405);
  });

  it('checks the method before the session, so 405 precedes 401', async () => {
    // Both orderings are defensible; this asserts the one the code implements so
    // that reordering the pipeline is a deliberate change with a failing test,
    // not an accident.
    const { default: handler } = await modules['../pages/api/admin/skills/reorder.js']();
    const res = await invoke(handler, { method: 'GET' });

    expect(res.statusCode).toBe(405);
  });
});
