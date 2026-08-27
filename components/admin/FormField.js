import { useId } from 'react';
import PropTypes from 'prop-types';
import { Box, Typography } from '@mui/material';

import {
  ERROR_TEXT,
  HINT,
  INPUT,
  INPUT_INVALID,
  INPUT_SM,
  LABEL,
} from '@/lib/adminTheme';

import ArrayField from './ArrayField';
import FileField from './FileField';
import ImageField from './ImageField';

/**
 * One field of a form, chosen by its declared type.
 *
 * The alternative — a bespoke input per field per screen — is how a dashboard
 * ends up with a required marker on six of nine forms, an error message that
 * renders in one place and not another, and a label that is not associated with
 * its input on the two screens nobody tested with a keyboard. Here every field
 * gets the same label/hint/error scaffolding because there is one implementation
 * of it.
 *
 * The field types map onto the validation primitives rather than onto HTML input
 * types, which is why `slug` and `year` exist as their own types: they carry
 * specific guidance and specific keyboard behaviour, and the schema on the other
 * end has a specific message for each.
 */

/** Wraps any control with its label, hint, error and required marker. */
function FieldShell({ id, label, hint, error, required, children, counter }) {
  return (
    <Box className="py-3">
      <Box className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className={LABEL}>
          {label}
          {required ? (
            <span className="text-[#7a61ff]" aria-hidden="true">
              {' '}
              *
            </span>
          ) : null}
        </label>

        {counter ? <span className={HINT}>{counter}</span> : null}
      </Box>

      {children}

      {hint && !error ? <Typography className={`${HINT} pt-2`}>{hint}</Typography> : null}

      {error ? (
        // The id matches the `aria-describedby` every control sets, so a screen
        // reader reads the message as part of the field rather than as a stray
        // line of text after it.
        <Typography role="alert" id={`${id}-error`} className={`${ERROR_TEXT} pt-2`}>
          {error}
        </Typography>
      ) : null}
    </Box>
  );
}

FieldShell.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  hint: PropTypes.string,
  error: PropTypes.string,
  required: PropTypes.bool,
  children: PropTypes.node,
  counter: PropTypes.string,
};

