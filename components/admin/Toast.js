import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Alert, Snackbar } from '@mui/material';

/**
 * The dashboard's transient messages.
 *
 * Used for the outcome of an action the user has already stopped looking at —
 * "Saved", "Deleted", "Order updated". Anything that needs to be *acted on* goes
 * in the page instead, next to the thing it is about: field errors beside their
 * inputs, load failures in the panel that failed to load. A toast is a receipt,
 * not an error report.
 *
 * One message at a time, replacing rather than queueing. A queue means the user
 * waits out three "Saved" messages after dragging three rows, and the last state
 * is the only one that is still true.
 */

const ToastContext = createContext(null);

/**
 * Errors stay until dismissed; everything else clears itself.
 *
 * A failure that disappears after four seconds is a failure the user is not sure
 * happened, and their next move is to repeat the action that just failed.
 */
const AUTO_HIDE = { success: 4000, info: 4000, warning: 8000, error: null };

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  // A counter rather than a timestamp: it remounts the Snackbar so a second
  // message of the same text restarts the timer instead of being ignored.
  const sequence = useRef(0);

  const notify = useCallback((message, severity = 'success') => {
    sequence.current += 1;
    setToast({ message, severity, key: sequence.current });
  }, []);

  const value = useMemo(
    () => ({
      notify,
      /** Convenience for the common pair, so call sites read as intent. */
      notifySaved: (what = 'Saved') => notify(what, 'success'),
      notifyError: (message) => notify(message, 'error'),
      dismiss: () => setToast(null),
    }),
    [notify]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      <Snackbar
        key={toast?.key}
        open={Boolean(toast)}
        autoHideDuration={toast ? AUTO_HIDE[toast.severity] ?? 4000 : null}
        onClose={(event, reason) => {
          // Clicking elsewhere must not dismiss an error the user has not read.
          if (reason === 'clickaway' && toast?.severity === 'error') return;
          setToast(null);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {/* `variant="outlined"` matches the rest of the dashboard, which is
            bordered rather than filled. */}
        <Alert
          severity={toast?.severity ?? 'info'}
          variant="outlined"
          onClose={() => setToast(null)}
          sx={{ bgcolor: 'background.paper', alignItems: 'center' }}
        >
          {toast?.message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}

ToastProvider.propTypes = { children: PropTypes.node };

/**
 * Throws when used outside the provider, rather than returning a no-op.
 *
 * A silently discarded notification is a save that looks like it did nothing,
 * and the mistake — a screen rendered outside `AdminLayout` — is one a developer
 * should hear about immediately.
 */
export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used inside <ToastProvider> — is this page wrapped in AdminLayout?');
  }

  return context;
}
