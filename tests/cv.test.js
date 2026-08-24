import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = { resume: { findFirst: vi.fn() } };
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock, default: prismaMock }));

const { default: cv } = await import('@/pages/api/cv');

function mockResponse() {
  const res = {
    statusCode: null,
    headers: {},
    body: undefined,
    redirectedTo: null,
    setHeader(name, value) {
      res.headers[name.toLowerCase()] = value;
      return res;
    },
    getHeader(name) {
      return res.headers[name.toLowerCase()];
    },
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(payload) {
      res.body = payload;
      return res;
    },
    redirect(code, url) {
      res.statusCode = code;
      res.redirectedTo = url;
      return res;
    },
  };
  return res;
}

const invoke = async (method = 'GET') => {
  const res = mockResponse();
  await cv({ method, headers: {} }, res);
  return res;
};

beforeEach(() => vi.clearAllMocks());

/**
 * `/cv` is the one route under `pages/api` that is deliberately public, so it is
 * worth having tests that say so — otherwise a later "why is this not using
 * createHandler" refactor would 401 every visitor and look like a fix.
 */
describe('GET /cv', () => {
  it('redirects to the active resume file', async () => {
    prismaMock.resume.findFirst.mockResolvedValue({
      media: { url: 'https://blob.example/documents/2026-08/abc.pdf' },
    });

    const res = await invoke();

    expect(res.statusCode).toBe(302);
    expect(res.redirectedTo).toBe('https://blob.example/documents/2026-08/abc.pdf');
  });

  it('asks only for the active one', async () => {
    prismaMock.resume.findFirst.mockResolvedValue({ media: { url: 'https://blob.example/a.pdf' } });
    await invoke();

    expect(prismaMock.resume.findFirst.mock.calls[0][0].where).toEqual({ isActive: true });
  });

  it('does not require authentication', async () => {
    // The assertion is the absence of a 401. This route being public is the
    // point of it — a CV link that only works when signed in is not a CV link.
    prismaMock.resume.findFirst.mockResolvedValue({ media: { url: 'https://blob.example/a.pdf' } });

    const res = await invoke();
    expect(res.statusCode).not.toBe(401);
  });

  it('uses 302, not 301', async () => {
    // A permanent redirect is cached indefinitely by browsers, which would pin
    // the link to whichever CV was active the first time it was clicked — and
    // there is no way to clear someone else's cache.
    prismaMock.resume.findFirst.mockResolvedValue({ media: { url: 'https://blob.example/a.pdf' } });

    expect((await invoke()).statusCode).toBe(302);
  });

  it('lets a CDN cache briefly but never the browser', async () => {
    prismaMock.resume.findFirst.mockResolvedValue({ media: { url: 'https://blob.example/a.pdf' } });

    const cacheControl = (await invoke()).getHeader('cache-control');

    expect(cacheControl).toContain('s-maxage=60');
    expect(cacheControl).toContain('max-age=0');
  });

  it('404s when no CV is published, without caching that', async () => {
    prismaMock.resume.findFirst.mockResolvedValue(null);

    const res = await invoke();

    expect(res.statusCode).toBe(404);
    expect(res.body.error.message).toMatch(/no cv/i);
    // Must stop being a 404 the instant a CV is activated.
    expect(res.getHeader('cache-control')).toBe('no-store');
  });

  it('404s when the row exists but its file is missing', async () => {
    prismaMock.resume.findFirst.mockResolvedValue({ media: null });
    expect((await invoke()).statusCode).toBe(404);
  });

  it('rejects a write method with 405 and an Allow header', async () => {
    const res = await invoke('POST');

    expect(res.statusCode).toBe(405);
    expect(res.getHeader('allow')).toBe('GET, HEAD');
    expect(prismaMock.resume.findFirst).not.toHaveBeenCalled();
  });

  it('allows HEAD', async () => {
    prismaMock.resume.findFirst.mockResolvedValue({ media: { url: 'https://blob.example/a.pdf' } });
    expect((await invoke('HEAD')).statusCode).toBe(302);
  });
});
