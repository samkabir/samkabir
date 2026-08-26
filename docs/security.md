# Security & threat model

This is the deliberate-attack pass (Phase 9): the properties the system is meant
to hold, how each one is enforced, and the test that would fail if it stopped
holding. It assumes the implementation is wrong until a test says otherwise.

The guiding principle throughout is that **hiding a route is not protecting it**.
Every control below is enforced at the point where the data actually is, not at
the door in front of it.

## What is being protected, and from whom

One asset matters: the ability to change what the site publishes. The site is a
single-admin CMS, so the threat model is small and specific:

- an anonymous visitor who should be able to read published content and nothing
  else — no drafts, no scheduled posts, no dashboard, no API;
- someone who tries to sign in as the admin without being the admin;
- an authenticated admin's browser being turned against them (XSS, clickjacking,
  CSRF);
- a malicious upload or payload reaching storage or the database.

Everything below maps to one of those.

## Access control — three gates, and why there are three

Authentication is layered so that no single check is load-bearing. The essays in
`lib/auth.js` and `lib/authOptions.js` are the source of truth; the summary:

1. **`proxy.js` (edge).** Redirects an anonymous visitor away from `/admin` to the
   login form. Inspects only the JWT, because Prisma is unreachable on the edge
   runtime. **This is a convenience, not a boundary** — it is stated as such in the
   file, because the opposite assumption is the mistake the brief calls out. If it
   were deleted, the dashboard would render empty shells and every request behind
   it would still 401.

2. **`withAdminPage` (per page render).** Resolves the session server-side for
   every dashboard page, through the same `getSessionUser` the API uses.

3. **`withAdmin` (per API request).** The gate that actually protects the data,
   because the data is not in the page — screens fetch it after they mount. Built
   into `createHandler`, which offers no `public: true` and no `skipAuth`: the
   only way to make an unguarded admin route is to not use the shared handler,
   which is visible in review rather than an omission that looks like every other
   route. `tests/adminRoutes.test.js` hits every admin route unauthenticated and
   asserts 401.

**The allowlist (`ADMIN_EMAILS`) is the primary access control**, and it is
re-checked on *every* request in `getSessionUser`, not once at sign-in. A JWT
session is self-contained and stays cryptographically valid until it expires, so
without the re-check, removing an address from the allowlist would have no effect
for up to seven days. With it, revocation is immediate — the cost is one indexed
primary-key lookup per admin request. Google sign-in additionally requires the
account to *already exist*: it links an identity, it does not create one, so an
authenticated stranger cannot register their way in. `tests/auth.test.js` covers
all three gates, the unverified-email rejection, and the "creates no account row
for a rejected sign-in" property.

Login is rate-limited by counting recent `login_failed` rows in the audit log
(`lib/rateLimit.js`) rather than an in-memory `Map`, which on serverless would
reset on every cold start and split across instances — a limit that only holds
under conditions production does not have.

## Response headers

Applied in `next.config.mjs` from the pure builders in `lib/securityHeaders.js`,
and asserted by `tests/securityHeaders.test.js`. The base set is on every
response; `noindex` + `no-store` are layered onto `/admin/*` and `/api/admin/*`.

| Header | Value | Purpose |
|---|---|---|
| `Content-Security-Policy` | see below | Restricts sources; closes exfiltration and framing |
| `X-Content-Type-Options` | `nosniff` | No MIME-sniffing a response into a script |
| `X-Frame-Options` | `DENY` | Clickjacking (with `frame-ancestors`) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | No path/query leak cross-site |
| `Strict-Transport-Security` | 2y, preload | HTTPS only — **production only** |
| `Permissions-Policy` | camera/mic/geo/topics off | Deny capabilities never used |
| `X-Robots-Tag` (admin) | `noindex, nofollow` | Dashboard out of every index |
| `Cache-Control` (admin) | `no-store` | No cached admin screen after sign-out |

**HSTS and `upgrade-insecure-requests` are production-only** by construction: sent
over `http://localhost` they would be remembered by the browser and force HTTPS on
localhost for two years, breaking `next dev` well past the session that set it. The
two dev conveniences (`'unsafe-eval'`, the HMR WebSocket) are the mirror image —
present only in development, never a standing weakness in production.

### The CSP, honestly

`script-src` and `style-src` keep `'unsafe-inline'`. This is the Pages Router, so
hydration ships an inline bootstrap script, and MUI's Emotion injects `<style>` at
runtime; a nonce would have to thread through `_document`, every SSR render and
every Emotion cache, and break invisibly the moment one path missed it.

So **CSP is not what stops an injected inline script here** — that is worth saying
plainly. What stops that is the sanitiser on the one place user markup is rendered
and React escaping everywhere else (below). What the CSP *does* do is everything
else: `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`,
`form-action 'self'`, and a `connect-src 'self'` that means even a script that
somehow ran could not phone home to another origin. The image allowlist is scoped
to exactly the Blob store and Google's avatar host; fonts are `'self'` because
`next/font` self-hosts, so there is no external font origin to allow.

## Content visibility — drafts and scheduled posts

