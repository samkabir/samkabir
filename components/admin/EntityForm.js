import { useState } from 'react';
import PropTypes from 'prop-types';
import { Box, Dialog, DialogContent, DialogTitle, Typography } from '@mui/material';

import { BANNER_ERROR, BUTTON, BUTTON_QUIET, HINT } from '@/lib/adminTheme';
import {
  changedFields,
  formValues,
  hasChanges,
  mergeFieldErrors,
  toPayload,
  validateWith,
} from '@/lib/adminForm';

import FormField, { fieldShape } from './FormField';
import useUnsavedChanges from './useUnsavedChanges';

/**
 * A form over a field descriptor list and a Zod schema.
 *
 * Three things it does that a hand-written form on each screen would have to do
 * ten times, and would eventually do differently:
 *
 *   1. **Validates with the endpoint's own schema.** Not a copy of it — the same
 *      module, imported. Two validators drift, and the drift always presents as
 *      "the form accepted it and the server rejected it", which reads as a bug in
 *      saving rather than a difference of opinion about a field.
 *
 *   2. **Sends only what changed, on an update.** Required by the API, which
 *      rejects an empty PATCH and audits what it receives — a body carrying every
 *      field writes a log entry claiming twelve changes when one was made. It also
 *      means a field edited in another tab is not clobbered by the value this form
 *      loaded.
 *
 *   3. **Puts server field errors back on their inputs.** Uniqueness, foreign
 *      keys and cross-row rules can only be checked server-side, so "Already
 *      taken." arrives from the endpoint and has to find its way to the slug
 *      input rather than into a toast.
 *
 * `mode` picks between the three request shapes the API has:
 *
 *   * `create` — full body, create schema, POST.
 *   * `update` — changed fields only, update schema, PATCH.
 *   * `replace` — full body, full schema, PUT. Singletons only: `/profile` and
 *     `/seo` upsert one row and have no partial form.
 */
