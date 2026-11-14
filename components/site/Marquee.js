import {
    motion,
    useAnimationFrame,
    useMotionValue,
    useReducedMotion,
    useScroll,
    useSpring,
    useTransform,
    useVelocity,
} from 'motion/react';
import { useRef } from 'react';

/**
 * A ribbon of words that drifts on its own and speeds up with the scroll —
 * scrolling up turns it around. Four copies of the content make the loop
 * seamless: the track is wrapped every quarter of its width.
 *
 * Only the first copy is exposed to assistive technology. With reduced motion
 * it stands still.
 */
const wrap = (min, max, value) => {
    const range = max - min;
    return ((((value - min) % range) + range) % range) + min;
};

function Row({ items, baseVelocity, className }) {
    const reduced = useReducedMotion();
    const base = useMotionValue(0);
    const { scrollY } = useScroll();
    const velocity = useVelocity(scrollY);
    const smooth = useSpring(velocity, { damping: 50, stiffness: 400 });
    const factor = useTransform(smooth, [0, 1000], [0, 4], { clamp: false });
    const x = useTransform(base, (v) => `${wrap(-25, -50, v)}%`);
    const direction = useRef(1);

    useAnimationFrame((_, delta) => {
        if (reduced) return;
        const f = factor.get();
        if (f < 0) direction.current = -1;
        else if (f > 0) direction.current = 1;
        const step = direction.current * baseVelocity * (delta / 1000);
        base.set(base.get() + step + step * Math.abs(f));
    });

    const copy = (hidden) => (
        <span className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
            {items.map((item, i) => (
                <span key={i} className="flex items-center">
                    <span className="px-[0.35em]">{item}</span>
                    <span aria-hidden="true" className="text-mo-accent text-[0.5em]">✳</span>
                </span>
            ))}
        </span>
    );

    return (
        <div className={`overflow-hidden whitespace-nowrap ${className}`}>
            <motion.div className="flex w-max" style={{ x }}>
                {copy(false)}
                {copy(true)}
                {copy(true)}
                {copy(true)}
            </motion.div>
        </div>
    );
}

export default function Marquee({ items = [], label }) {
    if (!items.length) return null;
    const half = Math.ceil(items.length / 2);

    return (
        <section aria-label={label} className="py-10 sm:py-16 select-none">
            <Row items={items} baseVelocity={-2} className="mo-display text-[clamp(44px,8vw,128px)] leading-[1.05]" />
            <Row
                items={[...items.slice(half), ...items.slice(0, half)]}
                baseVelocity={2}
                className="mo-display text-[clamp(44px,8vw,128px)] leading-[1.05] text-transparent [-webkit-text-stroke:1px_var(--mo-faint)]"
            />
        </section>
    );
}
