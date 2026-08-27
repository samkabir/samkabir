import { getProfile } from '@/lib/content';
import {
  fetchLeetCodeStats,
  LeetCodeError,
  LEETCODE_USERNAME,
} from '@/lib/leetcode';

/**
 * `GET /api/leetcode` — the solved-problem count shown in the About section.
 *
 * Public and unauthenticated, like `/api/cv`, and written longhand rather than
 * with `createHandler` so that being public is a visible choice rather than a
 * missing import. `createHandler` applies `withAdmin` to everything it builds and
 * offers no way out, which is the property that makes it trustworthy — so a route
 * that must answer an anonymous visitor cannot use it.
 *
 * It exists because the browser cannot make this request itself. LeetCode's
 * GraphQL endpoint sends no `Access-Control-Allow-Origin`, so a `fetch` from the
 * page is blocked before it is sent; a server has no origin to check and is not
 * subject to the rule. The previous implementation avoided that by calling a
 * third-party mirror that added the header — and that mirror is now gone.
 *
 * The username comes from `Profile.leetcodeUsername`, so it is editable from the
 * dashboard without a deploy, and the constant in `lib/leetcode.js` is only the
 * fallback for a database with no profile row yet. Deliberately **not** taken
 * from the query string: a `?username=` parameter turns this into an open proxy
 * that anyone can point at any profile, using this deployment's bandwidth and IP
 * reputation, for a value the site renders in exactly one place.
 *
 * `Profile.showLeetcode` is honoured here as well as in the component. Hiding the
 * block client-side would leave this endpoint answering for a profile the owner
 * has chosen to stop publishing — a smaller version of the same mistake as
 * relying on a hidden route for authorisation.
 */
export default async function leetcode(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    res.status(405).json({ error: { message: `${req.method} is not allowed here.` } });
    return;
  }

  try {
    const profile = await getProfile();

    if (profile && profile.showLeetcode === false) {
      res.setHeader('Cache-Control', 'no-store');
      res.status(404).json({ error: { message: 'The LeetCode block is switched off.' } });
      return;
    }

    const stats = await fetchLeetCodeStats(profile?.leetcodeUsername || LEETCODE_USERNAME);

    /**
     * Cached hard, and at the edge rather than in the visitor's browser.
     *
     * A solved count changes a few times a month at most, so an hour of CDN cache
     * turns thousands of page views into one upstream request. `max-age=0` keeps
     * the visitor's own browser from holding a stale number after it changes, and
     * `stale-while-revalidate` means a LeetCode outage shows yesterday's count
     * instead of nothing.
     */
    res.setHeader(
      'Cache-Control',
      'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400'
    );

    res.status(200).json(stats);
  } catch (error) {
    const status = error instanceof LeetCodeError ? error.status : 502;

    // Never cached: the failure must stop being a failure the moment LeetCode
    // recovers, rather than an hour later.
    res.setHeader('Cache-Control', 'no-store');

    // Logged with detail, answered without it — the visitor gets a sentence, the
    // server log gets the cause.
    console.error('[leetcode] %d:', status, error);

    res.status(status).json({ error: { message: 'Could not load the LeetCode stats.' } });
  }
}
