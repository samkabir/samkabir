import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from './ease';

/**
 * The hero's background: a grid of dots that breathes slowly and parts around
 * the pointer, the nearest dots catching the accent colour.
 *
 * Drawn on a canvas because a few thousand DOM nodes would not animate at 60fps.
 * It only runs while it is on screen and the tab is visible, re-reads its
 * colours when the theme changes, and for reduced motion it draws once and
 * stays still. Purely decorative, so it is hidden from assistive technology.
 */
const GAP = 26;
const RADIUS = 150;

export default function DotField({ className = '' }) {
    const ref = useRef(null);

    useEffect(() => {
        const canvas = ref.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return undefined;

        const still = prefersReducedMotion();
        const pointer = { x: -9999, y: -9999 };
        const colors = { fg: '#000', accent: '#f50' };
        let dots = [];
        let width = 0;
        let height = 0;
        let frame = 0;
        let running = false;
        let visible = true;

        const readColors = () => {
            const styles = getComputedStyle(canvas);
            colors.fg = styles.getPropertyValue('--mo-fg').trim() || colors.fg;
            colors.accent = styles.getPropertyValue('--mo-accent').trim() || colors.accent;
        };

        const resize = () => {
            const rect = canvas.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            width = rect.width;
            height = rect.height;
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            dots = [];
            for (let y = GAP / 2; y < height; y += GAP) {
                for (let x = GAP / 2; x < width; x += GAP) dots.push({ ox: x, oy: y, x, y });
            }
        };

        const draw = (time) => {
            ctx.clearRect(0, 0, width, height);
            const lit = [];

            ctx.fillStyle = colors.fg;
            ctx.globalAlpha = 0.22;
            ctx.beginPath();
            for (const dot of dots) {
                const dx = dot.ox - pointer.x;
                const dy = dot.oy - pointer.y;
                const dist = Math.hypot(dx, dy) || 1;
                let tx = dot.ox;
                let ty = dot.oy;
                let glow = 0;
                if (dist < RADIUS) {
                    glow = 1 - dist / RADIUS;
                    const push = glow * glow * 26;
                    tx += (dx / dist) * push;
                    ty += (dy / dist) * push;
                }
                dot.x += (tx - dot.x) * 0.12;
                dot.y += (ty - dot.y) * 0.12;

                const wave = still ? 0 : Math.sin(time * 0.0011 + dot.ox * 0.011 + dot.oy * 0.007);
                const r = 0.9 + (wave + 1) * 0.35;
                if (glow > 0.08) {
                    lit.push([dot.x, dot.y, r + glow * 1.4, glow]);
                } else {
                    ctx.moveTo(dot.x + r, dot.y);
                    ctx.arc(dot.x, dot.y, r, 0, Math.PI * 2);
                }
            }
            ctx.fill();

            ctx.fillStyle = colors.accent;
            for (const [x, y, r, glow] of lit) {
                ctx.globalAlpha = 0.25 + glow * 0.75;
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        };

        const loop = (time) => {
            draw(time);
            frame = requestAnimationFrame(loop);
        };
        const start = () => {
            if (running || still || !visible || document.hidden) return;
            running = true;
            frame = requestAnimationFrame(loop);
        };
        const stop = () => {
            running = false;
            cancelAnimationFrame(frame);
        };

        const onMove = (event) => {
            const rect = canvas.getBoundingClientRect();
            pointer.x = event.clientX - rect.left;
            pointer.y = event.clientY - rect.top;
        };
        const onLeave = () => {
            pointer.x = -9999;
            pointer.y = -9999;
        };
        const onVisibility = () => (document.hidden ? stop() : start());
        const onTheme = () => {
            readColors();
            if (still) draw(0);
        };

        readColors();
        resize();
        draw(0);

        const observer = new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            if (visible) start();
            else stop();
        });
        observer.observe(canvas);
        const sizer = new ResizeObserver(() => {
            resize();
            draw(performance.now());
        });
        sizer.observe(canvas);

        window.addEventListener('pointermove', onMove, { passive: true });
        document.documentElement.addEventListener('pointerleave', onLeave);
        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('ss:theme', onTheme);
        start();

        return () => {
            stop();
            observer.disconnect();
            sizer.disconnect();
            window.removeEventListener('pointermove', onMove);
            document.documentElement.removeEventListener('pointerleave', onLeave);
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('ss:theme', onTheme);
        };
    }, []);

    return <canvas ref={ref} aria-hidden="true" className={`mo-field block w-full h-full ${className}`} />;
}
