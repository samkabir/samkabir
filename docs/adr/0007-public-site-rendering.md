# 0007 — Public site rendering: static generation with on-demand revalidation

**Phase:** 7
**Status:** accepted

## Context

Phase 7 moved the public site from static `data/*.js` imports to the database. The
question was how to render pages that now depend on Postgres without either
reintroducing a client-side loading spinner (the state the home page was rescued
from) or serving content that goes stale the moment the owner edits it.

## Decision

Public pages are **statically generated** with `getStaticProps` and
`revalidate: 60`, and **every admin mutation rebuilds the affected pages on
demand** through `lib/revalidate.js`. Blog posts additionally use `getStaticPaths`
with `fallback: 'blocking'`, so a post published after the last build renders on
first request rather than 404ing until a deploy. All public reads go through one
module, `lib/content.js`, which filters `status: 'PUBLISHED'`, keeps ordering in
step with the dashboard, and lets no `Date` or `undefined` cross into props.

## Rejected alternatives

- **`getServerSideProps`.** A database hit on every request, no CDN caching, and
  slower pages — for content that changes a few times a week.
- **Client-side fetch.** This is exactly the loading-shell-then-content pattern
  Phase 7 removed: search engines index the shell, and the real content arrives
  after paint.
- **A long `revalidate` (an hour).** On-demand rebuilds are the primary mechanism;
  the timer is only the backstop for a rebuild that failed. An hour is a long time
  to serve a page the owner just corrected, and ISR only regenerates on request, so
  60 seconds costs almost nothing.

## Consequences

An edit is live on the next reload. The revalidate endpoint lives under
`/api/admin/` so it inherits `withAdmin` rather than being a public trigger. The
single read layer means `grep -c PUBLISHED` over `lib/content.js` is the
draft-leak audit.
