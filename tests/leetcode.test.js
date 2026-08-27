import { describe, expect, it, vi } from 'vitest';

import {
  fetchLeetCodeStats,
  LeetCodeError,
  LEETCODE_USERNAME,
  leetcodeProfileUrl,
  summarise,
} from '@/lib/leetcode';

/**
 * The LeetCode proxy.
 *
 * `fetchImpl` is injected in every test here, so the suite never touches the
 * network. A test that really called LeetCode would fail on a train, fail in CI
 * behind a firewall, and pass while the code was broken whenever LeetCode
 * happened to be generous — which is the opposite of what a test is for.
 *
 * This exists because the previous implementation had no tests and no error
 * handling, so when the upstream service was retired the number simply stopped
 * rendering and nothing anywhere said why.
 */
const payloadFor = (counts, ranking = 1062143) => ({
  data: {
    matchedUser: {
      username: 'Greeed',
      submitStatsGlobal: {
        acSubmissionNum: counts,
      },
      profile: { ranking },
    },
  },
});

const REAL_SHAPE = [
  { difficulty: 'All', count: 160 },
  { difficulty: 'Easy', count: 150 },
  { difficulty: 'Medium', count: 10 },
  { difficulty: 'Hard', count: 0 },
];

describe('summarise', () => {
  it('reads the four counts', () => {
    expect(summarise(payloadFor(REAL_SHAPE))).toEqual({
      username: 'Greeed',
      totalSolved: 160,
      easySolved: 150,
      mediumSolved: 10,
      hardSolved: 0,
      ranking: 1062143,
    });
  });

  it('looks each count up by name, not by position', () => {
    // The list's order is not guaranteed. Indexing by position works today and
    // silently reports the Easy count as the total the day LeetCode reorders it.
    const shuffled = [...REAL_SHAPE].reverse();

    expect(summarise(payloadFor(shuffled)).totalSolved).toBe(160);
    expect(summarise(payloadFor(shuffled)).easySolved).toBe(150);
  });

  it('reports zero for a difficulty LeetCode omitted', () => {
    expect(summarise(payloadFor([{ difficulty: 'All', count: 3 }])).hardSolved).toBe(0);
  });

  it('treats an unknown username as a 404, not a server error', () => {
    // A username that does not exist comes back as `matchedUser: null` with no
    // GraphQL error — the query was valid, it just matched nobody.
    const problem = (() => {
      try {
        summarise({ data: { matchedUser: null } });
      } catch (error) {
        return error;
      }
      return null;
    })();

    expect(problem).toBeInstanceOf(LeetCodeError);
    expect(problem.status).toBe(404);
  });

  it('surfaces a GraphQL error rather than reading past it', () => {
    expect(() => summarise({ errors: [{ message: 'Bad query' }] })).toThrow(/Bad query/);
  });

  it('does not mistake an empty payload for zero solved problems', () => {
    // Reporting 0 would be worse than reporting a failure: the site would render
    // a confident, wrong number.
    expect(() => summarise({})).toThrow(LeetCodeError);
    expect(() => summarise(null)).toThrow(LeetCodeError);
  });
});

describe('fetchLeetCodeStats', () => {
  const ok = (payload) =>
    vi.fn(async () => ({ ok: true, status: 200, json: async () => payload }));

  it('asks LeetCode for the configured user', async () => {
    const fetchImpl = ok(payloadFor(REAL_SHAPE));

    await fetchLeetCodeStats(LEETCODE_USERNAME, { fetchImpl });

    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://leetcode.com/graphql');
    expect(JSON.parse(options.body).variables).toEqual({ username: LEETCODE_USERNAME });
  });

  it('sends a referer, which the endpoint requires', async () => {
    // Without one LeetCode answers 403 — discovered the hard way, so it is
    // asserted rather than left as a line nobody dares delete.
    const fetchImpl = ok(payloadFor(REAL_SHAPE));

    await fetchLeetCodeStats('Greeed', { fetchImpl });

    expect(fetchImpl.mock.calls[0][1].headers.referer).toBe('https://leetcode.com');
  });

  it('gives up rather than hanging', async () => {
    // A slow upstream would otherwise hold a serverless function open until the
    // platform kills it, while the visitor waits on a decorative number.
    const fetchImpl = ok(payloadFor(REAL_SHAPE));

    await fetchLeetCodeStats('Greeed', { fetchImpl });

    expect(fetchImpl.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('turns an unreachable host into a LeetCodeError', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });

    await expect(fetchLeetCodeStats('Greeed', { fetchImpl })).rejects.toBeInstanceOf(LeetCodeError);
  });

  it('turns a non-200 into a LeetCodeError carrying the status', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }));

    await expect(fetchLeetCodeStats('Greeed', { fetchImpl })).rejects.toThrow(/503/);
  });

  it('survives a response that is not JSON', async () => {
    // Which is exactly what the retired Heroku app returned: an HTML error page.
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token <');
      },
    }));

    await expect(fetchLeetCodeStats('Greeed', { fetchImpl })).rejects.toThrow(/not JSON/);
  });
});

describe('leetcodeProfileUrl', () => {
  it('is built from the same constant the API route uses', () => {
    // One source for the username. Phase 1 fixed a live bug of exactly this
    // shape: two links displaying one address and pointing at another.
    expect(leetcodeProfileUrl()).toBe(`https://leetcode.com/${LEETCODE_USERNAME}/`);
  });
});
