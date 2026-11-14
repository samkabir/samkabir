import { motion, useMotionValue, useSpring } from 'motion/react';
import { useEffect, useState } from 'react';

/**
 * A contextual cursor: an accent disc that appears only over things marked
 * `data-cursor="Label"` (project images, mostly) and says what a click will do.
 * The system cursor is never hidden — this is a caption, not a replacement.
 *
 * Mouse-and-trackpad only; on touch it never mounts.
 */
export default function Cursor() {
    const x = useMotionValue(-200);
    const y = useMotionValue(-200);
    const spring = { stiffness: 450, damping: 38, mass: 0.5 };
    const sx = useSpring(x, spring);
    const sy = useSpring(y, spring);
    const [enabled, setEnabled] = useState(false);
    const [state, setState] = useState({ active: false, text: '' });

    useEffect(() => {
        if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return undefined;

        const move = (event) => {
            x.set(event.clientX);
            y.set(event.clientY);
        };
        const over = (event) => {
            const target = event.target instanceof Element ? event.target.closest('[data-cursor]') : null;
            setState((prev) => {
                if (!target) return prev.active ? { ...prev, active: false } : prev;
                const text = target.getAttribute('data-cursor');
                return prev.active && prev.text === text ? prev : { active: true, text };
            });
        };
        const leave = () => setState((prev) => (prev.active ? { ...prev, active: false } : prev));

        window.addEventListener('pointermove', move, { passive: true });
        document.addEventListener('pointerover', over);
        document.documentElement.addEventListener('pointerleave', leave);
        const frame = requestAnimationFrame(() => setEnabled(true));

        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('pointermove', move);
            document.removeEventListener('pointerover', over);
            document.documentElement.removeEventListener('pointerleave', leave);
        };
    }, [x, y]);

    if (!enabled) return null;

    return (
        <motion.div
            aria-hidden="true"
            className="mo-cursor"
            style={{ x: sx, y: sy }}
            initial={{ scale: 0, opacity: 0 }}
            animate={state.active ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        >
            <span className="mo-label !text-[11px] !tracking-[0.08em]">{state.text}</span>
        </motion.div>
    );
}
