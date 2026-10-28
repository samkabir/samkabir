import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import { EASE_OUT, prefersReducedMotion } from './ease';
import { Moon, Sun } from './icons';

/**
 * The light/dark switch. `_document.js` has already applied the theme before
 * paint; this reads it back, flips it, and remembers an explicit choice. Until
 * the visitor chooses, the site follows their system setting.
 */
const THEME_EVENT = 'ss:theme';

export function useTheme() {
    const [theme, setThemeState] = useState(null);

    // Several components hold this hook (the nav toggle, the command palette);
    // a change from any of them is broadcast so the others stay in step.
    useEffect(() => {
        const read = () => setThemeState(document.documentElement.dataset.theme || 'light');
        const frame = requestAnimationFrame(read);
        window.addEventListener(THEME_EVENT, read);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener(THEME_EVENT, read);
        };
    }, []);

    const setTheme = useCallback((next) => {
        document.documentElement.dataset.theme = next;
        try {
            localStorage.setItem('theme', next);
        } catch {
            // Storage blocked: the choice lasts for this page view.
        }
        setThemeState(next);
        window.dispatchEvent(new Event(THEME_EVENT));
    }, []);

    const toggle = useCallback(() => {
        setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    }, [setTheme]);

    return { theme, toggle };
}

/**
 * The light/dark switch. Where the browser supports view transitions, the new
 * theme grows out of the button as a circle; elsewhere, and for visitors who
 * prefer reduced motion, it simply switches.
 */
export function ThemeToggle({ className = '' }) {
    const { theme, toggle } = useTheme();
    const dark = theme === 'dark';

    const onClick = (event) => {
        if (!document.startViewTransition || prefersReducedMotion()) {
            toggle();
            return;
        }
        const rect = event.currentTarget.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

        const transition = document.startViewTransition(toggle);
        transition.ready
            .then(() => {
                document.documentElement.animate(
                    { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
                    { duration: 700, easing: 'cubic-bezier(0.76, 0, 0.24, 1)', pseudoElement: '::view-transition-new(root)' },
                );
            })
            .catch(() => {});
    };

    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
            title={dark ? 'Light theme' : 'Dark theme'}
            className={`relative grid place-items-center w-10 h-10 rounded-full overflow-hidden text-mo-fg hover:bg-mo-sunk transition-colors ${className}`}
        >
            <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                    key={dark ? 'sun' : 'moon'}
                    initial={{ y: 22, rotate: -90, opacity: 0 }}
                    animate={{ y: 0, rotate: 0, opacity: 1 }}
                    exit={{ y: -22, rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.5, ease: EASE_OUT }}
                    className="grid place-items-center"
                >
                    {dark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
                </motion.span>
            </AnimatePresence>
        </button>
    );
}
