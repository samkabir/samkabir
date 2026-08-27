# CLAUDE.md

Orientation for a future session working on this repository. Read this first; it
is the map, and it points at the deeper docs rather than repeating them.

## What this is

A personal portfolio site for Samiul Kabir that was a static Next.js site and is
now a **database-backed CMS**: the public pages render from Postgres, and a
private admin dashboard at `/admin` edits that content through a JSON API. The
owner is a beginner, so anything written for them (see `docs/content-management.md`)
is in plain language.

- **Stack:** Next.js 16 (Pages Router), React 18, Prisma 6 + Postgres (Neon),
  NextAuth 4 (JWT sessions), MUI + Emotion, Tailwind, Vercel Blob for files.
- **Hosting target:** Vercel (serverless). Prisma's `rhel-openssl-3.0.x` engine
  target is already declared for it.

## Status

Phases 1–9 are complete; this is Phase 10 (documentation). Phase 11 is deployment.
`Plan.md` is the authoritative phase log — each completed phase ends with a "what
was built" and a "deviations" section, and those deviations are load-bearing:
they record where the code intentionally diverged from the plan.

## Where things live

| Path | What |
|---|---|
| `pages/` | Routes. Public site + `/admin/*` screens + `/api/**` endpoints |
| `pages/api/admin/**` | The admin API — thin route files mounting shared handlers |
| `lib/content.js` | **The only** place the public site reads content from |
| `lib/api/` | The shared API machinery: `handler.js`, `resource.js`, `resources/*` |
| `lib/validation/` | Zod schemas — the same ones the client and server both use |
| `lib/auth.js`, `lib/authOptions.js` | The three authorisation gates |
| `components/` | Public sections + `components/admin/*` (the dashboard toolkit) |
| `prisma/schema.prisma` | The data model. One migration so far (`_init`) |
| `styles/globals.css` | The only stylesheet. There are no CSS modules |
| `docs/` | The documentation this file indexes |
| `Todo/` | Beginner-facing setup notes for the owner (guides done, folder kept for Phase 11) |

There is **no `data/` directory** — Phase 7 deleted the static content arrays after
seeding them into Postgres. `git log` has them if a value ever needs checking.

## Commands

```bash
npm run dev            # local dev server
npm run build          # production build
npm test               # vitest (run once); npm run test:watch to watch
npm run lint           # eslint

npm run db:migrate     # create/apply a migration in dev
npm run db:studio      # Prisma Studio
npm run db:seed        # populate an empty database (-- --include-nda, -- --reset)
npm run assets:import  # push repo images + CV into Blob (one-off)

npm run admin:create           # create the admin account (only way in)
npm run admin:reset-password   # recovery — there is no email reset flow
npm run media:prune            # find/remove unreferenced Blob files (-- --apply)
```

Every DB/script command runs through `scripts/with-env.mjs`, which loads `.env`
then `.env.local` — the Prisma CLI reads `.env`, Next reads both.

## The invariants — what must not be changed casually

These are the properties the system was built to hold. Each is enforced in one
place on purpose; breaking one is usually silent. The full reasoning is in
`docs/architecture.md` and `docs/security.md`.

1. **`lib/content.js` is the single public read layer.** Every query filters
   `status: 'PUBLISHED'`; drafts and future-dated posts are excluded in the
   `where` clause, never by a check on the result. It touches Prisma, so it is
   **never imported by a client component**. Adding a public read anywhere else
   is how a draft leaks.
2. **Every admin route goes through `createHandler`** (`lib/api/handler.js`),
   which applies `withAdmin` by construction. There is no `public: true` and no
   `skipAuth`. The only way to make an unguarded admin route is to not use the
   shared handler — a visible thing in review.
3. **`ADMIN_EMAILS` is the primary access control,** re-checked on *every* request
   in `getSessionUser`, not once at sign-in. Removing an address revokes access
   immediately. There is no registration path; Google sign-in *links* an existing
   account, it never creates one.
4. **Stored markdown is the main XSS vector.** The pipeline and its allowlist are
   in `lib/markdown.js`: `rehype-sanitize` with an explicit allowlist, `rehype-raw`
   deliberately absent (so raw HTML in a post is *text*, not markup), and **no
   `dangerouslySetInnerHTML`** in `components/Blog/BlogPostBody.js`. The dashboard
   preview uses the same component, so preview equals published.
5. **JSON-LD is serialised through `serialiseJsonLd`** (`lib/seo.js`), which
   escapes `<`, not `JSON.stringify` — a post title can otherwise break out of the
   `<script>` tag.
6. **Media deletion happens *after* the row is gone,** not before — see the essay
   in `lib/api/resource.js`. The reverse once deleted a live CV's file and kept
   the row.
7. **Uploads are typed by their bytes,** not the filename or `Content-Type`
   (`lib/uploads.js`).
8. **Each admin mutation rebuilds the affected public page** before responding
   (`lib/revalidate.js`); `revalidate: 60` is only the backstop.
9. **Security headers live in `lib/securityHeaders.js`,** applied via
   `next.config.mjs`. The CSP keeps `'unsafe-inline'` for MUI/Next — `docs/security.md`
   explains what that does and does not protect. `next/image` only loads the Blob
   host `next.config.mjs` allowlists.

## Conventions

- **Components are JSX in `.js` files** (Next's convention here), so the test
  suite reads pages as source rather than importing them — see
  `tests/adminPages.test.js`.
- **`lib/` files are ES modules** even though the package is type-less; Node's
  syntax detection, Next, and Vitest all handle them. `next.config.mjs` is `.mjs`
  so it can `import` from `lib/`.
- **The dashboard is data-driven:** field descriptor lists + Zod schemas drive
  `EntityForm`; `lib/adminForm.js` holds the pure form logic; `lib/adminNav.js` is
  the one nav list, checked by a test against the files that exist.
- **Tests avoid a live database** — they use pure functions, source reading, or an
  injected fake Prisma client (`tests/draftVisibility.test.js`). Keep it that way.

## Docs index

- `docs/setup.md` — from a clean clone to a running dev server
- `docs/architecture.md` — auth, the API layer, data and component conventions
- `docs/content-management.md` — plain-language "how do I edit X" for the owner
- `docs/deployment.md` — shipping to Vercel and verifying it
- `docs/security.md` — the threat model and every control
- `docs/api.md` — the endpoint reference
- `docs/adr/` — one record per architectural decision, with what was rejected
