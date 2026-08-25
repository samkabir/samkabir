import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api, ApiError, queryString, setSessionLostHandler } from '@/lib/adminClient';
import { loginUrlFor, safeReturnPath } from '@/lib/returnPath';

/**
 * The dashboard's HTTP client.
 *
 * Worth testing rather than trusting because every one of these behaviours was a
 * bug in some earlier hand-written `fetch` somewhere: an error envelope read as
 * `statusText`, a session cookie left off a request, a 401 reported as "Bad
 * Request", an aborted search treated as a failure.
 */
function respondWith({ status = 200, body = null, text = null } = {}) {
  return vi.fn(async () => ({
    status,
    ok: status >= 200 && status < 300,
    text: async () => (text !== null ? text : body === null ? '' : JSON.stringify(body)),
  }));
}

const originalFetch = globalThis.fetch;

beforeEach(() => setSessionLostHandler(null));

afterEach(() => {
  globalThis.fetch = originalFetch;
  setSessionLostHandler(null);
});

describe('a successful request', () => {
  it('returns the parsed body', async () => {
    globalThis.fetch = respondWith({ body: { items: [{ id: 'a' }], total: 1 } });

    await expect(api.get('/api/admin/skills')).resolves.toEqual({
      items: [{ id: 'a' }],
      total: 1,
    });
  });

  it('returns null for a 204, rather than failing to parse an empty body', async () => {
    // Every delete answers 204. `response.json()` on it throws.
    globalThis.fetch = respondWith({ status: 204 });

    await expect(api.del('/api/admin/skills/a')).resolves.toBe(null);
  });

  it('always sends the session cookie', async () => {
    // The session is an httpOnly cookie. Omitting this produces a 401 that looks
    // exactly like an expired session.
    globalThis.fetch = respondWith({ body: {} });

    await api.get('/api/admin/skills');

    expect(globalThis.fetch.mock.calls[0][1].credentials).toBe('same-origin');
  });

  it('declares JSON only when there is a body', async () => {
    globalThis.fetch = respondWith({ body: {} });

    await api.get('/api/admin/skills');
    expect(globalThis.fetch.mock.calls[0][1].headers).toBeUndefined();

    await api.patch('/api/admin/skills/a', { name: 'Go' });
    expect(globalThis.fetch.mock.calls[1][1].headers).toEqual({
      'content-type': 'application/json',
    });
    expect(globalThis.fetch.mock.calls[1][1].body).toBe('{"name":"Go"}');
  });

  it('sends an empty object for a POST with no body', async () => {
    // The publish and activate endpoints take a body; `createHandler` rejects a
    // non-object one before looking at any field.
    globalThis.fetch = respondWith({ body: {} });

    await api.post('/api/admin/resumes/a/activate');

    expect(globalThis.fetch.mock.calls[0][1].body).toBe('{}');
  });
});

