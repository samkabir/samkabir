# Portfolio Website Docs

## Overview
This project is a personal portfolio website built with the Next.js pages router and React 18. It uses MUI for layout primitives, Tailwind CSS for utility styling, and AOS for scroll animations.

## Structure
- pages/: Route entry points. The home page is pages/index.js.
- components/: Section components and UI cards.
- data/: Content arrays for skills, experience, and projects.
- public/: Static assets (images and resume PDF).
- styles/: Global styles and Tailwind setup.

## Content Sources
- data/skills.js: List of skills rendered in the About section.
- data/experience.js: Full-time experience timeline.
- data/contractualExperiences.js: Contract roles.
- data/projects.js: Project list and images.

## Styling
- Tailwind classes are used directly in JSX for layout and spacing.
- MUI components wrap layout and typography where needed.
- Fonts are loaded via next/font/google.

## Assets
Uploaded media lives in object storage, not in the repository — see
[adr/0005-file-storage.md](adr/0005-file-storage.md). `/cv` is a permanent link
that redirects to whichever CV version is currently active.

The files below are the original static assets, still in use until Phase 7
imports them.

- Resume PDF: public/assets/Samiul_Kabir_Resume.pdf
- Logos: public/images/Logo.png and public/images/Logo1.png
- Project images: public/images/projects/**

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
  that could go offline. The username lives in `lib/leetcode.js` until Phase 7
  reads it from `Profile.leetcodeUsername`.

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
| `/admin/blogs` | Posts (list, publish, delete) and tags. The editor is Phase 8 |
| `/admin/settings` | SEO defaults and section headings |
| `/admin/account` | Password, linked sign-in methods, recent sign-ins |

Every page is guarded by `withAdminPage` in `lib/adminPage.js`, which runs the
same session check the API does — including the "is this address still on
`ADMIN_EMAILS`" re-check that the edge middleware cannot perform. See
[adr/0006-dashboard.md](adr/0006-dashboard.md) for how the screens are built, and
for the two bugs that phase produced.

The screens fetch their data after mount, so nothing in a page's HTML is content.
Saving goes through the same `/api/admin/*` endpoints any other client would use.

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
- Media cleanup: npm run media:prune (add -- --apply to delete)
