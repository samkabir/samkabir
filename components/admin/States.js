import PropTypes from 'prop-types';
import { Box, Typography } from '@mui/material';

import { BANNER_ERROR, BUTTON_SM, HINT, PANEL } from '@/lib/adminTheme';

/**
 * The three states a list is in when it is not showing a list.
 *
 * Every screen needs all three and they are easy to leave out, because during
 * development the data is always there and the request always succeeds. The
 * three failures they prevent, in order of how confusing they are:
 *
 *   * **Loading with nothing rendered** looks like an empty list. The user's
 *     conclusion is that their content is gone.
 *   * **Empty with nothing rendered** looks like a broken screen, and gives no
 *     hint about how to add the first item.
 *   * **Failed with nothing rendered** is the worst of the three: identical to
 *     empty, so the user starts re-entering content that already exists.
 */

/**
 * Grey bars in the shape of the rows that are coming.
 *
 * Sized to the real content so the page does not jump when the data lands. The
 * animation is Tailwind's `animate-pulse`, which respects
 * `prefers-reduced-motion` at the browser level for users who ask it to.
 */
export function LoadingRows({ rows = 3, label = 'Loading…' }) {
  return (
    <Box role="status" aria-live="polite" aria-busy="true">
      {/* Screen readers get a sentence; sighted users get the bars. */}
      <span className="sr-only">{label}</span>

      {Array.from({ length: rows }, (_, index) => (
        <Box key={index} className={`${PANEL} px-4 py-4 mb-2 animate-pulse`}>
          <Box className="h-3 bg-[#d2d2d2]/20 w-1/3 mb-2" />
          <Box className="h-2 bg-[#d2d2d2]/10 w-1/2" />
        </Box>
      ))}
    </Box>
  );
}

LoadingRows.propTypes = { rows: PropTypes.number, label: PropTypes.string };

/**
 * Nothing here yet — with the reason and the way out.
 *
 * `filtered` distinguishes the two empties that look identical and mean opposite
 * things: a section with no content, and a search that matched nothing. Telling
 * the user to "add the first one" when they have forty items and a typo in the
 * search box is how a dashboard loses trust.
 */
export function EmptyState({ title, message, action, filtered = false }) {
  return (
    <Box className={`${PANEL} px-6 py-10 text-center`}>
      <Typography className="text-[#d2d2d2] pb-2">{title}</Typography>

      {message ? (
        <Typography className={`${HINT} max-w-md mx-auto pb-4`}>{message}</Typography>
      ) : null}

      {!filtered && action ? action : null}
    </Box>
  );
}

EmptyState.propTypes = {
  title: PropTypes.string.isRequired,
  message: PropTypes.string,
  action: PropTypes.node,
  filtered: PropTypes.bool,
};

/**
 * A failed load, with a retry.
 *
 * The retry button is the point. Most failures here are a suspended Neon
 * instance waking up or a dropped connection, and both are fixed by asking
 * again — so the fix belongs on the screen rather than in an instruction to
 * reload the page and lose whatever else was in progress.
 */
export function ErrorState({ message, onRetry }) {
  return (
    <Box role="alert" className={`${BANNER_ERROR} flex flex-wrap items-center justify-between gap-4`}>
      <span>{message}</span>

      {onRetry ? (
        <button type="button" className={BUTTON_SM} onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </Box>
  );
}

ErrorState.propTypes = { message: PropTypes.string.isRequired, onRetry: PropTypes.func };

/** A section heading with optional right-hand action, used by every panel. */
export function PanelHeading({ title, hint, action, number }) {
  return (
    <Box className="flex flex-wrap items-end justify-between gap-4 pb-4">
      <Box>
        <Typography variant="subtitle1" className="font-semibold text-[#7a61ff]">
          {number ? <span>{number} </span> : null}
          {title}
        </Typography>

        {hint ? <Typography className={`${HINT} pt-1 max-w-2xl`}>{hint}</Typography> : null}
      </Box>

      {action ? <Box className="shrink-0">{action}</Box> : null}
    </Box>
  );
}

PanelHeading.propTypes = {
  title: PropTypes.string.isRequired,
  hint: PropTypes.string,
  action: PropTypes.node,
  number: PropTypes.string,
};
