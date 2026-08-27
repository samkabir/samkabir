import { useId, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Box, Typography } from '@mui/material';

import { useUpload } from './useUpload';

/**
 * Drag-and-drop upload for a single file.
 *
 * The generic one — used directly for the CV, and wrapped by `ImageField` for
 * anything with a preview and alt text. Styled to match the site: `#7a61ff`
 * accent on `#141e30`, bordered buttons that fill on hover.
 *
 * These components are written in Phase 5 with the upload endpoint but are first
 * mounted in a real form in Phase 6, so they are kept deliberately dumb: they
 * own the upload and its progress, and hand the resulting `Media` row to
 * `onChange`. Nothing about which entity the file belongs to is known here.
 */
export default function FileField({
  label,
  hint,
  value,
  onChange,
  accept = 'application/pdf',
  disabled = false,
}) {
  const inputId = useId();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const { upload, cancel, progress, error, setError, isUploading } = useUpload();

  const busy = disabled || isUploading;

  async function handleFiles(files) {
    setError(null);
    const file = files?.[0];
    if (!file) return;

    if (files.length > 1) {
      // Rejected rather than silently taking the first: dropping four files and
      // getting one, with no explanation, reads as a bug.
      setError('One file at a time, please.');
      return;
    }

    try {
      onChange(await upload(file));
    } catch {
      // `useUpload` has already put the message in `error`.
    }
  }

  const dropStyles = dragging
    ? 'border-[#7a61ff] bg-[#7a61ff]/10'
    : 'border-[#d2d2d2]/30 hover:border-[#d2d2d2]/60';

  return (
    <Box className="py-4">
      <Typography component="label" htmlFor={inputId} className="block text-[#d2d2d2] text-sm pb-2">
        {label}
      </Typography>

      {hint ? (
        <Typography className="text-[#d2d2d2]/50 text-xs pb-3 leading-relaxed">{hint}</Typography>
      ) : null}

      <Box
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!busy) handleFiles(event.dataTransfer.files);
        }}
        className={`border-2 border-dashed transition duration-300 p-6 text-center ${dropStyles} ${
          busy ? 'opacity-60' : ''
        }`}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          disabled={busy}
          className="hidden"
          onChange={(event) => {
            handleFiles(event.target.files);
            // Reset, so selecting the same file twice in a row still fires
            // onChange — otherwise a failed upload cannot be retried by picking
            // the same file again.
            event.target.value = '';
          }}
        />

        {isUploading ? (
          <Box>
            <Typography className="text-[#d2d2d2] text-sm pb-3">
              Uploading… {progress}%
            </Typography>

            <Box className="h-1 bg-[#d2d2d2]/20 w-full">
              <Box
                className="h-1 bg-[#7a61ff] transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </Box>

            <button
              type="button"
              onClick={cancel}
              className="text-[#d2d2d2]/60 text-xs pt-3 underline hover:text-[#d2d2d2]"
            >
              Cancel
            </button>
          </Box>
        ) : (
          <>
            <Typography className="text-[#d2d2d2]/70 text-sm pb-3">
              Drag a file here, or
            </Typography>

            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="transform transition duration-500 border-2 border-[#7a61ff] py-2 px-5 text-sm font-semibold text-[#7a61ff] hover:text-[#000] hover:bg-[#7a61ff] normal-case disabled:opacity-40"
            >
              choose a file
            </button>
          </>
        )}
      </Box>

      {error ? (
        <Box role="alert" className="border-2 border-[#ff6b6b] text-[#ff9b9b] px-4 py-2 mt-3 text-xs">
          {error}
        </Box>
      ) : null}

      {value ? (
        <Box className="flex items-center justify-between border-2 border-[#d2d2d2]/20 px-4 py-3 mt-3">
          <Box className="min-w-0">
            <Typography className="text-[#d2d2d2] text-sm truncate">
              {value.pathname?.split('/').pop() ?? 'Attached file'}
            </Typography>
            <Typography className="text-[#d2d2d2]/50 text-xs">
              {value.mimeType}
              {value.width ? ` · ${value.width}×${value.height}` : ''}
              {value.sizeBytes ? ` · ${Math.round(value.sizeBytes / 1024)} KB` : ''}
            </Typography>
          </Box>

          {confirming ? (
            <Box className="flex gap-3 shrink-0 pl-4">
              {/* Destructive actions confirm. Removing an attachment is one
                  click from losing the reference, and the file itself is only
                  deleted from the media library, not from here. */}
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  onChange(null);
                }}
                className="text-[#ff9b9b] text-xs font-semibold underline"
              >
                remove
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="text-[#d2d2d2]/60 text-xs underline"
              >
                keep
              </button>
            </Box>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(true)}
              className="text-[#d2d2d2]/60 text-xs underline hover:text-[#ff9b9b] shrink-0 pl-4 disabled:opacity-40"
            >
              remove
            </button>
          )}
        </Box>
      ) : null}
    </Box>
  );
}

const mediaShape = PropTypes.shape({
  id: PropTypes.string,
  url: PropTypes.string,
  pathname: PropTypes.string,
  mimeType: PropTypes.string,
  sizeBytes: PropTypes.number,
  width: PropTypes.number,
  height: PropTypes.number,
  alt: PropTypes.string,
});

FileField.propTypes = {
  label: PropTypes.string.isRequired,
  hint: PropTypes.string,
  value: mediaShape,
  onChange: PropTypes.func.isRequired,
  accept: PropTypes.string,
  disabled: PropTypes.bool,
};

export { mediaShape };