describe('a rejected request', () => {
  it('carries the server’s sentence, not the status text', async () => {
    globalThis.fetch = respondWith({
      status: 409,
      body: { error: { message: 'That value is already used by another record.' } },
    });

    await expect(api.post('/api/admin/skills', {})).rejects.toThrow(
      'That value is already used by another record.'
    );
  });

  it('carries the field map, so a message can land beside its input', async () => {
    globalThis.fetch = respondWith({
      status: 400,
      body: { error: { message: 'Some fields need attention.', fields: { slug: 'Already taken.' } } },
    });

    const problem = await api.post('/api/admin/projects', {}).catch((error) => error);

    expect(problem).toBeInstanceOf(ApiError);
    expect(problem.status).toBe(400);
    expect(problem.fields).toEqual({ slug: 'Already taken.' });
    expect(problem.hasFieldErrors).toBe(true);
  });

  it('keeps the status, so a 409 can be told from a 400', async () => {
    // One means "someone else changed it, reload"; the other means "this form is
    // wrong, fix it". They deserve different responses from the screen.
    globalThis.fetch = respondWith({ status: 409, body: { error: { message: 'In use.' } } });

    const problem = await api.del('/api/admin/media/a').catch((error) => error);

    expect(problem.status).toBe(409);
    expect(problem.hasFieldErrors).toBe(false);
  });

  it('survives a response that is not JSON at all', async () => {
    // A proxy error page, or an HTML 500 from the platform. `response.json()`
    // would throw a SyntaxError whose message tells the user nothing.
    globalThis.fetch = respondWith({ status: 502, text: '<html>Bad gateway</html>' });

    const problem = await api.get('/api/admin/skills').catch((error) => error);

    expect(problem.message).toBe('The request failed (502).');
    expect(problem.status).toBe(502);
  });

  it('reports an unreachable server as a connection problem', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });

    await expect(api.get('/api/admin/skills')).rejects.toThrow(/Could not reach the server/);
  });

  it('rethrows an abort untouched', async () => {
    // An aborted request is a screen that unmounted or a search box whose earlier
    // keystroke no longer matters — not a failure to report.
    globalThis.fetch = vi.fn(async () => {
      throw Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' });
    });

    const problem = await api.get('/api/admin/skills').catch((error) => error);

    expect(problem.name).toBe('AbortError');
    expect(problem).not.toBeInstanceOf(ApiError);
  });
});

describe('a lost session', () => {
  it('tells the layout rather than each screen', async () => {
    globalThis.fetch = respondWith({ status: 401, body: { error: { message: 'You must be signed in.' } } });

    const onLost = vi.fn();
    setSessionLostHandler(onLost);

    const problem = await api.get('/api/admin/skills').catch((error) => error);

    expect(onLost).toHaveBeenCalledTimes(1);
    expect(problem.status).toBe(401);
  });

  it('still throws, so the caller stops', async () => {
    // Handling the 401 centrally must not make the request look like it
    // succeeded — a screen that carried on would render `undefined`.
    globalThis.fetch = respondWith({ status: 401, body: {} });
    setSessionLostHandler(() => {});

    await expect(api.get('/api/admin/skills')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('queryString', () => {
  it('drops empty values so a blank search box sends nothing', () => {
    expect(queryString({ q: '', status: 'DRAFT', take: 200 })).toBe('?status=DRAFT&take=200');
  });

  it('returns nothing at all when everything is empty', () => {
    // Which keeps the fetch key stable, so an empty search does not look like a
    // different request from no search.
    expect(queryString({ q: '', status: '' })).toBe('');
    expect(queryString()).toBe('');
  });

  it('encodes what needs encoding', () => {
    expect(queryString({ q: 'a b&c' })).toBe('?q=a+b%26c');
  });
});

describe('loginUrlFor', () => {
  it('carries the current path', () => {
    expect(loginUrlFor('/admin/projects')).toBe(
      `/admin/login?from=${encodeURIComponent('/admin/projects')}`
    );
  });

  it('does not send the login page back to itself', () => {
    expect(loginUrlFor('/admin/login')).toBe('/admin/login');
    expect(loginUrlFor('/admin/login?from=%2Fadmin')).toBe('/admin/login');
  });

  it('handles being given nothing', () => {
    expect(loginUrlFor(undefined)).toBe('/admin/login');
    expect(loginUrlFor('')).toBe('/admin/login');
  });

  it('produces a value safeReturnPath accepts, which is the whole contract', () => {
    // The two halves have to agree: this writes the `?from=` that the guard on
    // the other side later has to trust. A round trip that lost the path would
    // silently drop everyone on the Overview.
    for (const path of ['/admin', '/admin/projects', '/admin/blogs?status=DRAFT']) {
      const url = new URL(loginUrlFor(path), 'https://example.invalid');
      expect(safeReturnPath(url.searchParams.get('from'))).toBe(path);
    }
  });
});
