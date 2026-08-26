# Architecture

How the system is put together, and the conventions that keep it consistent. This
is the "why it is shaped this way" companion to the [ADRs](adr/), which record the
decisions one at a time with their rejected alternatives.

## The two halves

The site is one Next.js app with two audiences:

- **The public site** — statically generated pages that read from Postgres at
  build/revalidate time through a single module, `lib/content.js`.
- **The dashboard** — client-rendered screens under `/admin` that talk to a JSON
  API under `/api/admin/*`.

They never share a read path. Public pages read through `lib/content.js`; the
dashboard reads through the API. Content is never embedded in a dashboard page's
HTML — the screens fetch after they mount — so a page's source is never a place a
draft can leak.

## Rendering and freshness

Public pages use `getStaticProps` with `revalidate: 60`, and **each admin
mutation rebuilds the affected page on demand** (`lib/revalidate.js`, wired into
every resource). So an edit is live on the next reload, and the 60-second timer is
only the backstop for a revalidation that failed — which is why it is short rather
than an hour. Blog posts additionally use `getStaticPaths` with
`fallback: 'blocking'`, so a post published after the last build is built on first
request rather than 404ing until a deploy.

`lib/content.js` guarantees four things, each easy to get wrong once per page
instead of once per module:

1. Every query filters `status: 'PUBLISHED'` (and, for posts, `publishedAt <= now`).
2. Ordering matches the dashboard, so drag-to-reorder cannot lie about what a
   visitor sees.
3. No `Date` and no `undefined` crosses into props — `getStaticProps` refuses
   both; dates become display strings there, once.
4. It is never imported by a client component, because it touches Prisma.

## Authentication — three gates

The full essays are in `lib/auth.js` and `lib/authOptions.js`; ADR 0004 has the
rationale. In short, authorisation is checked at three layers so no single one is
load-bearing:

1. **`proxy.js` (edge middleware).** Redirects anonymous visitors away from
   `/admin` to the login form. Inspects only the JWT — Prisma is unreachable on the
   edge — so it is a **convenience, not a boundary**. Deleting it would leave the
   dashboard rendering empty shells whose every request still 401s.
2. **`withAdminPage` (per page render).** Resolves the session server-side for
   each dashboard page via the same `getSessionUser` the API uses.
3. **`withAdmin` (per API request).** The gate that protects the data, built into
   `createHandler` so a route cannot forget it.

**`getSessionUser` re-checks `ADMIN_EMAILS` on every request**, not once at
sign-in — a JWT stays valid until it expires, so without the re-check, revoking an
address would take up to seven days. There is no registration endpoint: Google
sign-in *links* an already-existing admin account (matched by an allowlisted
address, which is server config a user cannot influence), and credentials sign-in
goes through a rate limiter backed by the audit log (`lib/rateLimit.js`) so it
survives serverless cold starts.

## The admin API

One pattern, applied to every entity, so list/read/create/update/delete cannot
drift apart. ADR 0003 covers it; the reference is [api.md](api.md).

- **`lib/api/handler.js` — `createHandler`.** The single entry point. Fixes the
  order *method allowlist → `withAdmin` → handler (Zod parse → Prisma)*, sets
  `Cache-Control: no-store`, and offers no escape hatch (`public: true` does not
  exist). A route file is three lines that mount a shared handler.
- **`lib/api/resource.js` — `defineResource`.** Builds the CRUD surface for one
  model from a config object: which schemas validate, what to include, what is
  orderable/publishable, and entity-specific hooks (`prepareCreate`,
  `prepareUpdate`, `onPublish`, `revalidatePaths`). Each mutation and its audit-log
  entry run in one transaction, so the log cannot claim a change the database did
  not keep.
- **`lib/api/resources/*`** — one small file per entity, holding only what is
  specific to it (slug resolution, tag-join replacement, résumé versioning).
- **Errors** go through one envelope, `{ error: { message, fields? } }`
  (`lib/api/errors.js`), so a rejected field lands next to its input in the form.
  An unclassified error becomes a generic 500 — internal detail never reaches the
  client.

Singletons (`Profile`, `SeoSettings`) use `defineSingleton` instead: a GET/PUT
pair over one row keyed `"singleton"`, because there is no collection to list.

## Validation

`lib/validation/*` holds Zod schemas, and they are the **same** modules the client
imports (`lib/adminForm.js` validates with them before submit). One source means a
client-side rejection and a server-side one produce the identical
`{ field: message }` shape and never disagree about whether a value is acceptable.
Schemas are `strictObject`, so an unknown key is rejected rather than silently
written — closing mass-assignment. `lib/validation/primitives.js` holds the shared
pieces (`slug`, `optionalText`, `publishStatus`, prototype-pollution stripping).

## The dashboard toolkit

The screens are data-driven rather than hand-built, which is why ten of them are a
few hundred lines each. ADR 0006 has the details, including the provider-placement
bug that shaped `adminScreen`.

- **`components/admin/EntityForm.js`** renders a form from a **field descriptor
  list** + a Zod schema, and handles the three request shapes (create = full POST,
  update = changed-fields PATCH, replace = full PUT).
- **`lib/adminForm.js`** is the *pure* form logic — `formValues` (row → form
  state), `toPayload` (form state → request body), `changedFields` (the PATCH
  diff), `validateWith`. Separated from the components so it is unit-tested without
  clicking. **Argument order matters:** `formValues(item, fields)`,
  `toPayload(values, fields)` — reversing them was a real Phase 8 bug.
- **`components/admin/useResource.js`** is the one hook every list screen uses:
  fetch, optimistic mutate, rollback, reorder, publish. `useSingleton` is its
  single-row sibling (used by the blog editor to load one post).
- **`components/admin/AdminLayout.js` — `adminScreen(Screen)`** wraps a page so the
  MUI theme and toast provider sit *above* it. Every admin page must use it, and a
  test asserts so; rendering the providers from inside a screen put them below the
  hooks that need them and threw on first render.
- **`lib/adminNav.js`** is the single nav list, and `tests/adminPages.test.js`
  checks every entry has a page file and every page is reachable.

## Data model

`prisma/schema.prisma` (ADR 0002). Conventions: PascalCase singular models mapped
to snake_case tables; `cuid()` string ids (URL-safe, no row-count leak); every
publicly rendered model carries `status PublishStatus` so one predicate guards
every public query; reorderable models carry an indexed `order`; everything has
`createdAt`/`updatedAt`. Media is a first-class model that files reference, which
is what lets `/cv` be a stable link to whichever `Resume` row is active and lets
`media:prune` find unreferenced files.

## Storage

All uploads go through `lib/storage.js` (Vercel Blob) and `lib/uploads.js`, which
types a file by its **magic bytes**, not its name or declared `Content-Type`, and
gives it a random key that never contains the filename. ADR 0005 covers the
byte-detection and the deletion-ordering subtlety (destroy the file *after* the row
is gone, or a rejected delete leaves a row pointing at nothing).

## Security

Response headers, the CSP tradeoff, content-visibility, and the full threat model
are in [security.md](security.md) and ADR 0009. The one-line version: defence in
depth around a boundary that is `withAdmin`, with the honest note that the CSP
keeps `'unsafe-inline'` and therefore leans on the sanitiser and React escaping for
XSS rather than on the policy.
