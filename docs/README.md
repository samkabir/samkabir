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
- Client-side fetch to LeetCode stats API: https://leetcode-stats-api.herokuapp.com/greeed

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
