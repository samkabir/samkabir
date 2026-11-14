import Lenis from 'lenis';
import { MotionConfig, animate } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { createContext, forwardRef, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Cursor from './Cursor';
import Preloader from './Preloader';
import { EASE_IN_OUT, prefersReducedMotion } from './ease';

/**
 * Everything on the public site that has to survive a route change, mounted once
 * in `_app.js`:
 *
 *   * **Smooth scrolling** (Lenis). Skipped for visitors who prefer reduced
 *     motion, who keep the browser's own scrolling.
 *   * **The page curtain.** `TLink` asks the shell to navigate; the curtain
 *     rises over the old page, the route changes underneath it, and it lifts off
 *     the new one. Back/forward and ordinary links skip it and just navigate.
 *   * **`ready`** — false while something covers the page (the preloader, the
 *     curtain). Entrance animations wait on it, so they play as the page is
 *     uncovered instead of finishing unseen beneath it.
 *   * The preloader and the contextual cursor.
 */
const ShellContext = createContext({
    ready: true,
    navigate: null,
    scrollToHash: () => {},
    lenis: { current: null },
});

export const useShell = () => useContext(ShellContext);

/** The page name the curtain shows while it covers the screen. */
function curtainLabel(href, label) {
    if (label) return label;
    const segment = href.split(/[?#]/)[0].split('/').filter(Boolean)[0];
    if (!segment) return 'Home';
    return { work: 'Work', about: 'About', blog: 'Writing' }[segment] || segment;
}

export default function Shell({ children }) {
    const router = useRouter();
    const lenis = useRef(null);
    const curtain = useRef(null);
    const busy = useRef(false);
    const [ready, setReady] = useState(false);
    const [label, setLabel] = useState('');

    useEffect(() => {
        if (prefersReducedMotion()) return undefined;
        const instance = new Lenis({ autoRaf: true, lerp: 0.1 });
        lenis.current = instance;
        return () => {
            instance.destroy();
            lenis.current = null;
        };
    }, []);

    /**
     * `#contact` is the footer, which sits at the very end of every page, so it
     * means "scroll to the bottom". Any other fragment scrolls to its element,
     * clear of the fixed nav.
     */
    const scrollToHash = useCallback((hash, { immediate = false } = {}) => {
        const target = hash === '#contact' ? 'bottom' : document.getElementById(hash.slice(1));
        if (!target) return;
        if (lenis.current) {
            lenis.current.scrollTo(target, { offset: target === 'bottom' ? 0 : -96, immediate, duration: 1.4 });
        } else if (target === 'bottom') {
            window.scrollTo({ top: document.documentElement.scrollHeight, behavior: immediate ? 'auto' : 'smooth' });
        } else {
            target.scrollIntoView({ behavior: immediate ? 'auto' : 'smooth' });
        }
    }, []);

    const navigate = useCallback(
        async (href, title) => {
            if (busy.current) return;
            const el = curtain.current;
            if (!el || prefersReducedMotion()) {
                router.push(href);
                return;
            }

            busy.current = true;
            setLabel(curtainLabel(href, title));
            lenis.current?.stop();
            try {
                await animate(el, { clipPath: ['inset(100% 0% 0% 0%)', 'inset(0% 0% 0% 0%)'] }, { duration: 0.6, ease: EASE_IN_OUT });
                setReady(false);
                await router.push(href, undefined, { scroll: false });
                lenis.current?.start();
                window.scrollTo(0, 0);
                lenis.current?.scrollTo(0, { immediate: true, force: true });
                const hash = href.includes('#') ? `#${href.split('#')[1]}` : '';
                if (hash) requestAnimationFrame(() => scrollToHash(hash, { immediate: true }));
            } finally {
                lenis.current?.start();
                setReady(true);
                await animate(el, { clipPath: ['inset(0% 0% 0% 0%)', 'inset(0% 0% 100% 0%)'] }, { duration: 0.7, ease: EASE_IN_OUT, delay: 0.08 });
                el.style.clipPath = 'inset(100% 0% 0% 0%)';
                busy.current = false;
            }
        },
        [router, scrollToHash],
    );

    // A page opened with a fragment (`/#contact`, `/about#experience`): let the
    // page lay out, then scroll there.
    useEffect(() => {
        if (!ready || !window.location.hash || window.location.hash.length < 2) return undefined;
        const frame = requestAnimationFrame(() => scrollToHash(window.location.hash, { immediate: true }));
        return () => cancelAnimationFrame(frame);
    }, [ready, scrollToHash]);

    const onPreloaded = useCallback(() => setReady(true), []);
    const value = useMemo(() => ({ ready, navigate, scrollToHash, lenis }), [ready, navigate, scrollToHash]);

    return (
        <MotionConfig reducedMotion="user">
            <ShellContext.Provider value={value}>
                {children}
                <div
                    ref={curtain}
                    aria-hidden="true"
                    className="fixed inset-0 z-[95] grid place-items-center bg-[color:var(--mo-ink)] text-[color:var(--mo-ink-fg)] pointer-events-none"
                    style={{ clipPath: 'inset(100% 0% 0% 0%)' }}
                >
                    <span className="mo-display text-[clamp(48px,9vw,140px)]">
                        {label}
                        <span className="text-mo-accent">.</span>
                    </span>
                </div>
                <Preloader onDone={onPreloaded} />
                <Cursor />
            </ShellContext.Provider>
        </MotionConfig>
    );
}

/**
 * A `next/link` that navigates through the curtain.
 *
 * Only a plain left click on an internal path is intercepted; a modified click
 * (new tab, download) falls through to the browser, and so does anything the
 * caller has already handled. A fragment on the current page scrolls instead of
 * navigating.
 */
export const TLink = forwardRef(function TLink({ href, label, onClick, children, ...rest }, ref) {
    const { navigate, scrollToHash } = useShell();
    const router = useRouter();

    const handleClick = (event) => {
        onClick?.(event);
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (typeof href !== 'string') return;

        if (href.startsWith('#')) {
            event.preventDefault();
            scrollToHash(href);
            return;
        }
        if (!href.startsWith('/') || !navigate) return;

        const [path, hash] = href.split('#');
        if (path === router.asPath.split(/[?#]/)[0]) {
            event.preventDefault();
            if (hash) scrollToHash(`#${hash}`);
            else scrollToHash('#top');
            return;
        }
        event.preventDefault();
        navigate(href, label);
    };

    return (
        <Link ref={ref} href={href} onClick={handleClick} {...rest}>
            {children}
        </Link>
    );
});
