import { animate } from 'motion/react';
import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { EASE_IN_OUT, EASE_OUT } from './ease';

/**
 * The intro: a count to 100 over a dark panel, which then lifts away like a
 * blind. It plays once per browser session — `_document.js` sets
 * `data-preload` before paint when it should, and CSS only shows this panel
 * under that flag, so a returning visitor never sees it flash.
 *
 * It waits on nothing real (the page is static and already here), so it is kept
 * short, and `onDone` fires as the panel *starts* to lift, letting the hero's
 * entrance play as it is uncovered.
 */
export default function Preloader({ onDone }) {
    const root = useRef(null);
    const count = useRef(null);
    const bar = useRef(null);
    const inner = useRef(null);

    useEffect(() => {
        const html = document.documentElement;
        if (!('preload' in html.dataset) || !root.current) {
            const frame = requestAnimationFrame(onDone);
            return () => cancelAnimationFrame(frame);
        }

        let cancelled = false;
        const counter = animate(0, 100, {
            duration: 1.5,
            ease: [0.65, 0, 0.35, 1],
            onUpdate: (v) => {
                if (count.current) count.current.textContent = String(Math.round(v)).padStart(3, '0');
                if (bar.current) bar.current.style.transform = `scaleX(${v / 100})`;
            },
        });

        const finish = () => {
            delete html.dataset.preload;
            try {
                sessionStorage.setItem('mo:seen', '1');
            } catch {
                // Storage blocked: the intro may play again next page load.
            }
        };

        counter.then(async () => {
            if (cancelled) return;
            await animate(inner.current, { opacity: 0, y: -30 }, { duration: 0.45, ease: EASE_OUT });
            if (cancelled) return;
            onDone();
            await animate(root.current, { y: '-100%' }, { duration: 0.9, ease: EASE_IN_OUT });
            finish();
        });

        // Stopping without clearing the flag: React's dev-mode remount runs this
        // cleanup and then the effect again, and the intro should still play.
        return () => {
            cancelled = true;
            counter.stop();
        };
    }, [onDone]);

    return (
        <div
            ref={root}
            aria-hidden="true"
            className="mo-preloader fixed inset-0 z-[100] flex-col justify-between p-6 sm:p-10 bg-[color:var(--mo-ink)] text-[color:var(--mo-ink-fg)]"
        >
            <div ref={inner} className="flex h-full flex-col justify-between">
                <div className="flex items-start justify-between">
                    <Image src="/images/Logo.png" alt="" width={342} height={262} priority style={{ width: 44, height: 'auto' }} />
                    <span className="mo-label opacity-60" suppressHydrationWarning>Portfolio — {new Date().getFullYear()}</span>
                </div>
                <div>
                    <div className="flex items-end justify-between gap-6">
                        <span className="mo-label opacity-60">Loading</span>
                        <span ref={count} className="mo-display tabular-nums text-[clamp(72px,16vw,220px)] leading-[0.8]">000</span>
                    </div>
                    <div className="mt-6 h-px w-full bg-white/15">
                        <div ref={bar} className="h-px w-full origin-left bg-[color:var(--mo-accent)]" style={{ transform: 'scaleX(0)' }} />
                    </div>
                </div>
            </div>
        </div>
    );
}
