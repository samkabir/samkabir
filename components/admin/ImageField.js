import { useState } from 'react';
import PropTypes from 'prop-types';
import { Box, Typography } from '@mui/material';

import FileField, { mediaShape } from './FileField';

const IMAGE_TYPES = 'image/jpeg,image/png,image/webp,image/gif,image/avif';

/**
 * An image upload, with a preview and alt text.
 *
 * `FileField` does the uploading; this adds the two things that only make sense
 * for images.
 *
 * **Alt text is not optional here.** The API already refuses a blog post whose
 * `coverMediaId` is set without a `coverAlt` — a rule the database cannot
 * express, since both columns are independently nullable — so asking for it at
 * the point the image is chosen means the failure surfaces here rather than as a
 * form error two screens later. The warning below appears as soon as an image
 * exists without a description.
 *
 * A plain `<img>` rather than `next/image`: this is a private dashboard preview
 * of an image whose dimensions are not known until it is uploaded, and
 * `next/image` would run every preview through the optimiser for no benefit. The
 * public site is where `next/image` earns its keep — that migration is Phase 7.
 */
export default function ImageField({
  label,
  hint,
  value,
  onChange,
  altLabel = 'Describe this image',
  requireAlt = true,
  disabled = false,
}) {
  const [alt, setAlt] = useState(value?.alt ?? '');
  const [saving, setSaving] = useState(false);
  const [altError, setAltError] = useState(null);

  /**
   * Resets the field when a *different* image is attached, so one image's
   * description is never silently carried over to another.
   *
   * Adjusted during render rather than in an effect. React's own lint rule flags
   * `setState` inside an effect for good reason: the effect runs after the
   * browser has already painted the stale value, so the field visibly shows the
   * previous image's text for a frame before correcting itself. Comparing against
   * the last id seen re-renders before anything is shown.
   */
  const [lastId, setLastId] = useState(value?.id ?? null);

  if ((value?.id ?? null) !== lastId) {
    setLastId(value?.id ?? null);
    setAlt(value?.alt ?? '');
    setAltError(null);
  }

  /**
   * Persists the description to the Media row.
   *
   * On blur rather than on every keystroke — one PATCH per word typed would be
   * absurd — and only when it actually changed.
   */
  async function saveAlt() {
    if (!value?.id || alt === (value.alt ?? '')) return;

    setSaving(true);
    setAltError(null);

    try {
      const response = await fetch(`/api/admin/media/${value.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ alt }),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        setAltError(body?.error?.fields?.alt ?? body?.error?.message ?? 'Could not save.');
        return;
      }

      onChange(body.item);
    } catch {
      setAltError('Could not save the description. Check your connection.');
    } finally {
      setSaving(false);
    }
  }

  const missingAlt = requireAlt && value && !alt.trim();

  return (
    <Box>
      <FileField
        label={label}
        hint={hint}
        value={value}
        onChange={onChange}
        accept={IMAGE_TYPES}
        disabled={disabled}
      />

      {value?.url ? (
        <Box className="pb-2">
          <Box className="border-2 border-[#d2d2d2]/20 p-2 inline-block max-w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value.url}
              alt={alt || 'Uploaded image, no description yet'}
              className="max-h-48 max-w-full block"
            />
          </Box>

          <Box className="pt-4">
            <label
              htmlFor={`alt-${value.id}`}
              className="block text-[#d2d2d2] text-sm pb-2"
            >
              {altLabel}
              {requireAlt ? <span className="text-[#7a61ff]"> *</span> : null}
            </label>

            <input
              id={`alt-${value.id}`}
              type="text"
              value={alt}
              disabled={disabled || saving}
              onChange={(event) => setAlt(event.target.value)}
              onBlur={saveAlt}
              placeholder="A laptop on a desk showing the dashboard"
              className="w-full bg-transparent border-2 border-[#d2d2d2]/30 focus:border-[#7a61ff] outline-none text-[#d2d2d2] px-4 py-2 text-sm transition duration-300 disabled:opacity-50"
            />

            <Typography className="text-[#d2d2d2]/50 text-xs pt-2 leading-relaxed">
              {saving
                ? 'Saving…'
                : 'Read aloud by screen readers, and shown if the image fails to load. Describe what it shows, not that it is an image.'}
            </Typography>

            {altError ? (
              <Typography role="alert" className="text-[#ff9b9b] text-xs pt-2">
                {altError}
              </Typography>
            ) : null}

            {missingAlt && !altError ? (
              <Typography className="text-[#ffd08b] text-xs pt-2">
                This image has no description yet. A blog post cover cannot be saved without one.
              </Typography>
            ) : null}
          </Box>
        </Box>
      ) : null}
    </Box>
  );
}

ImageField.propTypes = {
  label: PropTypes.string.isRequired,
  hint: PropTypes.string,
  value: mediaShape,
  onChange: PropTypes.func.isRequired,
  altLabel: PropTypes.string,
  requireAlt: PropTypes.bool,
  disabled: PropTypes.bool,
};
