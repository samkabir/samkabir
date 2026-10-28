import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

/**
 * A single toast for the whole site ("Email copied"), and the copy helper that
 * uses it. One provider in `SiteLayout`; anything below can call `useToast()`.
 */
const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
    const [message, setMessage] = useState('');
    const [show, setShow] = useState(false);
    const timer = useRef(null);

    const toast = useCallback((text) => {
        setMessage(text);
        setShow(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setShow(false), 2200);
    }, []);

    useEffect(() => () => clearTimeout(timer.current), []);

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <div className="ss-toast" data-show={show} role="status" aria-live="polite">
                {message}
            </div>
        </ToastContext.Provider>
    );
}

export const useToast = () => useContext(ToastContext);

/**
 * Copies `text` and confirms with a toast. Where the Clipboard API is
 * unavailable (an insecure origin, an old browser) it falls back to `fallbackHref`
 * — for an email address, opening the mail client — so the button never does
 * nothing.
 */
export function useCopy() {
    const toast = useToast();

    return useCallback(
        async (text, { label = 'Copied to clipboard', fallbackHref } = {}) => {
            try {
                await navigator.clipboard.writeText(text);
                toast(label);
            } catch {
                if (fallbackHref) window.location.assign(fallbackHref);
            }
        },
        [toast],
    );
}