export default function EntityForm({
  fields,
  item = null,
  schema,
  mode = 'create',
  onSubmit,
  onCancel,
  submitLabel,
  description,
  columns = 1,
  guardUnsaved = true,
  createDefaults = null,
}) {
  const initialValues = formValues(item, fields);

  const [values, setValues] = useState(initialValues);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  /**
   * Re-seeds the form when it is pointed at a different record.
   *
   * Compared during render rather than in an effect: an effect runs after the
   * browser has painted, so the previous record's values would be visible for a
   * frame — and if the user typed in that frame, their keystroke would be
   * discarded by the reset that followed. Same technique, and the same reason, as
   * `ImageField`.
   */
  const [lastId, setLastId] = useState(item?.id ?? null);

  if ((item?.id ?? null) !== lastId) {
    setLastId(item?.id ?? null);
    setValues(formValues(item, fields));
    setFieldErrors({});
    setFormError(null);
  }

  const initialPayload = toPayload(initialValues, fields);
  const payload = toPayload(values, fields);
  const dirty = hasChanges(initialPayload, payload);

  // Only while the form is genuinely unsaved. Registering the guard
  // unconditionally would prompt on every navigation away from a screen whose
  // form was merely open.
  useUnsavedChanges(guardUnsaved && dirty && !saving);

  const setValue = (name, value) => {
    setValues((current) => ({ ...current, [name]: value }));
    // Clearing the error as soon as the field is touched: leaving it in place
    // while the user fixes it means the message contradicts what they are
    // looking at.
    setFieldErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  /**
   * Finds the message for a field.
   *
   * Zod reports nested paths dot-joined — `responsibilities.0` for the first
   * entry of a list — so an exact lookup would miss it and the error would
   * vanish. The prefix match puts it on the field that owns the list.
   */
  const errorFor = (name) => {
    if (fieldErrors[name]) return fieldErrors[name];

    const nested = Object.keys(fieldErrors).find((key) => key.startsWith(`${name}.`));
    return nested ? fieldErrors[nested] : undefined;
  };

  async function handleSubmit(event) {
    event.preventDefault();

    setFieldErrors({});
    setFormError(null);

    // An update with nothing changed is not an error and not a request: the API
    // rejects an empty PATCH, and there is nothing to save.
    if (mode === 'update' && !dirty) {
      onCancel?.();
      return;
    }

    /**
     * Values the form does not show but the record needs.
     *
     * `order` is the case: a new row belongs at the end of the list, and the
     * schema's default of `0` would put it at the top and silently renumber
     * everything already there. Merged *before* validation rather than added to
     * the request afterwards — a field that skips the client-side schema is a
     * field whose first validation happens on the server, which is the split this
     * project exists to avoid.
     */
    const body =
      mode === 'update'
        ? changedFields(initialPayload, payload)
        : { ...payload, ...(createDefaults ?? {}) };

    const validated = validateWith(schema, body);

    if (!validated.ok) {
      setFieldErrors(validated.fields);
      // `_` is where a whole-object rule lands — a cross-field check with no
      // single input to blame.
      setFormError(validated.fields._ ?? 'Some fields need attention.');
      return;
    }

    setSaving(true);

    try {
      // The raw body, not Zod's parsed output. The schema's transforms produce
      // `Date` objects and Prisma-shaped values for the *server*; sending those
      // through JSON would post `"2025-07-14T12:00:00.000Z"` where the endpoint's
      // own schema expects `"2025-07-14"`, and it would be rejected by the
      // validator that just passed it.
      await onSubmit(body);
    } catch (problem) {
      if (problem?.fields) {
        setFieldErrors(mergeFieldErrors(null, problem.fields));
      }
      setFormError(problem?.message ?? 'That could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {description ? <Typography className={`${HINT} pb-4`}>{description}</Typography> : null}

      {formError ? (
        <Box role="alert" className={`${BANNER_ERROR} mb-4`}>
          {formError}
        </Box>
      ) : null}

      <Box
        className={
          columns === 2 ? 'grid grid-cols-1 md:grid-cols-2 gap-x-6' : 'grid grid-cols-1'
        }
      >
        {fields.map((field) => (
          <Box key={field.name} className={field.fullWidth && columns === 2 ? 'md:col-span-2' : ''}>
            <FormField
              field={field}
              value={values[field.name]}
              onChange={(value) => setValue(field.name, value)}
              error={errorFor(field.name)}
              disabled={saving}
            />
          </Box>
        ))}
      </Box>

      <Box className="flex flex-wrap items-center gap-3 pt-6">
        <button type="submit" className={BUTTON} disabled={saving || (mode !== 'create' && !dirty)}>
          {saving ? 'Saving…' : submitLabel ?? (mode === 'create' ? 'Add' : 'Save changes')}
        </button>

        {onCancel ? (
          <button type="button" className={BUTTON_QUIET} onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        ) : null}

        {dirty && !saving ? (
          <Typography className={HINT}>Unsaved changes.</Typography>
        ) : null}
      </Box>
    </form>
  );
}

EntityForm.propTypes = {
  fields: PropTypes.arrayOf(fieldShape).isRequired,
  item: PropTypes.object,
  schema: PropTypes.object.isRequired,
  mode: PropTypes.oneOf(['create', 'update', 'replace']),
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
  submitLabel: PropTypes.string,
  description: PropTypes.string,
  columns: PropTypes.oneOf([1, 2]),
  guardUnsaved: PropTypes.bool,
  createDefaults: PropTypes.object,
};

/**
 * The same form, in a dialog — how every list screen adds and edits.
 *
 * The dialog is remounted per record via `key`, so switching from editing one row
 * to another cannot carry state across. That is belt-and-braces alongside the
 * `lastId` reset above: the reset handles the same dialog being pointed at a new
 * record, the key handles the dialog being closed and reopened.
 */
export function EntityFormDialog({ open, title, onClose, ...formProps }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" aria-labelledby="entity-form-title">
      <DialogTitle id="entity-form-title" sx={{ fontWeight: 600 }}>
        {title}
      </DialogTitle>

      <DialogContent>
        <EntityForm key={formProps.item?.id ?? 'new'} {...formProps} onCancel={onClose} />
      </DialogContent>
    </Dialog>
  );
}

EntityFormDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  title: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
  item: PropTypes.object,
};