export default function FormField({ field, value, onChange, error, disabled = false }) {
  const generatedId = useId();
  const id = `${generatedId}-${field.name}`;
  const inputClass = `${field.small ? INPUT_SM : INPUT} ${error ? INPUT_INVALID : ''}`;

  const shared = {
    id,
    name: field.name,
    disabled: disabled || field.disabled,
    // Points a screen reader at the message this field's error is rendered in,
    // and marks the field itself as invalid rather than relying on the red border.
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': error ? `${id}-error` : undefined,
  };

  switch (field.type) {
    /**
     * A `String[]` column. Delegated wholesale — the reordering and focus
     * behaviour is enough code to be its own component, and it is the one field
     * type whose label cannot be tied to a single input.
     */
    case 'list':
      return (
        <ArrayField
          label={field.label}
          hint={field.hint}
          value={value}
          onChange={onChange}
          error={error}
          itemLabel={field.itemLabel}
          max={field.max ?? 30}
          placeholder={field.placeholder}
          disabled={disabled || field.disabled}
        />
      );

    /**
     * Images and files hold a whole `Media` row as their value, not an id — the
     * preview needs the url and the alt text. `toPayload` in `lib/adminForm.js`
     * reduces it to `field.name` on the way to the server.
     */
    case 'image':
      return (
        <Box>
          <ImageField
            label={field.label}
            hint={field.hint}
            value={value}
            onChange={onChange}
            requireAlt={field.requireAlt ?? false}
            altLabel={field.altLabel}
            disabled={disabled || field.disabled}
          />
          {error ? (
            <Typography role="alert" className={ERROR_TEXT}>
              {error}
            </Typography>
          ) : null}
        </Box>
      );

    case 'file':
      return (
        <Box>
          <FileField
            label={field.label}
            hint={field.hint}
            value={value}
            onChange={onChange}
            accept={field.accept}
            disabled={disabled || field.disabled}
          />
          {error ? (
            <Typography role="alert" className={ERROR_TEXT}>
              {error}
            </Typography>
          ) : null}
        </Box>
      );

    /**
     * A checkbox, labelled to its right rather than above.
     *
     * Its own shape because the shell's layout is wrong for it: a checkbox with
     * a label on the line above reads as a heading with an orphaned box under it,
     * and the clickable area shrinks to 16 pixels.
     */
    case 'checkbox':
      return (
        <Box className="py-3">
          <label htmlFor={id} className="flex items-start gap-3 cursor-pointer">
            <input
              {...shared}
              type="checkbox"
              checked={Boolean(value)}
              onChange={(event) => onChange(event.target.checked)}
              className="mt-1 h-4 w-4 accent-[#7a61ff] shrink-0"
            />

            <span>
              <span className="text-[#d2d2d2] text-sm block">{field.label}</span>
              {field.hint ? (
                <span className={`${HINT} block pt-1`}>{field.hint}</span>
              ) : null}
            </span>
          </label>

          {error ? (
            <Typography role="alert" id={`${id}-error`} className={`${ERROR_TEXT} pt-2`}>
              {error}
            </Typography>
          ) : null}
        </Box>
      );

    case 'select':
      return (
        <FieldShell id={id} label={field.label} hint={field.hint} error={error} required={field.required}>
          <select
            {...shared}
            value={value ?? ''}
            onChange={(event) => onChange(event.target.value)}
            className={inputClass}
          >
            {/* An explicit empty option only where empty is allowed, so a
                required select cannot silently post nothing. */}
            {field.required ? null : <option value="">{field.emptyLabel ?? '—'}</option>}

            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FieldShell>
      );

    case 'textarea':
    case 'markdown': {
      const length = String(value ?? '').length;

      return (
        <FieldShell
          id={id}
          label={field.label}
          hint={field.hint}
          error={error}
          required={field.required}
          counter={field.max ? `${length} / ${field.max}` : undefined}
        >
          <textarea
            {...shared}
            value={value ?? ''}
            rows={field.rows ?? (field.type === 'markdown' ? 18 : 4)}
            onChange={(event) => onChange(event.target.value)}
            // Monospace for Markdown, because the alignment of a fenced block or
            // a table is part of the content.
            className={`${inputClass} ${field.type === 'markdown' ? 'font-mono text-sm' : ''}`}
          />
        </FieldShell>
      );
    }

    case 'number':
    case 'year':
      return (
        <FieldShell id={id} label={field.label} hint={field.hint} error={error} required={field.required}>
          <input
            {...shared}
            type="number"
            value={value ?? ''}
            min={field.min}
            max={field.max}
            step={1}
            // Kept as a string in state and converted by `toPayload`. Converting
            // here would turn a half-typed "20" into 20 and fight the user's
            // next keystroke.
            onChange={(event) => onChange(event.target.value)}
            className={inputClass}
          />
        </FieldShell>
      );

    case 'date':
      return (
        <FieldShell id={id} label={field.label} hint={field.hint} error={error} required={field.required}>
          <input
            {...shared}
            type="date"
            value={value ?? ''}
            onChange={(event) => onChange(event.target.value)}
            // The native picker renders its own icon in the browser's colours,
            // which on a dark field is a black glyph on dark blue.
            className={`${inputClass} [color-scheme:dark]`}
          />
        </FieldShell>
      );

    case 'slug':
      return (
        <FieldShell
          id={id}
          label={field.label}
          hint={field.hint ?? 'Lowercase letters, numbers and single hyphens. Leave empty to derive it from the title.'}
          error={error}
          required={field.required}
        >
          <input
            {...shared}
            type="text"
            value={value ?? ''}
            // Not `autoCapitalize` alone: a slug is lowercase by definition and
            // the schema rejects anything else, so the field prevents the mistake
            // rather than reporting it.
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            onChange={(event) => onChange(event.target.value.toLowerCase())}
            className={`${inputClass} font-mono text-sm`}
          />
        </FieldShell>
      );

    default:
      return (
        <FieldShell
          id={id}
          label={field.label}
          hint={field.hint}
          error={error}
          required={field.required}
          counter={field.max && field.showCounter ? `${String(value ?? '').length} / ${field.max}` : undefined}
        >
          <input
            {...shared}
            type={field.inputType ?? 'text'}
            value={value ?? ''}
            placeholder={field.placeholder}
            autoComplete={field.autoComplete ?? 'off'}
            onChange={(event) => onChange(event.target.value)}
            className={inputClass}
          />
        </FieldShell>
      );
  }
}

/** The shape of a field descriptor, shared by every screen's form definition. */
export const fieldShape = PropTypes.shape({
  name: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  type: PropTypes.string,
  hint: PropTypes.string,
  required: PropTypes.bool,
  options: PropTypes.array,
  max: PropTypes.number,
  min: PropTypes.number,
  rows: PropTypes.number,
});

FormField.propTypes = {
  field: fieldShape.isRequired,
  // Anything a field can hold: a string, a boolean, an array, a Media row.
  value: PropTypes.any,
  onChange: PropTypes.func.isRequired,
  error: PropTypes.string,
  disabled: PropTypes.bool,
};
