# AGENTS.md

Short orientation for an automated contributor. The full map is
[CLAUDE.md](CLAUDE.md); this is the one-screen version.

## What this is

A personal portfolio for Samiul Kabir, now a **database-backed CMS** — the public
pages render from Postgres, and a private dashboard at `/admin` edits that content
through a JSON API. It was a static site until Phase 7; the old `data/*.js` content
arrays were deleted after being seeded into the database (`git log` still has them).

- Next.js 16 (Pages Router), React 18, Prisma 6 + Postgres (Neon), NextAuth 4,
  MUI + Emotion, Tailwind, Vercel Blob for files.

## Key paths

- `pages/` — routes: public site, `/admin/*` screens, `/api/**` endpoints.
- `lib/content.js` — the only place the public site reads content from.
- `lib/api/` — the shared admin-API machinery (`handler.js`, `resource.js`,
  `resources/*`); `lib/validation/` — Zod schemas shared by client and server.
- `lib/auth.js`, `lib/authOptions.js` — the three authorisation gates.
- `components/` — public sections and `components/admin/*` (the dashboard toolkit).
- `prisma/schema.prisma` — the data model. `styles/globals.css` — the only stylesheet.
- `public/` — just the logo and favicon; all uploaded media lives in Blob storage.

## Commands

- `npm run dev` / `npm run build` / `npm run start`
- `npm run lint` · `npm test`
- `npm run db:migrate` · `npm run db:studio` · `npm run db:seed`
- `npm run admin:create` · `npm run admin:reset-password`

DB/script commands load `.env` then `.env.local` via `scripts/with-env.mjs`.

## Rules for changes

- Never add a public content read outside `lib/content.js`; it filters
  `status: 'PUBLISHED'` and must not be imported by client code.
- Never make an admin route without `createHandler` — it applies auth by
  construction. There is no auth bypass and no registration path.
- Never render user markdown without the `rehype-sanitize` allowlist, and never
  use `dangerouslySetInnerHTML` for it.
- Components are JSX in `.js` files; `lib/` is ES modules; `next.config.mjs` is
  `.mjs` so it can import from `lib/`.
- External links use `target="_blank"` with `rel="noreferrer"`.
- Tests must not need a live database — see `tests/`.

## External calls

- **LeetCode solved count** is fetched server-side through `/api/leetcode` (which
  proxies LeetCode's own GraphQL endpoint and caches at the edge). The username
  comes from `Profile.leetcodeUsername`; `Profile.showLeetcode` gates it. The old
  client-side `leetcode-stats-api.herokuapp.com` call is gone — that host was
  retired.
