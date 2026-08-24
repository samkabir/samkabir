# 0003 — Admin API: one handler pattern, guarded by construction

**Phase:** 3
**Status:** accepted

## Context

Phase 3 builds the protected CRUD surface for eleven entities: skills,
education, experiences, projects, social links, section copy, blog posts, tags,
résumés, media, plus two singletons (profile, SEO settings). That is roughly
forty endpoints.

The brief is explicit about two of them (Rules 8 and 9):

> Validate Everything — frontend **and** backend.
> Authorization Is Server-Side. Never assume hiding a dashboard route is
> sufficient security. An API request made directly outside the dashboard must
> still verify authorization.

Forty hand-written endpoints, each remembering to check a session, parse a body
and write an audit entry, is a setup for exactly one failure: the endpoint that
forgets. It will not be the one anybody reviews closely, and nothing about it
will look different from its neighbours.

## Decision

### 1. `createHandler` is the only way to build an admin route

Every route file is three lines: import a resource, export one of its handlers.
All behaviour lives in `lib/api/`.

`createHandler` applies, in a fixed order that is not configurable:

```
method allowlist  →  withAdmin  →  Zod parse  →  Prisma call
```

The important property is what it does **not** offer. There is no
`public: true`, no `skipAuth`, no per-method opt-out. `withAdmin` is applied to
every handler on the way through. Building an unguarded admin route requires
*not using* `createHandler` — which is a visible thing to do in review, rather
than an omission that looks like every other file.

### 2. The auth guard is written first, and denies everything

`lib/auth.js` returns `null` from `getSessionUser` until Phase 4. Every admin
route answers 401 today.

This is deliberate ordering. The routes are written against a guard that already
exists, so none of them is ever built in an open state and secured later. The
alternative — build the API, add auth in Phase 4 — means the entire surface
spends a phase in a state where the tests that should catch an unguarded route
cannot, because no route is guarded.

There is intentionally **no** development bypass: no `SKIP_AUTH`, no
`NODE_ENV === 'development'` shortcut. Every such flag is one deploy away from
being the reason the dashboard was open to the internet, and the tests would
pass locally while the real risk shipped.

### 3. Route coverage is discovered, not enumerated

`tests/adminRoutes.test.js` globs `pages/api/admin/**/*.js`, asks each route
which methods it serves via its own `Allow` header, and asserts 401 on every
one.

The plan called for "an enumerated list of every admin route". Globbing is
strictly better: a hand-written list is exactly as good as whoever last
remembered to update it, and the failure mode is a new unguarded endpoint that
no test mentions. Adding a route file adds it to the suite automatically.

Reading the methods from `Allow` rather than inferring them from the filename
was also not the first attempt. The first version guessed `['GET', 'POST']` for
every collection route and failed on `media`, which has no POST — the route was
right and the test was wrong. Asking removes the guess.

### 4. One resource factory, with hooks for real differences

`defineResource` produces list, read, create, update, delete, reorder and
publish for one entity. Entity-specific work goes in a hook
(`prepareCreate`, `prepareUpdate`, `beforeDelete`, `onPublish`), not a parallel
implementation.

So a fix to error handling, audit writing or transaction scope is a fix
everywhere, and eleven entities cannot drift apart in how they report a
validation failure.

Rejected: hand-writing each entity for "flexibility". The differences between
these entities are four hooks wide. The similarities are the entire request
lifecycle.

### 5. Every mutation and its audit entry share one transaction

`recordAudit` takes the transaction handle, so the log entry and the change it
describes commit or roll back together. A log that can disagree with the data is
worse than no log, because it is trusted.

Audit *write failures* are logged and swallowed rather than propagated. Losing
an audit row is bad; failing a user's save because the audit insert failed is
worse.

### 6. Reorder sends the whole list

`POST …/reorder` takes `{ ids: [...] }` in the new order, verifies every id
exists, then applies all positions in one transaction.

Rejected: one request per moved item. A drag-and-drop reorder changes many
positions at once, and applying them one request at a time leaves the list
visibly wrong if the third call fails. The existence pre-check matters too:
without it a stale id makes one `update` throw partway through, rolling back the
transaction and leaving the user looking at a list that silently refused to save.

### 7. Publish is its own endpoint

`POST …/[id]/publish` with `{ status }` rather than `PATCH { status }`, so the
audit action reads `publish` / `unpublish` instead of a generic `update`. "When
did this go live" is a question the log should answer directly.

### 8. Strict objects everywhere

Every schema is `z.strictObject`. Unknown keys are an error, not something to
drop silently.

The dashboard is the only client, so an unexpected key means either a bug or an
attempt to set a field the form does not own. The concrete cases: `readingMinutes`
(computed from the Markdown, so a client value could disagree with the content),
`authorId` (the signed-in user, or a post could be attributed to someone else),
`Resume.version` and `Resume.isActive` (assigned server-side, or two CVs could
be active at once), and — from Phase 4 — `role`.

### 9. Errors are classified, never echoed

One envelope: `{ error: { message, fields? } }`. `fields` maps a form input name
to its problem so the dashboard can render the message next to the input.

Anything not deliberately classified becomes a 500 with a fixed message, and the
detail goes to the server log. An unhandled Prisma error carries the database
host and the failing SQL; that belongs in a log, not a browser console.

Cases that a *valid* request can still hit are mapped to specific statuses, not
500s: a slug someone else took (409, naming the field), a row deleted in another
tab (404), a file still referenced by a live résumé (409). The RESTRICT case
needed a SQLSTATE fallback — Phase 2's smoke test saw Prisma surface one as an
unmapped connector error carrying the raw `23001`.

## Consequences

- Adding an entity is a validation schema, a resource definition and three route
  files. Nothing about auth, audit or error handling is retyped.
- Phase 4 replaces one function. No route changes.
- The route-coverage test fails on any new admin route until the route works,
  which is the intended friction.
- `Media` and `Tag` demonstrate the factory degrading correctly: no create
  schema means no POST is registered at all, and no `status` column means the
  list filter is not applied.

## What this cost

The factory is indirection: reading a route file tells you nothing about what it
does. That is a real downside for a newcomer, and the mitigation is that
`lib/api/handler.js` and `lib/api/resource.js` are two files carrying the whole
story, rather than forty files each carrying a fortieth of it.

## Bugs this phase caught

Two, both from the same cause and both invisible to the type-level checks:

**`Argument 'description' must not be null`.** The optional-text primitive
normalised every empty value to `null`, which is correct for a nullable column
and wrong for `Project.description` and `BlogPost.excerpt` — both
`String @default("")`, therefore NOT NULL. A perfectly valid create request
produced a 500 with no field to attach it to. Fixed with a distinct
`textOrEmpty` primitive; `''` is the only value that means "empty" both to the
column and to a PATCH, since `undefined` would read as "leave unchanged" and
silently fail to clear a field.

`tests/schemaAlignment.test.js` now reads `schema.prisma` and asserts the
general rule — a required column never receives null — for every entity, so a
new NOT NULL column wired to an optional validator fails in the suite rather
than in production.

**An empty PATCH body was accepted.** `partialOf` checked
`Object.keys(parsed).length`, but `.partial()` still applies `.default()`, so
`{}` came out with keys and passed. Every entity with a default was affected. The
check now runs against the raw body. Both were found by tests, not by reading
the code.
