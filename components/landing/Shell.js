import { useCallback, useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from './motion';

const SEEN_KEY = 'lp-intro-seen';

/**
 * The lime curtain that counts to 100 and lifts on the first visit of a session.
 *
 * It is server-rendered so it covers the page from the first paint, but the CSS
 * only shows it under `.js` — a visitor or crawler without scripts never sees it.
 * Repeat visits in the same tab, and anyone who prefers reduced motion, skip it
 * entirely. `onReveal` fires as the curtain starts to lift, which is the cue for
 * the hero's own entrance.
 */
function Preloader({ name, onReveal }) {
    const [count, setCount] = useState(0);
    const [state, setState] = useState('loading');

    useEffect(() => {
        let seen = false;
        try {
            seen = sessionStorage.getItem(SEEN_KEY) === '1';
            sessionStorage.setItem(SEEN_KEY, '1');
        } catch {
            // Storage blocked (private mode, sandboxed preview): play the intro.
        }

        const root = document.documentElement;
        let frame = 0;
        const timers = [];

        if (seen || prefersReducedMotion()) {
            frame = requestAnimationFrame(() => {
                setState('done');
                onReveal();
            });
            return () => cancelAnimationFrame(frame);
        }

        root.style.overflow = 'hidden';
        const start = performance.now();
        const duration = 1400;

        const step = (now) => {
            const t = Math.min(1, (now - start) / duration);
            setCount(Math.round(100 * (1 - Math.pow(1 - t, 3))));
            if (t < 1) {
                frame = requestAnimationFrame(step);
                return;
            }
            timers.push(setTimeout(() => {
                setState('leaving');
                root.style.overflow = '';
                onReveal();
                timers.push(setTimeout(() => setState('done'), 1000));
            }, 200));
        };
        frame = requestAnimationFrame(step);

        return () => {
            cancelAnimationFrame(frame);
            timers.forEach(clearTimeout);
            root.style.overflow = '';
        };
    }, [onReveal]);

    return (
        <div className="lp-preloader" data-state={state} aria-hidden="true">
            <div className="flex justify-between lp-mono">
                <span>{name}</span>
                <span>Portfolio</span>
            </div>
            <div className="lp-preloader__count">{count}</div>
        </div>
    );
}

/**
 * A lime dot that trails the mouse, swells over anything clickable, and turns
 * into a labelled disc over elements carrying `data-cursor="…"`.
 *
 * Only for a fine pointer — on touch there is nothing to follow. The native
 * cursor stays visible; this is an accent, not a replacement, so nobody loses
 * track of where they are pointing.
 */
function Cursor() {
    const ref = useRef(null);
    const labelRef = useRef(null);

    useEffect(() => {
        const node = ref.current;
        if (!node || !window.matchMedia?.('(pointer: fine)').matches || prefersReducedMotion()) return undefined;

        const target = { x: -100, y: -100 };
        const pos = { x: -100, y: -100 };
        let frame = 0;

        const tick = () => {
            pos.x += (target.x - pos.x) * 0.2;
            pos.y += (target.y - pos.y) * 0.2;
            node.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
            frame = Math.abs(target.x - pos.x) + Math.abs(target.y - pos.y) > 0.1 ? requestAnimationFrame(tick) : 0;
        };

        const onMove = (event) => {
            target.x = event.clientX;
            target.y = event.clientY;
            node.dataset.visible = 'true';

            const labelled = event.target.closest?.('[data-cursor]');
            const link = event.target.closest?.('a, button, [role="tab"]');
            node.dataset.mode = labelled ? 'label' : link ? 'link' : 'dot';
            if (labelled && labelRef.current) labelRef.current.textContent = labelled.dataset.cursor;

            if (!frame) frame = requestAnimationFrame(tick);
        };
        const onLeave = () => {
            node.dataset.visible = 'false';
        };

        window.addEventListener('pointermove', onMove, { passive: true });
        document.documentElement.addEventListener('pointerleave', onLeave);
        return () => {
            window.removeEventListener('pointermove', onMove);
            document.documentElement.removeEventListener('pointerleave', onLeave);
            if (frame) cancelAnimationFrame(frame);
        };
    }, []);

    return (
        <div ref={ref} className="lp-cursor" data-mode="dot" data-visible="false" aria-hidden="true">
            <span ref={labelRef} className="lp-cursor__label" />
        </div>
    );
}

/**
 * The landing page's root. `lp-ready` is the switch every entrance animation
 * waits on (see `.lp:not(.lp-ready)` in `globals.css`).
 */
const Shell = ({ name, children }) => {
    const [ready, setReady] = useState(false);
    const reveal = useCallback(() => setReady(true), []);

    return (
        <div className={`lp ${ready ? 'lp-ready' : ''}`}>
            <Preloader name={name} onReveal={reveal} />
            <Cursor />
            <div className="lp-grain" aria-hidden="true" />
            {children}
        </div>
    );
};

export default Shell;
