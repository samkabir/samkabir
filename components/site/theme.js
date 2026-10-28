import { useCallback, useEffect, useState } from 'react';
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

export function ThemeToggle({ className = '' }) {
    const { theme, toggle } = useTheme();
    const dark = theme === 'dark';

    return (
        <button
            type="button"
            onClick={toggle}
            aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
            title={dark ? 'Light theme' : 'Dark theme'}
            className={`relative grid place-items-center w-9 h-9 rounded-full text-ss-muted hover:text-ss-fg hover:bg-ss-subtle transition-colors ${className}`}
        >
            <Sun className={`absolute w-[18px] h-[18px] transition-all duration-500 ${dark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50'}`} />
            <Moon className={`absolute w-[18px] h-[18px] transition-all duration-500 ${dark ? 'opacity-0 rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'}`} />
        </button>
    );
}
