import { useEffect } from 'react';
import { useRouter } from 'next/router';

/**
 * Warns before a form with unsaved edits is abandoned.
 *
 * Two escape routes exist and they need different handling, which is the whole
 * reason this is a hook rather than one line:
 *
 *   * **Leaving the site** — closing the tab, reloading, following an external
 *     link. `beforeunload` covers it. The browser shows its own wording; a custom
 *     message has been ignored by every browser for years, so `preventDefault`
 *     is all there is to do.
 *
 *   * **Navigating inside the app** — clicking a sidebar link. No browser event
 *     fires for that at all, because the page never unloads. Next's router
 *     announces it as `routeChangeStart`, and the only way to stop it is to throw
 *     — the router has no cancel API, so an exception is the documented mechanism.
 *
 * The throw is caught by the router and surfaces in the console as an unhandled
 * route change. That is noisy but harmless, and the alternative is losing a
 * half-written project description to a mis-click, which is the failure this
 * exists to prevent.
 */
export function useUnsavedChanges(dirty, message = 'You have unsaved changes. Leave without saving?') {
  const router = useRouter();

  useEffect(() => {
    if (!dirty) return undefined;

    const onBeforeUnload = (event) => {
      event.preventDefault();
      // Legacy, and still required by some browsers to trigger the prompt.
      event.returnValue = message;
      return message;
    };

    const onRouteChange = () => {
      if (window.confirm(message)) return;

      // Undo the URL change the router has already made optimistically, so the
      // address bar keeps matching the page that is actually on screen.
      router.events.emit('routeChangeError');
      throw new Error('Route change cancelled — unsaved changes.');
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    router.events.on('routeChangeStart', onRouteChange);

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      router.events.off('routeChangeStart', onRouteChange);
    };
  }, [dirty, message, router]);
}

export default useUnsavedChanges;
