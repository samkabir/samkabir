import PropTypes from 'prop-types';
import { Box, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';

import { BUTTON_DANGER, BUTTON_QUIET, BUTTON_SM, HINT } from '@/lib/adminTheme';

/**
 * Asks before something irreversible.
 *
 * Two details are deliberate and both are about the same risk — a confirmation
 * dialog that gets dismissed by reflex is worse than no dialog, because it adds
 * a click and removes the pause it was meant to create.
 *
 * **The cancel button holds focus, not confirm.** A dialog that opens with the
 * destructive action focused turns a stray Enter or Space — a keypress already
 * in flight from the button that opened it — into a deletion.
 *
 * **`consequence` says what is lost**, in the caller's own words. "Are you sure?"
 * is unanswerable; "The file is removed from storage as well, and the CV that
 * used it will 404" is a decision.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  consequence,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  danger = true,
  busy = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Dialog
      open={open}
      // Escape and the backdrop both cancel: the safe outcome is the easy one.
      onClose={busy ? undefined : onCancel}
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
    >
      <DialogTitle id="confirm-dialog-title" sx={{ fontWeight: 600 }}>
        {title}
      </DialogTitle>

      <DialogContent>
        <Typography id="confirm-dialog-message" sx={{ color: 'text.primary', fontSize: '0.9rem' }}>
          {message}
        </Typography>

        {consequence ? (
          <Box className="pt-3">
            <Typography className={HINT}>{consequence}</Typography>
          </Box>
        ) : null}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1.5 }}>
        <button type="button" className={BUTTON_QUIET} onClick={onCancel} disabled={busy} autoFocus>
          {cancelLabel}
        </button>

        <button
          type="button"
          className={danger ? BUTTON_DANGER : BUTTON_SM}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
      </DialogActions>
    </Dialog>
  );
}

ConfirmDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  title: PropTypes.string.isRequired,
  message: PropTypes.node.isRequired,
  consequence: PropTypes.node,
  confirmLabel: PropTypes.string,
  cancelLabel: PropTypes.string,
  danger: PropTypes.bool,
  busy: PropTypes.bool,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};
