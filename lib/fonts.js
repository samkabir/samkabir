import { Bricolage_Grotesque, Inter, Instrument_Serif, Itim, JetBrains_Mono, Rubik } from 'next/font/google';

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
 * `interFont` and `monoFont` are the public site's type: Inter for prose and
 * headings, JetBrains Mono for the small numbered labels. Both are exposed as CSS
 * variables, which `_app.js` puts on a wrapper and `tailwind.config.js` maps to
 * `font-sans` / `font-mono`. `next/font` self-hosts them at build, so the CSP's
 * `font-src 'self'` still holds.
 *
 * `displayFont` and `serifFont` belong to the landing page (`components/landing`):
 * Bricolage Grotesque for the oversized headings, Instrument Serif for the italic
 * accent words set against it.
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

export const interFont = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const monoFont = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const displayFont = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const serifFont = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
});
