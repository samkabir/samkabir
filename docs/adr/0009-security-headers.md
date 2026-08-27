# 0009 — Security headers, and the CSP that keeps `'unsafe-inline'`

**Phase:** 9
**Status:** accepted

## Context

Phase 9 is the deliberate-attack pass. The app had no security response headers at
all. A Content-Security-Policy was wanted, but the plan flagged the real obstacle:
a policy strict enough to be useful can break MUI's runtime-injected Emotion
styles, and the Pages Router ships an inline hydration bootstrap. The full threat
model is in [../security.md](../security.md); this record is the header decision.

## Decision

The headers are built by pure, dev/prod-aware functions in
`lib/securityHeaders.js` and applied through `next.config.mjs` — the config was
renamed from `next.config.js` (CommonJS) to `.mjs` so it could `import` the ES-module
builder. The base set (CSP, `X-Content-Type-Options`, `Referrer-Policy`,
`X-Frame-Options`, `Permissions-Policy`) is on every response; `X-Robots-Tag:
noindex` and `no-store` are layered onto `/admin/*` and `/api/admin/*`. HSTS and
`upgrade-insecure-requests` are production-only; `'unsafe-eval'` and the HMR
WebSocket are development-only.

The CSP **keeps `'unsafe-inline'` on `script-src` and `style-src`** and locks down
everything else: `default-src`/`base-uri`/`form-action`/`connect-src` to `'self'`,
`object-src` and `frame-ancestors` to `'none'`, and an image allowlist scoped to
the Blob store and Google's avatar host.

## Rejected alternatives

- **A nonce-based CSP.** It would have to thread a nonce through `_document`, every
  SSR render and every Emotion cache, and break invisibly the moment one path
  missed it — a large surface for a policy whose inline-script risk is already
  covered by the sanitiser (ADR 0008) and React escaping.
- **`Content-Security-Policy-Report-Only`.** Reporting without enforcing provides
  no protection, and there is no endpoint to collect the reports.
- **An edge rate limiter in `middleware.js`.** Login — the one thing worth
  throttling — is already limited via the audit log (`lib/rateLimit.js`), which
  survives serverless cold starts. A per-instance in-memory limiter would be weaker
  and would front endpoints that are already static or already guarded.

## Consequences

The honest limitation, stated in `security.md`: with `'unsafe-inline'`, CSP is not
what stops an injected inline script — the sanitiser and React escaping are — but
`connect-src 'self'` closes the exfiltration path and `frame-ancestors 'none'`
closes clickjacking. `tests/securityHeaders.test.js` pins the contract. Writing
this pass also surfaced and fixed a real leak: `getPostNeighbours` was dropping its
`publishedAt <= now` bound and could offer a scheduled post as a neighbour link
(`tests/draftVisibility.test.js`).
