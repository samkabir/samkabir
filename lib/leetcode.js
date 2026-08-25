/**
 * LeetCode solved-problem counts, read from LeetCode's own GraphQL endpoint.
 *
 * The site used to call `leetcode-stats-api.herokuapp.com` from the browser. That
 * service is gone — Heroku retired its free dynos in November 2022 — and a dead
 * host answers with an error page that carries no CORS headers, which is why the
 * browser reported a CORS failure rather than a 503. The CORS message was the
 * symptom; there was nothing behind the URL to allow access to.
 *
 * So the fix is not a CORS workaround. It is to stop depending on a third party
 * that mirrors data LeetCode already publishes, and ask LeetCode directly:
 *
 *   * **Server-side, so CORS does not apply at all.** Browsers enforce it;
 *     server-to-server requests do not have an origin to check.
 *   * **First-hand, so there is no mirror to go offline.** The previous outage
 *     was silent — the number simply stopped rendering, and nothing said why.
 *   * **Cached at the edge**, so a page view does not become a LeetCode request.
 *
 * This module holds the fetching and parsing and knows nothing about HTTP
 * responses, so it can be tested without a server — see `tests/leetcode.test.js`.
 */

export const LEETCODE_GRAPHQL = 'https://leetcode.com/graphql';

/**
 * Whose profile to read.
 *
 * One constant rather than a string in the API route and another in the link's
 * `href`. Phase 1 fixed a live bug of exactly that shape — two `mailto:` links
 * displaying one address and pointing at another — and Phase 7 replaces this
 * with `Profile.leetcodeUsername` so it becomes editable rather than hardcoded.
 */
export const LEETCODE_USERNAME = 'Greeed';

export const leetcodeProfileUrl = (username = LEETCODE_USERNAME) =>
  `https://leetcode.com/${username}/`;

/**
 * Only the counts and the ranking.
 *
 * Deliberately narrow: this is a public, unauthenticated query for data the
 * profile page already shows to anyone. Asking for more than the page renders
 * would be fetching someone's data because it is available rather than because
 * it is needed — even when that someone is the site's own author.
 */
const QUERY = `
  query userProblemsSolved($username: String!) {
    matchedUser(username: $username) {
      username
      submitStatsGlobal {
        acSubmissionNum {
          difficulty
          count
        }
      }
      profile {
        ranking
      }
    }
  }
`;

/** Raised when LeetCode answered, but not with usable data. */
export class LeetCodeError extends Error {
  constructor(message, { status = 502, cause } = {}) {
    super(message, { cause });
    this.name = 'LeetCodeError';
    this.status = status;
  }
}

/**
 * Turns the GraphQL payload into the four numbers the site renders.
 *
 * The counts arrive as a list of `{ difficulty, count }` rather than named
 * fields, and the list's order is not guaranteed, so each entry is looked up by
 * name. Indexing by position would work today and silently report Easy counts as
 * the total the day LeetCode reorders them.
 */
export function summarise(payload) {
  if (payload?.errors?.length) {
    throw new LeetCodeError(payload.errors[0]?.message ?? 'LeetCode rejected the query.');
  }

  const user = payload?.data?.matchedUser;

  if (!user) {
    // A username that does not exist comes back as `matchedUser: null` with no
    // error — the query was valid, it just matched nobody.
    throw new LeetCodeError('No LeetCode user by that name.', { status: 404 });
  }

  const counts = user.submitStatsGlobal?.acSubmissionNum ?? [];
  const countFor = (difficulty) =>
    counts.find((entry) => entry.difficulty === difficulty)?.count ?? 0;

  return {
    username: user.username ?? null,
    totalSolved: countFor('All'),
    easySolved: countFor('Easy'),
    mediumSolved: countFor('Medium'),
    hardSolved: countFor('Hard'),
    ranking: user.profile?.ranking ?? null,
  };
}

/**
 * Asks LeetCode for one user's counts.
 *
 * `fetchImpl` is injectable so the tests never touch the network — a suite that
 * silently depends on a third party is one that fails on a train.
 *
 * The timeout matters more than it looks. Without it a slow upstream holds a
 * serverless function open until the platform kills it, and the visitor's page
 * waits on a decorative number. Eight seconds is far longer than a healthy
 * response and far shorter than a hang.
 */
export async function fetchLeetCodeStats(
  username = LEETCODE_USERNAME,
  { fetchImpl = fetch, timeoutMs = 8000 } = {}
) {
  let response;

  try {
    response = await fetchImpl(LEETCODE_GRAPHQL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // LeetCode's GraphQL endpoint answers 403 to a request with no Referer.
        referer: 'https://leetcode.com',
      },
      body: JSON.stringify({ query: QUERY, variables: { username } }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new LeetCodeError('Could not reach LeetCode.', { cause: error });
  }

  if (!response.ok) {
    throw new LeetCodeError(`LeetCode answered ${response.status}.`);
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    throw new LeetCodeError('LeetCode sent something that was not JSON.', { cause: error });
  }

  return summarise(payload);
}
