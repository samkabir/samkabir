import { AnimatePresence, motion } from 'motion/react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { EASE_OUT } from './ease';
import { Check, Close } from './icons';

/**
 * A single toast for the whole site ("Email copied"), and the copy helper that
 * uses it. One provider in `SiteLayout`; anything below can call `useToast()`.
 * The live region is always mounted so screen readers announce each message.
 */
const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
    const [toast, setToast] = useState(null);
    const timer = useRef(null);
    const seq = useRef(0);

    const show = useCallback((text, tone = 'ok') => {
        seq.current += 1;
        setToast({ text, tone, id: seq.current });
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setToast(null), 2400);
    }, []);

    useEffect(() => () => clearTimeout(timer.current), []);

    return (
        <ToastContext.Provider value={show}>
            {children}
            <div role="status" aria-live="polite" className="fixed inset-x-0 bottom-6 z-[90] flex justify-center pointer-events-none">
                <AnimatePresence>
                    {toast ? (
                        <motion.div
                            key={toast.id}
                            initial={{ y: 40, opacity: 0, scale: 0.9 }}
                            animate={{ y: 0, opacity: 1, scale: 1 }}
                            exit={{ y: 20, opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.5, ease: EASE_OUT }}
                            className="flex items-center gap-2 rounded-full bg-mo-fg text-mo-bg pl-3 pr-4 h-11 text-[14px] font-medium shadow-[0_12px_40px_-12px_rgba(0,0,0,0.45)]"
                        >
                            <span className={`grid place-items-center w-6 h-6 rounded-full text-white ${toast.tone === 'error' ? 'bg-mo-faint' : 'bg-mo-accent'}`}>
                                {toast.tone === 'error' ? <Close className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                            </span>
                            {toast.text}
                        </motion.div>
                    ) : null}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
}

export const useToast = () => useContext(ToastContext);

/**
 * Copies `text` and confirms with a toast. Where the Clipboard API is
 * unavailable (an insecure origin, an old browser) it falls back to `fallbackHref`
 * — for an email address, opening the mail client — or, with no fallback, says
 * it was blocked, so the button never appears to work while copying nothing.
 */
export function useCopy() {
    const toast = useToast();

    return useCallback(
        async (text, { label = 'Copied to clipboard', failLabel = 'Copying was blocked', fallbackHref } = {}) => {
            try {
                await navigator.clipboard.writeText(text);
                toast(label);
            } catch {
                if (fallbackHref) window.location.assign(fallbackHref);
                else toast(failLabel, 'error');
            }
        },
        [toast],
    );
}
