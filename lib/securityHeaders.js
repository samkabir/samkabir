/**
 * The security response headers, in one place so `next.config.mjs` can apply
 * them and a test can assert them.
 *
 * These are defence in depth, not the boundary — the boundary is `withAdmin` on
 * every `/api/admin/*` route (`lib/auth.js`). What these add is the layer that
 * matters when something *else* goes wrong: a header that stops the site being
 * framed, a content policy that blocks an injected script from phoning home, a
 * `noindex` that keeps the dashboard out of a search index even if a link to it
 * leaks.
 *
 * The set is split into two: `baseSecurityHeaders` on every response, and the
 * admin-only pair (`noindex`, `no-store`) layered on `/admin/*` and
 * `/api/admin/*`. Both are built from `dev` rather than read from `process.env`
 * here, so the caller decides the environment once and the builders stay pure and
 * testable.
 */

/**
 * The Content-Security-Policy, assembled from a directive map.
 *
 * ## Why `'unsafe-inline'` survives here, and why that is not the whole story
 *
 * A nonce-based policy is the stricter option, and it is not reachable on this
 * stack without a cost that buys nothing. This is the Pages Router, so hydration
 * ships inline `<script>` bootstrap, and MUI's Emotion injects `<style>` at
 * runtime — a nonce would have to be threaded through `_document`, every SSR
 * render and every Emotion cache, and the moment any one path misses it the page
 * breaks in a way that only shows in production. So `script-src` and `style-src`
 * keep `'unsafe-inline'`.
 *
 * That is a real limit worth naming: with `'unsafe-inline'`, CSP is not the thing
 * that stops an injected inline script. What stops that is the sanitiser on the
 * one place user markup is rendered (`components/Blog/BlogPostBody.js`, an
 * allowlist with no `dangerouslySetInnerHTML`) and React escaping everywhere
 * else. CSP's job here is the *rest* of the policy: no plugins (`object-src
 * 'none'`), no other origin can frame this (`frame-ancestors 'none'`), a script
 * that does run can only reach back to `'self'` (`connect-src`), and nothing can
 * rewrite the document base (`base-uri 'self'`). An exfiltration path is closed
 * even where an injection is not.
 *
 * ## The sources, and why each is on the list
 *
 *   * `img-src` allows the Blob store (project and post images) and Google's
 *     avatar host (the signed-in admin's picture). `data:` and `blob:` cover
 *     `next/image` placeholders and canvas-derived previews.
 *   * `font-src 'self'`, because `next/font` self-hosts Rubik at build — there is
 *     no Google Fonts request to allow, and allowing one would be widening the
 *     policy for a request that never happens.
 *   * `connect-src` is `'self'`. LeetCode is proxied server-side, Google sign-in
 *     is a top-level redirect, and NextAuth's client calls `/api/auth/*` on this
 *     origin — nothing fetches cross-origin.
 *
 * ## The two dev-only relaxations
 *
 * `'unsafe-eval'` and the `ws:` origin exist only so `next dev` works: React
 * Refresh evaluates modules and HMR talks over a WebSocket. Neither is emitted in
 * production, where they would be a standing weakness for a convenience that is
 * not running.
 */
export function contentSecurityPolicy({ dev = false } = {}) {
  const directives = {
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    'form-action': ["'self'"],
    'img-src': [
      "'self'",
      'data:',
      'blob:',
      'https://*.public.blob.vercel-storage.com',
      'https://*.googleusercontent.com',
    ],
    'font-src': ["'self'", 'data:'],
    'style-src': ["'self'", "'unsafe-inline'"],
    'script-src': ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])],
    'connect-src': ["'self'", ...(dev ? ['ws:'] : [])],
    // A production page should never be asked to load an http subresource; if one
    // slips in, upgrade it rather than mixed-content-blocking it. Omitted in dev,
    // where the origin itself is http://localhost.
    ...(dev ? {} : { 'upgrade-insecure-requests': [] }),
  };

  return Object.entries(directives)
    .map(([name, values]) => (values.length ? `${name} ${values.join(' ')}` : name))
    .join('; ');
}

/**
 * `Permissions-Policy`: switch off capabilities the site never uses.
 *
 * Denying by empty allowlist means even a script that runs cannot prompt for a
 * camera or read geolocation. `browsing-topics=()` opts out of the Topics API,
 * which is on by default in Chrome and has nothing to do with a portfolio.
 */
export const PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=(), browsing-topics=()';

/**
 * The headers every response carries.
 *
 * `Strict-Transport-Security` is production-only on purpose: sent over
 * `http://localhost` it would still be recorded by the browser and then force
 * https on localhost for the max-age, breaking `next dev` in a way that outlives
 * the session that caused it.
 */
export function baseSecurityHeaders({ dev = false } = {}) {
  return [
    { key: 'Content-Security-Policy', value: contentSecurityPolicy({ dev }) },
    // Stop MIME sniffing: a file the server labels as one type cannot be
    // reinterpreted as a script by the browser.
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    // Leak only the origin cross-site, never the full path or query.
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    // Belt-and-braces with `frame-ancestors 'none'`, for the older agents that
    // read this header and not CSP.
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Permissions-Policy', value: PERMISSIONS_POLICY },
    ...(dev
      ? []
      : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]),
  ];
}

/**
 * Layered onto admin routes only.
 *
 * `noindex` keeps the dashboard and its API out of every search index even if a
 * URL leaks — the login page is public, but nothing behind it should ever be
 * crawlable. `no-store` on the *pages* matches what `createHandler` already sets
 * on the API, so a shared proxy or the browser's back-forward cache cannot hold a
 * rendered admin screen after sign-out.
 */
export const ADMIN_HEADERS = [
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
  { key: 'Cache-Control', value: 'no-store, max-age=0, must-revalidate' },
];