An anonymous visitor must not be able to reach a draft, or a post scheduled for the
future, by any path: direct URL, listing, sitemap, or a prev/next neighbour link.
"No such post" and "that post is a draft" must be **indistinguishable**, because a
different response for each would confirm a slug exists, and slugs are guessable.

The rule lives in the `where` clause of every public query (`livePosts()` in
`lib/content.js`), never in a check on the result — a post-load `if` works until
someone adds an early return above it; a query that cannot return a draft has no
such failure mode. `tests/draftVisibility.test.js` proves this by running the real
content functions against a faithful in-memory Prisma stand-in, including the two
tricky rows: a `DRAFT` that still carries an old `publishedAt`, and a `PUBLISHED`
post dated in the future.

**A bug this pass found and fixed.** `getPostNeighbours` spread `livePosts()` and
then set `publishedAt: { gt: at }`, which *overwrote* the `lte: now` cap from the
spread — so a scheduled future post could surface as a "next" neighbour link, slug
and title, before its publication date. The constraints are now merged rather than
spread. This is exactly the class of leak the phase exists to find, and the
regression test now guards it.

## Uploads

`lib/uploads.js` decides file type from **magic bytes**, not the declared
`Content-Type` or the filename — a PDF renamed `.png` is rejected as a PDF, an HTML
document declared as an image is rejected as HTML, and SVG is refused outright
(it is a script-bearing format). Size is bounded below Vercel's request-body
limit. Storage keys are random and never contain the uploaded filename, so a
crafted name cannot steer where a file lands or collide with another. All asserted
in `tests/uploads.test.js`, including the security-relevant "PDF renamed as PNG".

## XSS, injection, and mass-assignment

- **Stored markup** (blog post bodies) is the main XSS vector, because the author
  is trusted but the output is public. It is rendered through `rehype-sanitize`
  with an explicit allowlist and **no `dangerouslySetInnerHTML`**
  (`components/Blog/BlogPostBody.js`); `tests/markdown.test.js` asserts a `<script>`
  is stripped rather than executed. The dashboard preview renders through the same
  component and sanitiser, so what the author previews is what publishes.
- **JSON-LD** is the one place a `<script>` tag is emitted, and it is serialised
  through `serialiseJsonLd` (which escapes `<`), not `JSON.stringify` — otherwise a
  post titled `</script>…` would break out of the tag. `tests/seo.test.js` is the
  regression test.
- **SQL injection** is not a live vector: every query goes through Prisma's
  parameterised client, never string concatenation. A title of `'; DROP TABLE …`
  is stored and rendered as the literal text it is.
- **Mass assignment** is closed by Zod `strictObject` schemas that reject unknown
  keys, and a prototype-pollution key (`__proto__`) is stripped without polluting
  anything. `tests/validation.test.js` covers the injection-shaped inputs — non-http
  URL schemes, markup and path traversal in slugs, and fields the form does not own.
- **CSRF** is mitigated by the `SameSite=Lax` session cookie, which stops another
  site making an authenticated request while still allowing the top-level redirect
  back from Google. The cookie is `httpOnly`, so no script on the page can read it.

## Secrets

`.env` and every `.env.*` variant are gitignored; only `.env.example` — names and
placeholders, no values — is committed. A scan of the **full git history**
(`git log -p --all`) for private keys, cloud access keys, OAuth secrets, Blob
tokens and credentialed connection strings found **no real secret** — only fake
example strings (`test:test@127.0.0.1` in CI config, and an illustrative Neon
connection string with a placeholder password that once lived in a setup guide and
was later removed). The rescan procedure is simply to repeat that command.

## Dependency audit

`npm audit` after `npm audit fix` (non-breaking):

- **Resolved:** three Next.js advisories (SSRF via rewrites, image-optimization
  DoS via SVG, Server-Function endpoint disclosure), plus `postcss` and `sharp`.
  Next is now 16.3.x. The SSRF-via-rewrites advisory did not apply in the first
  place — this app's only rewrite has a static destination (`/cv` → `/api/cv`),
  not an attacker-controlled hostname — but the update is taken regardless.
- **Accepted, documented risk:** three "high" advisories remain in the **Prisma
  CLI** chain (`prisma` → `@prisma/config` → `deepmerge-ts`, a stack-exhaustion
  DoS when merging recursive object graphs during config load). These are a
  build-time `devDependency` with no runtime or production exposure, and the only
  offered fix (`npm audit fix --force`) *downgrades* `prisma` to 6.12.0 — older
  than the 6.19 the schema and migrations target, and a functional regression.
  Not taken. Revisit when a forward fix ships.

## Out of scope / residual risks

- **A compromised admin account** is game over by design — this is a CMS whose
  whole purpose is that the admin can change the site. The mitigations are the
  allowlist re-check (immediate revocation), rate-limited login, and the audit log.
- **`x-forwarded-for` is trusted** for the audit trail and rate-limit key. It is
  client-forgeable in general; behind Vercel's proxy the first entry is the real
  peer. It is never an authorisation input, which is the only reason trusting it is
  acceptable.
- **CSP `'unsafe-inline'`**, as discussed — the residual risk is bounded by the
  sanitiser and React escaping, and the exfiltration path is closed by
  `connect-src 'self'`.
