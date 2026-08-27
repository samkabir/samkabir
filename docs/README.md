# Portfolio Website Docs

## Overview
This project is a personal portfolio website built with the Next.js pages router and React 18. It uses MUI for layout primitives, Tailwind CSS for utility styling, and AOS for scroll animations. It was a static site until Phase 7 and is now a database-backed CMS with a private dashboard at `/admin`.

## Guides

- [../CLAUDE.md](../CLAUDE.md) — orientation and the invariants that must not be changed casually
- [setup.md](setup.md) — from a clean clone to a running dev server
- [architecture.md](architecture.md) — auth, the API layer, data and component conventions
- [content-management.md](content-management.md) — plain-language "how do I edit X" for the owner
- [deployment.md](deployment.md) — shipping to Vercel and verifying it
- [security.md](security.md) — the threat model and every control
- [api.md](api.md) — the endpoint reference
- [adr/](adr/README.md) — one record per architectural decision

## Structure
- pages/: Route entry points. The home page is pages/index.js.
- components/: Section components and UI cards.
- lib/content.js: The only place the public site reads content from.
- public/: The logos and the favicon. Everything else is in object storage.
- styles/: Global styles and Tailwind setup.

## Content Sources

All of it comes from the database. There is no `data/` directory any more — Phase
7 deleted `skills.js`, `experience.js`, `contractualExperiences.js` and
`projects.js` after seeding their contents into Postgres. `git log` has them if a
value ever needs checking against the original.

`lib/content.js` is the single read layer, and it guarantees four things that are
easy to get wrong once per page instead of once per project:

1. **Every query filters `status: 'PUBLISHED'`.** One module means
   `grep -c PUBLISHED` is the audit.
2. **Ordering matches the dashboard**, copied from `lib/api/resources/`. If they
   drift, drag-to-reorder starts lying about what a visitor sees.
3. **No `Date` and no `undefined` crosses the boundary** — `getStaticProps`
   refuses both. Dates become display strings there, once.
4. **It is never imported by a client component**, because it touches Prisma.

`pages/index.js` calls `getPageContent()` from `getStaticProps` with
`revalidate: 60`, and every dashboard save additionally rebuilds the page on
demand — so an edit is live on the next reload. The timer is the backstop for a
revalidation that fails, which is why it stays short rather than moving to an
hour.

To repopulate an empty database:

    npm run db:seed                      # content
    npm run db:seed -- --include-nda     # …plus the three NDA projects, as drafts
    npm run assets:import                # covers and the CV (see the note in that script)

## Styling
- Tailwind classes are used directly in JSX for layout and spacing.
- MUI components wrap layout and typography where needed.
- Fonts are loaded via next/font/google.

## Assets
Uploaded media lives in object storage, not in the repository — see
[adr/0005-file-storage.md](adr/0005-file-storage.md). `/cv` is a permanent link
that redirects to whichever CV version is currently active, so replacing a CV is
an upload rather than a commit and every link already shared keeps working.

What is left in `public/` is only what is not content:

- Logos: public/images/Logo.png and public/images/Logo1.png
- favicon.ico

The sixteen project screenshots and the CV moved to Blob in Phase 7 and were
deleted from the repository. Project covers are served through `next/image` from
`*.public.blob.vercel-storage.com`, which `next.config.mjs` allowlists — the
optimiser refuses a host it has not been told about, so adding a storage provider
means adding it there.

## External Calls
- **LeetCode solved count** — `/api/leetcode` queries LeetCode's own GraphQL
  endpoint server-side and caches the answer at the edge for an hour.

  It used to be a client-side fetch to `leetcode-stats-api.herokuapp.com`, which
  no longer exists: Heroku retired its free dynos in November 2022. A dead host's
  error page carries no `Access-Control-Allow-Origin`, so the browser reported it
  as a CORS failure — the symptom, not the cause. There was nothing behind the URL
  to allow access to.

  Going through this site's own server removes the CORS question entirely (it
  applies to browsers, not to server-to-server requests) and removes the mirror
  that could go offline. The username comes from `Profile.leetcodeUsername`, and
  `Profile.showLeetcode` is honoured by the endpoint as well as by the component —
  hiding the block client-side alone would leave the endpoint answering for a
  profile the owner had chosen to stop publishing.

## The dashboard

Ten screens under `/admin`, listed in `lib/adminNav.js`:

| Screen | What it manages |
|---|---|
| `/admin` | Counts, what is still missing, recent changes, the active CV |
| `/admin/bio` | The identity block, and education rows |
| `/admin/experiences` | Full-time and contractual roles, in two tabs over one list |
| `/admin/projects` | Projects, the featured flag, cover images |
| `/admin/skills` | Skills, in the order they are displayed |
| `/admin/links` | Social links, and where each one appears |
| `/admin/resume` | Versioned CV uploads and which one `/cv` serves |
| `/admin/blogs` | Posts and tags; the Markdown editor is at `/admin/blogs/new` and `/admin/blogs/[id]` |
| `/admin/settings` | SEO defaults and section headings |
| `/admin/account` | Password, linked sign-in methods, recent sign-ins |

Every page is guarded by `withAdminPage` in `lib/adminPage.js`, which runs the
same session check the API does — including the "is this address still on
`ADMIN_EMAILS`" re-check that the edge middleware cannot perform. See
[adr/0006-dashboard.md](adr/0006-dashboard.md) for how the screens are built, and
for the two bugs that phase produced.

The screens fetch their data after mount, so nothing in a page's HTML is content.
Saving goes through the same `/api/admin/*` endpoints any other client would use,
and each successful mutation rebuilds the public page before it responds. The
button on `/admin/settings` does the same thing manually, for the case where that
did not take.

## Admin API and authentication
The dashboard's backend lives under `/api/admin`, and sign-in at `/admin/login`.
See [api.md](api.md) for the endpoint reference,
[adr/0003-admin-api.md](adr/0003-admin-api.md) for how the API is built, and
[adr/0004-authentication.md](adr/0004-authentication.md) for the three
authorisation gates.

The admin account is created from the command line and nowhere else:

    npm run admin:create

There is no registration endpoint and no password-reset email flow. Recovery is
`npm run admin:reset-password`.

## Development
- Install: npm install
- Dev server: npm run dev
- Build: npm run build
- Start: npm run start
- Lint: npm run lint
- Test: npm test
- Database: npm run db:migrate, npm run db:studio, npm run db:smoke
- Admin account: npm run admin:create, npm run admin:reset-password
- Seed content: npm run db:seed (add -- --reset to replace experience and education)
- Media cleanup: npm run media:prune (add -- --apply to delete)
