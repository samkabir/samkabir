import { Itim, Rubik } from 'next/font/google';

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
