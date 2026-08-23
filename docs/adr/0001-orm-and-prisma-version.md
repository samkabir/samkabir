# ADR 0001 — Prisma as the ORM, pinned to v6

**Status:** accepted · **Date:** 2026-08-23 · **Phase:** 2

## Context

The portfolio needed a data layer over Neon Postgres. Two requirements from the
brief narrowed the field before any comparison: migrations must be versioned and
reproducible, and no unnecessary dependencies.

Installing `prisma@latest` resolved to **7.9.1**. That version turned out to
change the setup in ways that matter for this project specifically, so the
version became its own decision rather than an implementation detail.

## What Prisma 7 requires

Verified by running it, not by reading release notes:

```
error: The datasource property `url` is no longer supported in schema files.
       Move connection URLs for Migrate to `prisma.config.ts` and pass either
       `adapter` for a direct database connection or `accelerateUrl` ...
error: The datasource property `directUrl` is no longer supported in schema files.
```

Concretely, Prisma 7 requires:

- a **`prisma.config.ts`** file — TypeScript, in a project that contains no
  TypeScript and has no TS toolchain configured;
- **`dotenv`**, because the CLI no longer loads `.env` on its own;
- a **driver adapter** — `@prisma/adapter-pg` plus `pg`, or `@prisma/adapter-neon`
  plus `ws` — passed to the `PrismaClient` constructor;
- a client generated as **TypeScript** into a project directory, rather than a
  ready-to-require JavaScript client.

## Decision

Pin **Prisma 6.19.3** (`^6.19.3`, which cannot drift into 7.x).

## Consequences

What v6 gives us that v7 would have cost:

| | v6 | v7 |
|---|---|---|
| Packages | `prisma`, `@prisma/client` | those plus `dotenv`, `pg`, `@prisma/adapter-pg` |
| Config files | none | `prisma.config.ts` |
| TypeScript needed | no | yes |
| Pooled + direct URLs | `url` and `directUrl` in the datasource block | hand-wired in the config file |
| Generated client | JavaScript, requireable | TypeScript, needs compiling |

The pooled/direct split is the part that decided it. Neon hands out two
connection strings — pooled for the application, direct for migrations — and v6
expresses exactly that in three lines of schema. Under v7 the same arrangement
becomes a TypeScript config file plus an adapter, in a codebase where nothing
else is TypeScript and nothing else needs a config file.

Set against that, v7 offers a faster query compiler and no Rust engine binary.
Neither is a bottleneck for a portfolio that serves mostly static pages and
whose dashboard has one user.

## Cost of this decision

We start one major version behind, so an upgrade is owed eventually. It is a
contained one — a config file, an adapter, and the `url`/`directUrl` move — and
it is much cheaper to do *after* the CMS works than to pay for up front
alongside everything else in this project.

The upgrade becomes worth doing when the project gains TypeScript for its own
reasons, or when v6 stops receiving security patches. Neither is true today.

## Rejected alternatives

- **Prisma 7 now.** Rejected on dependency count and the TypeScript requirement.
  Same functionality, more moving parts.
- **Drizzle.** Lighter and TypeScript-first, which is the wrong fit for a JS
  codebase; its migration story is also less prescriptive than the brief wanted.
- **Raw SQL with `pg`.** Fewest dependencies, but hand-rolls migrations, types
  and query building. The schema file doubling as living documentation is worth
  more here than the dependency saved.
