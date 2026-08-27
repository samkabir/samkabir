# ADR 0002 — Database schema decisions

**Status:** accepted · **Date:** 2026-08-23 · **Phase:** 2

Records the choices in `prisma/schema.prisma` that a reader could reasonably
have made differently. Mechanical details are commented in the schema itself;
this file covers the ones with a real trade-off behind them.

## 1. One `Experience` table, not two

`data/experience.js` and `data/contractualExperiences.js` were structurally
identical — same fields, same shapes — and `Experience.js` and
`ContractualExperiences.js` were near-duplicate components. Two tables would
have meant two forms, two endpoints, two validation schemas and two sets of bugs.

One table with `kind ExperienceKind` gives one of each, and lets a role be
reclassified by changing a field instead of moving a row between tables. The
public site still renders two sections; that is a query filter, not a schema
concern.

## 2. Real dates, not display strings

The old data stored `timeline: 'July 2025 - Present'`. That cannot be sorted,
filtered, or checked for overlap, and "Present" is a fact about today rather than
about the job.

`startDate` / `endDate` / `isCurrent` replace it, as `DATE` — a day is as precise
as an employment record needs, and a timestamp would drag timezones into a field
that has none. Ordering is computed from the dates.

`timelineOverride` is kept for the case where the generated label reads wrongly.
It affects display only; ordering always uses the dates. Without it the schema
would be strictly more correct and the site occasionally less accurate, which is
the wrong trade for a résumé.

## 3. `PublishStatus` everywhere, not a mix of enums and booleans

Every publicly rendered model carries `status PublishStatus`, including ones
where "draft" is a slightly odd word — social links, section headings.

The alternative was an enum for long-form content and `isPublished` booleans for
simple toggles, which reads more naturally per model. It was rejected because a
mixed convention is how a draft eventually leaks: one query filters
`isPublished: true`, another filters `status: 'PUBLISHED'`, a third forgets, and
nobody notices until an unfinished post is indexed. With one shape, the guard is
either present or conspicuously missing in review.

Cost: `DRAFT` means "hidden" on a social link, which needs the one-line
explanation the schema carries. Accepted.

`Profile` and `SeoSettings` have no status — they are singletons and always live.
`Resume` uses `isActive`, because exactly one CV is current and that is a
different question from whether a row is published.

## 4. `String[]` for bullet lists

`Experience.responsibilities` and `Project.stacks` are Postgres `text[]`, not
child tables.

They are never queried, never shared between rows, and only need reordering
inside a single form. A child table would add id management, a join on every
read, and an ordering column, for no gain. If a bullet ever needs tagging or
reuse across roles, that becomes a migration — and it is an easy one, because
nothing depends on the array's shape but the form.

## 5. `OAuthAccount` is ours, not `@next-auth/prisma-adapter`'s

The adapter creates a user row as part of the OAuth handshake. That is the wrong
order for this project: the brief requires that "an authenticated user cannot
simply register another account and gain access to the dashboard", so the email
allowlist has to be checked *before* anything is persisted, and a rejected
sign-in must leave no trace.

Phase 4 writes the `AdminUser` and `OAuthAccount` rows itself inside NextAuth's
`signIn` callback, after the allowlist passes. This drops a dependency and puts
the security-critical ordering in code we control and can test.

Cost: no `Session` or `VerificationToken` tables, so database-backed sessions and
email magic links would need work later. Neither is planned — sessions are JWTs,
and password recovery is a CLI operation by explicit decision.

## 6. Delete behaviour is stated, never inherited

Twelve foreign keys, three delete behaviours, each chosen for what happens on the
site when a row goes away:

- **`Cascade`** — `OAuthAccount` → `AdminUser`, and both sides of
  `BlogPostTag`. These rows are meaningless without their parent.
- **`Restrict`** — `Resume` → `Media`. A file cannot be deleted while a résumé
  points at it, because that leaves a dead download link on the live site.
- **`SetNull`** — every optional media reference, `BlogPost.authorId`,
  `Media.uploadedById`, `AuditLog.actorId`. Deleting an image must not delete the
  post that used it; deleting an admin account must not erase the blog, the
  uploads, or the audit trail.

`BlogPost.authorId` being nullable is the notable one: it means a post can exist
with no author, and the public byline falls back to `Profile.fullName`. That is
strictly better than the alternative, where removing an account silently deletes
everything it wrote.

`scripts/db-smoke.mjs` asserts each of these behaviours against a real database,
because delete semantics are easy to write down wrongly and only fail at runtime.

## 7. Singletons by convention

`Profile` and `SeoSettings` use `id String @id @default("singleton")` and are
always upserted on that value.

Postgres could enforce this with `CHECK (id = 'singleton')`, but a `CHECK`
constraint is not expressible in a Prisma schema, so it would live only in the
migration SQL — where Prisma's drift detection cannot account for it, and would
be liable to report the database as out of sync on a later `migrate dev`. Trading
a real constraint for a reliable migration workflow, in a system with one writer
and no public write path, is the right way round. The convention is enforced in
the data layer and asserted by the smoke test.

## 8. `Media` as rows, `AuditLog` at all

Uploads are rows rather than bare path strings so a file can be reused across
records, carry its own alt text and dimensions, and be traced to whoever uploaded
it. `pathname` is stored separately from `url` because deletion needs the
provider-side path, and parsing it back out of a CDN URL is brittle.

`AuditLog` is append-only and exists because a single admin editing production
content has no second pair of eyes. When a section goes blank, "what changed and
when" is the first question, and it is unanswerable after the fact if nothing was
recorded. The writer strips password hashes and tokens from the diff.

## 9. `snake_case` in the database, `camelCase` in the code

Every model and field is mapped. It is more typing in the schema and none
anywhere else: Prisma code stays idiomatic JavaScript, and the tables stay
readable in psql, Neon's SQL editor, and any backup dump — the places where
someone will be reading them without Prisma in front of them.

## 10. Ids are `cuid()`

Collision-resistant, roughly time-sortable, safe in URLs, and they do not
disclose row counts the way sequential integers do. The old files used
hand-maintained integer ids, which had already collided — two projects shared
`id: 1` — and had gaps from deleted entries.
