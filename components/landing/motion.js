import { useEffect, useRef, useState } from 'react';
import Reveal from '../ui/Reveal';

/**
 * The landing page's small motion toolkit. Each piece writes CSS variables or
 * transforms straight onto the DOM inside `requestAnimationFrame`, so scrolling
 * and pointer movement never re-render React.
 */

export const prefersReducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** "00." → "00", "01.0" → "01.0" — the index as it sits inside parentheses. */
export const formatIndex = (numberLabel) => (numberLabel || '').replace(/\.$/, '');

/**
 * Text that lights up word by word as it scrolls up the viewport. The words are
 * real text in the DOM, so a screen reader or crawler reads the whole sentence
 * regardless; only their opacity is tied to scroll (see `.lp-words`).
 */
export function ScrollWords({ text, className = '', as: Tag = 'p' }) {
    const ref = useRef(null);
    const words = text.split(/\s+/).filter(Boolean);

    useEffect(() => {
        const node = ref.current;
        if (!node) return undefined;
        let frame = 0;

        const paint = () => {
            frame = 0;
            const { top } = node.getBoundingClientRect();
            const vh = window.innerHeight;
            const p = Math.min(1, Math.max(0, (vh - top) / (vh * 0.65)));
            node.style.setProperty('--p', p.toFixed(3));
        };
        const schedule = () => {
            if (!frame) frame = requestAnimationFrame(paint);
        };

        window.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', schedule);
        schedule();
        return () => {
            window.removeEventListener('scroll', schedule);
            window.removeEventListener('resize', schedule);
            if (frame) cancelAnimationFrame(frame);
        };
    }, []);

    return (
        <Tag ref={ref} className={`lp-words ${className}`} style={{ '--n': words.length }}>
            {words.map((word, i) => (
                <span key={i} style={{ '--i': i }}>
                    {word}{' '}
                </span>
            ))}
        </Tag>
    );
}

/** Counts up to `value` with an ease-out the first time it is half on screen. */
export function CountUp({ value }) {
    const ref = useRef(null);
    const [shown, setShown] = useState(0);

    useEffect(() => {
        const node = ref.current;
        if (!node) return undefined;

        const duration = prefersReducedMotion() ? 0 : 1800;
        let frame = 0;

        const run = () => {
            const start = performance.now();
            const step = (now) => {
                const t = duration ? Math.min(1, (now - start) / duration) : 1;
                setShown(Math.round(value * (1 - Math.pow(1 - t, 4))));
                if (t < 1) frame = requestAnimationFrame(step);
            };
            frame = requestAnimationFrame(step);
        };

        if (typeof IntersectionObserver === 'undefined') {
            run();
            return () => cancelAnimationFrame(frame);
        }

        const io = new IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting) return;
            io.disconnect();
            run();
        }, { threshold: 0.5 });
        io.observe(node);

        return () => {
            io.disconnect();
            cancelAnimationFrame(frame);
        };
    }, [value]);

    return <span ref={ref}>{shown}</span>;
}

/**
 * Pulls its child a little toward a mouse pointer and springs back on leave.
 * Touch and pen input are ignored, so a tap never leaves the button displaced.
 */
export function Magnetic({ children, strength = 0.35, className = '' }) {
    const ref = useRef(null);

    const onMove = (event) => {
        if (event.pointerType !== 'mouse' || prefersReducedMotion()) return;
        const node = ref.current;
        const rect = node.getBoundingClientRect();
        const x = (event.clientX - rect.left - rect.width / 2) * strength;
        const y = (event.clientY - rect.top - rect.height / 2) * strength;
        node.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };

    const onLeave = () => {
        if (ref.current) ref.current.style.transform = '';
    };

    return (
        <span ref={ref} className={`lp-magnet ${className}`} onPointerMove={onMove} onPointerLeave={onLeave}>
            {children}
        </span>
    );
}

/**
 * The opening of every section: a small "(01) Experience" label and the heading
 * itself in display type, each line rising out of a mask as it scrolls in.
 */
export function SectionIntro({ numberLabel, label, heading, aside = null, className = '' }) {
    const index = formatIndex(numberLabel);

    return (
        <div className={`flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-12 md:mb-20 ${className}`}>
            <div>
                <p className="lp-mono lp-label mb-5">
                    {index ? `(${index}) ` : ''}{label}
                </p>
                <Reveal as="h2" className="lp-display text-[clamp(2.8rem,8vw,7rem)] max-w-5xl">
                    <span className="lp-line"><span>{heading}</span></span>
                </Reveal>
            </div>
            {aside}
        </div>
    );
}
