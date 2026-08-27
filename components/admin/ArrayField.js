import { useRef } from 'react';
import PropTypes from 'prop-types';
import { Box, Typography } from '@mui/material';

import {
  BUTTON_QUIET_XS,
  BUTTON_XS,
  ERROR_TEXT,
  HINT,
  INPUT_SM,
  LABEL,
} from '@/lib/adminTheme';

/**
 * Editor for a `String[]` column — a role's responsibilities, a project's stack.
 *
 * Reordering is by button, not by drag. These are short lists inside a form, and
 * buttons are the only version that works with a keyboard, which the brief asks
 * for by name. Drag-and-drop is used for the entity lists, where the rows are
 * tall enough to grab and there is a keyboard path alongside it.
 *
 * Blank rows are kept in the form and dropped by the schema: `stringList()`
 * filters falsy entries. That pairing is deliberate — an empty last row is the
 * natural state of a repeating field, and failing the whole save because of one
 * would be obnoxious.
 */
export default function ArrayField({
  label,
  hint,
  value,
  onChange,
  error,
  itemLabel = 'entry',
  max = 30,
  placeholder,
  disabled = false,
}) {
  const items = Array.isArray(value) ? value : [];
  // Holds the row inputs so a newly added one can take focus. Without this,
  // adding an entry means clicking Add and then clicking the field that appeared.
  const inputsRef = useRef([]);

  const commit = (next, focusIndex = null) => {
    onChange(next);
    if (focusIndex !== null) {
      // After the re-render. The row does not exist yet at this point in the
      // event handler.
      requestAnimationFrame(() => inputsRef.current[focusIndex]?.focus());
    }
  };

  const setAt = (index, text) => {
    const next = [...items];
    next[index] = text;
    commit(next);
  };

  const removeAt = (index) => {
    const next = items.filter((_, position) => position !== index);
    // Focus the row that took the removed one's place, or the last one if the
    // removed row was at the end.
    commit(next, next.length === 0 ? null : Math.min(index, next.length - 1));
  };

  const move = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;

    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next, target);
  };

  const add = () => {
    if (items.length >= max) return;
    commit([...items, ''], items.length);
  };

  return (
    <Box className="py-4">
      <Typography component="span" className={LABEL}>
        {label}
      </Typography>

      {hint ? <Typography className={`${HINT} pb-3`}>{hint}</Typography> : null}

      {items.length === 0 ? (
        <Typography className={`${HINT} pb-3`}>No {itemLabel} entries yet.</Typography>
      ) : null}

      <ul className="list-none p-0 m-0">
        {items.map((item, index) => (
          // The index is the identity here: these are plain strings with no id,
          // and two identical entries are legal. A key derived from the value
          // would collide and make React reuse the wrong input.
          <li key={index} className="flex items-start gap-2 pb-2">
            <input
              ref={(node) => {
                inputsRef.current[index] = node;
              }}
              type="text"
              value={item}
              disabled={disabled}
              placeholder={placeholder}
              aria-label={`${label} ${index + 1}`}
              onChange={(event) => setAt(index, event.target.value)}
              onKeyDown={(event) => {
                // Enter on the last row adds the next one, so a list can be typed
                // without reaching for the mouse. Enter inside a form would
                // otherwise submit it, which is why this stops the event.
                if (event.key === 'Enter') {
                  event.preventDefault();
                  if (index === items.length - 1) add();
                  else inputsRef.current[index + 1]?.focus();
                }
              }}
              className={INPUT_SM}
            />

            <Box className="flex gap-1 shrink-0 pt-1">
              <button
                type="button"
                className={BUTTON_QUIET_XS}
                onClick={() => move(index, -1)}
                disabled={disabled || index === 0}
                aria-label={`Move ${itemLabel} ${index + 1} up`}
                title="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                className={BUTTON_QUIET_XS}
                onClick={() => move(index, 1)}
                disabled={disabled || index === items.length - 1}
                aria-label={`Move ${itemLabel} ${index + 1} down`}
                title="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                className={BUTTON_QUIET_XS}
                onClick={() => removeAt(index)}
                disabled={disabled}
                aria-label={`Remove ${itemLabel} ${index + 1}`}
                title="Remove"
              >
                ✕
              </button>
            </Box>
          </li>
        ))}
      </ul>

      <Box className="flex items-center gap-3 pt-1">
        <button
          type="button"
          className={BUTTON_XS}
          onClick={add}
          disabled={disabled || items.length >= max}
        >
          Add {itemLabel}
        </button>

        <Typography className={HINT}>
          {items.length} of {max}
        </Typography>
      </Box>

      {error ? (
        <Typography role="alert" className={`${ERROR_TEXT} pt-2`}>
          {error}
        </Typography>
      ) : null}
    </Box>
  );
}

ArrayField.propTypes = {
  label: PropTypes.string.isRequired,
  hint: PropTypes.string,
  value: PropTypes.arrayOf(PropTypes.string),
  onChange: PropTypes.func.isRequired,
  error: PropTypes.string,
  itemLabel: PropTypes.string,
  max: PropTypes.number,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
};
