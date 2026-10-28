import LinkedInIcon from '@mui/icons-material/LinkedIn';
import LinkIcon from '@mui/icons-material/Link';
import { useState } from 'react';

/**
 * Share links for a post.
 *
 * Plain links to each network's share endpoint rather than their official
 * widgets. A widget means a third-party script on every post page, which is a
 * tracker, a render-blocking request and something that can change what it does
 * after you ship it. A link is a link.
 *
 * `X` is spelled out as a link too rather than imported from `@mui/icons-material`
 * — MUI 5.11 predates the rename and ships only `Twitter`, whose bird would be
 * wrong now.
 *
 * The copy button uses the async clipboard API, which needs a secure context and
 * a user gesture. It has both here, but it can still be refused by permissions
 * policy, so the failure is reported rather than silently swallowed — a copy
 * button that appears to work and copies nothing is worse than none.
 */
export default function ShareRow({ url, title }) {
  const [copied, setCopied] = useState(null);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const targets = [
    {
      key: 'x',
      label: 'Share on X',
      href: `https://x.com/intent/post?url=${encodedUrl}&text=${encodedTitle}`,
      // MUI 5.11 has no X icon; the glyph is close enough and needs no dependency.
      glyph: <span className="font-semibold text-[17px] leading-none">𝕏</span>,
    },
    {
      key: 'linkedin',
      label: 'Share on LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      glyph: <LinkedInIcon style={{ fontSize: 18 }} />,
    },
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const button =
    'grid place-items-center w-9 h-9 rounded-full border border-ss-line text-ss-muted hover:text-ss-fg hover:border-ss-faint transition-colors';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="ss-mono text-ss-faint mr-2">Share</span>

      {targets.map((target) => (
        <a
          key={target.key}
          href={target.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={target.label}
          title={target.label}
          className={button}
        >
          {target.glyph}
        </a>
      ))}

      <button
        type="button"
        onClick={copy}
        aria-label="Copy this post's link"
        title="Copy this post's link"
        className={button}
      >
        <LinkIcon style={{ fontSize: 18 }} />
      </button>

      {/* `aria-live` so the outcome is announced, not only shown. */}
      <span className="ml-2 text-[13px] text-ss-accent" aria-live="polite">
        {copied === true ? 'Copied' : copied === false ? 'Copying was blocked — select the URL instead' : ''}
      </span>
    </div>
  );
}
