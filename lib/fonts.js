import { Geist, Geist_Mono, Itim, Newsreader, Rubik } from 'next/font/google';

/**
 * Web fonts, declared once.
 *
 * `Footer`, `Contact` and `ProjectCard` each called `Rubik(...)` themselves and
 * each exported its own `rubikFont` — three separate declarations of the same
 * family, none of which was ever imported by anything else. `next/font` is
 * careful enough that this produced one stylesheet rather than three, so nothing
 * was broken; it was just three places to edit a weight list, and three chances
 * for them to disagree.
 *
 * These must stay at module scope: `next/font/google` is resolved at build time
 * and throws if called inside a component. That is also why the module has no
 * other exports — anything that changes per render does not belong here.
 *
 * The public site (`components/site`) is set in Geist, with Geist Mono for small
 * metadata and Newsreader for the few serif headlines. All three are exposed as
 * CSS variables, applied once in `_app.js`; `next/font` self-hosts them, so the
 * CSP's `font-src 'self'` still holds.
 */

export const rubikFont = Rubik({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

export const itimFont = Itim({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-itim',
});

export const geistFont = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
});

export const geistMonoFont = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

export const newsreaderFont = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-newsreader',
  display: 'swap',
});
