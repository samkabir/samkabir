import { Box, Typography } from '@mui/material';
import { useId, useState } from 'react';

import BlogPostBody from '../Blog/BlogPostBody';
import { estimateReadingMinutes } from '../../lib/blog';
import { BUTTON_QUIET_XS, ERROR_TEXT, HINT, INPUT, INPUT_INVALID, LABEL } from '../../lib/adminTheme';

/**
 * The Markdown editor: a textarea, and a preview that is the real thing.
 *
 * **The preview renders through `BlogPostBody`** — the same component, the same
 * sanitiser, the same element mapping the public page uses. That is the entire
 * reason this is worth building rather than shipping a bare textarea. A preview
 * with its own renderer is a second implementation that will disagree with the
 * first, and the disagreement always surfaces after publishing: the author sees
 * their table render in the dashboard and a wall of pipes on the site.
 *
 * It also means the preview shows sanitisation happening. Paste a `<script>` tag
 * and watch it vanish before publishing rather than afterwards.
 *
 * Write / Preview / Split rather than always-split: split is the useful mode on a
 * wide screen and useless on a laptop at 1280px, where two 40-column panes are
 * worse than one 80-column one. The default is Write, because that is what the
 * screen is for.
 */
const MODES = [
  { key: 'write', label: 'Write' },
  { key: 'preview', label: 'Preview' },
  { key: 'split', label: 'Split' },
];

export default function MarkdownEditor({
  value,
  onChange,
  error,
  disabled = false,
  label = 'Content',
  required = false,
  max,
  rows = 22,
}) {
  const [mode, setMode] = useState('write');
  const id = useId();

  const text = value ?? '';
  const words = text.split(/\s+/).filter(Boolean).length;

  /**
   * Recomputed here from the same function the server uses.
   *
   * `readingMinutes` is not a form field — the API derives it from the Markdown
   * on every save so the two can never disagree. Showing the estimate live means
   * the author knows what will be stored without having to save to find out.
   */
  const minutes = estimateReadingMinutes(text);

  const showWrite = mode === 'write' || mode === 'split';
  const showPreview = mode === 'preview' || mode === 'split';

  return (
    <Box className="w-full">
      <Box className="flex flex-wrap items-baseline justify-between gap-2 pb-1">
        <label htmlFor={id} className={LABEL}>
          {label}
          {required ? <span className="text-[#ff9b9b]"> *</span> : null}
        </label>

        <Box className="flex items-center gap-3">
          <Typography className={HINT}>
            {words} {words === 1 ? 'word' : 'words'} · {minutes} min read
            {max ? ` · ${text.length} / ${max}` : ''}
          </Typography>

          <Box className="flex items-center gap-1" role="group" aria-label="Editor mode">
            {MODES.map((option) => (
              <button
                key={option.key}
                type="button"
                // `aria-pressed` rather than colour alone: which mode is active
                // has to be available to a screen reader too.
                aria-pressed={mode === option.key}
                className={`${BUTTON_QUIET_XS} ${
                  mode === option.key ? 'text-[#7a61ff] border-[#7a61ff]' : ''
                }`}
                onClick={() => setMode(option.key)}
              >
                {option.label}
              </button>
            ))}
          </Box>
        </Box>
      </Box>

      <Box className={mode === 'split' ? 'grid lg:grid-cols-2 gap-3' : ''}>
        {showWrite ? (
          <textarea
            id={id}
            value={text}
            rows={rows}
            disabled={disabled}
            aria-invalid={error ? 'true' : undefined}
            onChange={(event) => onChange(event.target.value)}
            // Monospace, because the alignment of a fenced block or a table is
            // part of the content. `resize-y` so a long post is not edited
            // through a letterbox.
            className={`${error ? INPUT_INVALID : INPUT} font-mono text-sm resize-y`}
          />
        ) : null}

        {showPreview ? (
          <Box
            className={`border border-[#d2d2d2]/20 px-4 py-3 overflow-y-auto ${
              mode === 'split' ? '' : 'min-h-[24rem]'
            }`}
            style={mode === 'split' ? { maxHeight: `${rows * 1.5}rem` } : undefined}
          >
            {text.trim() ? (
              <BlogPostBody markdown={text} />
            ) : (
              <Typography className={HINT}>
                Nothing to preview yet. The preview renders exactly what the
                public page will, through the same sanitiser.
              </Typography>
            )}
          </Box>
        ) : null}
      </Box>

      {error ? <Typography className={ERROR_TEXT}>{error}</Typography> : null}
    </Box>
  );
}
