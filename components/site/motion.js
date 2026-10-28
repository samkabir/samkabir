import {
    animate,
    motion,
    useInView,
    useReducedMotion,
    useScroll,
    useSpring,
    useTransform,
} from 'motion/react';
import { useEffect, useRef } from 'react';
import { EASE_OUT } from './ease';
import { useShell } from './Shell';

export { EASE_IN_OUT, EASE_OUT, prefersReducedMotion } from './ease';

/**
 * The motion vocabulary the public site is built from — easings, and the small
 * set of animated primitives every page reuses — so a page reads as layout and
 * the timing lives in one place.
 *
 * Reduced motion is handled at two levels. `MotionConfig reducedMotion="user"`
 * (in `Shell`) turns transform animations into instant changes everywhere; the
 * effects driven by hand (the magnet, the marquee, the canvas) check
 * `useReducedMotion` themselves and stay still.
 */
const TAGS = { h1: motion.h1, h2: motion.h2, h3: motion.h3, p: motion.p, span: motion.span, div: motion.div, li: motion.li };

/**
 * True once the element has been on screen while the page is uncovered. `once`
 * keeps it true after that; `ready` only drops while the curtain hides the page
 * the element is about to leave.
 */
export function useEntrance(ref, { amount = 0.2, margin = '0px 0px -8% 0px' } = {}) {
    const { ready } = useShell();
    const inView = useInView(ref, { once: true, amount, margin });
    return ready && inView;
}

/** Fades and lifts its children in once they scroll into view. */
export function Reveal({ as = 'div', delay = 0, y = 28, className, children, ...rest }) {
    const ref = useRef(null);
    const show = useEntrance(ref);
    const Tag = TAGS[as] || motion.div;

    return (
        <Tag
            ref={ref}
            className={className}
            initial={{ opacity: 0, y }}
            animate={show ? { opacity: 1, y: 0 } : { opacity: 0, y }}
            transition={{ duration: 1, ease: EASE_OUT, delay }}
            {...rest}
        >
            {children}
        </Tag>
    );
}

/**
 * Text that rises word by word from behind its own line.
 *
 * `accentFrom` sets the index of the first word drawn in the italic serif — the
 * headline uses it for its closing words. Words are separate spans with real
 * spaces between them, so the text still reads and wraps as ordinary text.
 */
export function SplitText({ text = '', as = 'span', className, delay = 0, stagger = 0.06, accentFrom = Infinity, accentClass = 'mo-serif' }) {
    const ref = useRef(null);
    const show = useEntrance(ref, { amount: 0.1 });
    const Tag = TAGS[as] || motion.span;
    const words = text.split(/\s+/).filter(Boolean);

    return (
        <Tag ref={ref} className={className} initial="hidden" animate={show ? 'show' : 'hidden'}>
            {words.map((word, i) => (
                <span key={`${word}-${i}`}>
                    <span className="mo-mask">
                        <motion.span
                            className={i >= accentFrom ? accentClass : undefined}
                            variants={{
                                hidden: { y: '115%', rotate: 4 },
                                show: { y: '0%', rotate: 0, transition: { duration: 1.1, ease: EASE_OUT, delay: delay + i * stagger } },
                            }}
                        >
                            {word}
                        </motion.span>
                    </span>
                    {i < words.length - 1 ? ' ' : null}
                </span>
            ))}
        </Tag>
    );
}

/**
 * A paragraph that lights up word by word as it scrolls through the viewport.
 * Scroll-linked opacity rather than an animation, so it is the reader's own pace.
 */
export function ScrollText({ text = '', className }) {
    const ref = useRef(null);
    const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.9', 'end 0.55'] });
    const words = text.split(/\s+/).filter(Boolean);

    return (
        <p ref={ref} className={className}>
            {words.map((word, i) => (
                <ScrollWord key={`${word}-${i}`} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]}>
                    {word}
                </ScrollWord>
            ))}
        </p>
    );
}

function ScrollWord({ progress, range, children }) {
    const opacity = useTransform(progress, range, [0.16, 1]);
    return (
        <>
            <motion.span style={{ opacity }}>{children}</motion.span>{' '}
        </>
    );
}

/**
 * A number that counts up when it comes into view. The real value is rendered on
 * the server, so without scripts — or before hydration — it is simply correct.
 */
export function Counter({ value, className }) {
    const ref = useRef(null);
    const show = useEntrance(ref, { amount: 0.6 });
    const reduced = useReducedMotion();

    useEffect(() => {
        if (!show || reduced || typeof value !== 'number' || !ref.current) return undefined;
        const node = ref.current;
        const controls = animate(0, value, {
            duration: 1.8,
            ease: EASE_OUT,
            onUpdate: (v) => {
                node.textContent = Math.round(v).toLocaleString();
            },
        });
        return () => controls.stop();
    }, [show, reduced, value]);

    return (
        <span ref={ref} className={className}>
            {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
    );
}

/**
 * Pulls its child a little toward the pointer while hovered, and springs back.
 * Mouse only — a touch has no hover to follow.
 */
export function Magnetic({ strength = 0.3, className = '', children }) {
    const ref = useRef(null);
    const reduced = useReducedMotion();
    const spring = { stiffness: 180, damping: 14, mass: 0.35 };
    const x = useSpring(0, spring);
    const y = useSpring(0, spring);

    const move = (event) => {
        if (reduced || event.pointerType !== 'mouse' || !ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        x.set((event.clientX - (rect.left + rect.width / 2)) * strength);
        y.set((event.clientY - (rect.top + rect.height / 2)) * strength);
    };
    const leave = () => {
        x.set(0);
        y.set(0);
    };

    return (
        <motion.span ref={ref} onPointerMove={move} onPointerLeave={leave} style={{ x, y }} className={`inline-block ${className}`}>
            {children}
        </motion.span>
    );
}

/** A label that rolls up to a second copy of itself on hover (CSS in globals). */
export function Roll({ children }) {
    return (
        <span className="mo-roll">
            <span>{children}</span>
            <span aria-hidden="true">{children}</span>
        </span>
    );
}

/** Section eyebrow: a mono label with a short rule that draws in. */
export function Eyebrow({ index, children, className = '' }) {
    const ref = useRef(null);
    const show = useEntrance(ref);

    return (
        <p ref={ref} className={`mo-label flex items-center gap-3 text-mo-muted ${className}`}>
            {index ? <span className="text-mo-accent-ink">({index})</span> : null}
            <motion.span
                aria-hidden="true"
                className="block h-px w-10 bg-current origin-left"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: show ? 1 : 0 }}
                transition={{ duration: 1, ease: EASE_OUT, delay: 0.1 }}
            />
            <span>{children}</span>
        </p>
    );
}
