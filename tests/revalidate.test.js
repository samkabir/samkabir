import { describe, expect, it, vi } from 'vitest';

import { REVALIDATE_PATHS, revalidatePublicPages } from '../lib/revalidate.js';

/**
 * The contract that matters here is not "does it revalidate" — Next.js owns that.
 * It is **that a revalidation failure cannot break a save**.
 *
 * Every call site runs after a database transaction has already committed. If this
 * function throws, the API returns an error for a write that succeeded, and the
 * obvious reaction — pressing save again — writes the same thing twice. So the
 * tests below are mostly about what happens when things go wrong.
 */
describe('revalidatePublicPages', () => {
  it('revalidates every public path', async () => {
    const revalidate = vi.fn().mockResolvedValue(undefined);

    const result = await revalidatePublicPages({ revalidate });

    expect(revalidate).toHaveBeenCalledTimes(REVALIDATE_PATHS.length);
    for (const path of REVALIDATE_PATHS) {
      expect(revalidate).toHaveBeenCalledWith(path);
    }
    expect(result).toEqual({ ok: true, revalidated: [...REVALIDATE_PATHS], failed: [] });
  });

  it('includes the home page, which is the whole point', () => {
    // A guard against the list being emptied or renamed during a refactor: every
    // section of the site lives on `/`, so losing it would silently stop all
    // on-demand revalidation while leaving the code that calls this intact.
    expect(REVALIDATE_PATHS).toContain('/');
  });

  it('does not throw when a path fails', async () => {
    const revalidate = vi.fn().mockRejectedValue(new Error('ISR is having a moment'));

    const result = await revalidatePublicPages({ revalidate }, ['/']);

    expect(result.ok).toBe(false);
    expect(result.revalidated).toEqual([]);
    expect(result.failed).toEqual([{ path: '/', message: 'ISR is having a moment' }]);
  });

  it('keeps going after one path fails, rather than abandoning the rest', async () => {
    const revalidate = vi
      .fn()
      .mockRejectedValueOnce(new Error('nope'))
      .mockResolvedValueOnce(undefined);

    const result = await revalidatePublicPages({ revalidate }, ['/first', '/second']);

    expect(revalidate).toHaveBeenCalledTimes(2);
    expect(result.revalidated).toEqual(['/second']);
    expect(result.failed).toHaveLength(1);
    expect(result.ok).toBe(false);
  });

  it('reports rather than throws when the response cannot revalidate', async () => {
    // Reachable in a unit test, and in any runtime that does not implement
    // `res.revalidate`. Throwing would turn a successful save into a 500 for a
    // reason that has nothing to do with the save.
    for (const res of [{}, null, undefined, { revalidate: 'not a function' }]) {
      const result = await revalidatePublicPages(res);

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('unsupported');
      expect(result.revalidated).toEqual([]);
    }
  });

  it('accepts an explicit path list, so a caller can narrow it', async () => {
    const revalidate = vi.fn().mockResolvedValue(undefined);

    await revalidatePublicPages({ revalidate }, ['/only-this']);

    expect(revalidate).toHaveBeenCalledExactlyOnceWith('/only-this');
  });
});
