/**
 * Timing shared by every animation on the public site. Its own module so that
 * `Shell` and `motion.js`, which import each other's exports otherwise, do not.
 */
export const EASE_OUT = [0.22, 1, 0.36, 1];
export const EASE_IN_OUT = [0.76, 0, 0.24, 1];

export function prefersReducedMotion() {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
