import { useEffect, useRef } from 'react';

/**
 * The fixed layer behind the whole page: a fading grid, three slow aurora orbs,
 * a soft spotlight that follows the cursor, a film of noise, and the scroll
 * progress bar along the top edge.
 *
 * Pointer and scroll handlers only write CSS variables inside one
 * `requestAnimationFrame` each, so React never re-renders for them. Everything is
 * `pointer-events: none` and `aria-hidden` — it is decoration, not content.
 */
const Backdrop = () => {
    const rootRef = useRef(null);
    const progressRef = useRef(null);

    useEffect(() => {
        let frame = 0;
        let pointer = null;

        const paint = () => {
            frame = 0;
            const root = rootRef.current;
            const bar = progressRef.current;

            if (pointer && root) {
                root.style.setProperty('--cursor-x', `${pointer.x}px`);
                root.style.setProperty('--cursor-y', `${pointer.y}px`);
            }

            if (bar) {
                const max = document.documentElement.scrollHeight - window.innerHeight;
                bar.style.setProperty('--progress', max > 0 ? String(window.scrollY / max) : '0');
            }
        };

        const schedule = () => {
            if (!frame) frame = requestAnimationFrame(paint);
        };

        const onPointer = (event) => {
            pointer = { x: event.clientX, y: event.clientY };
            schedule();
        };

        window.addEventListener('pointermove', onPointer, { passive: true });
        window.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', schedule);
        schedule();

        return () => {
            window.removeEventListener('pointermove', onPointer);
            window.removeEventListener('scroll', schedule);
            window.removeEventListener('resize', schedule);
            if (frame) cancelAnimationFrame(frame);
        };
    }, []);

    return (
        <>
            <div ref={progressRef} className="scroll-progress" aria-hidden="true" />
            <div ref={rootRef} className="backdrop" aria-hidden="true">
                <div className="backdrop-orb backdrop-orb--a" />
                <div className="backdrop-orb backdrop-orb--b" />
                <div className="backdrop-orb backdrop-orb--c" />
                <div className="backdrop-grid" />
                <div className="backdrop-spotlight" />
                <div className="backdrop-noise" />
            </div>
        </>
    );
};

export default Backdrop;
