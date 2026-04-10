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
- Resume PDF: public/assets/Samiul_Kabir_Resume.pdf
- Logos: public/images/Logo.png and public/images/Logo1.png
- Project images: public/images/projects/**

## External Calls
- Client-side fetch to LeetCode stats API: https://leetcode-stats-api.herokuapp.com/greeed

## Development
- Install: npm install
- Dev server: npm run dev
- Build: npm run build
- Start: npm run start
- Lint: npm run lint
