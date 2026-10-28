import LinkedInIcon from '@mui/icons-material/LinkedIn';
import { useCopy } from '../site/feedback';
import * as Icon from '../site/icons';

/**
 * Share links for a post.
 *
 * Plain links to each network's share endpoint rather than their official
 * widgets. A widget means a third-party script on every post page, which is a
 * tracker, a render-blocking request and something that can change what it does
 * after you ship it. A link is a link.
 *
 * `X` is spelled out as a glyph rather than imported from `@mui/icons-material`
 * — MUI 5.11 predates the rename and ships only `Twitter`, whose bird would be
 * wrong now.
 *
 * The copy button uses the async clipboard API, which needs a secure context and
 * a user gesture. It can still be refused by permissions policy, so the outcome
 * is announced either way (the site's toast is a live region) — a copy button
 * that appears to work and copies nothing is worse than none.
 */
export default function ShareRow({ url, title }) {
  const copy = useCopy();

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const targets = [
    {
      key: 'x',
      label: 'Share on X',
      href: `https://x.com/intent/post?url=${encodedUrl}&text=${encodedTitle}`,
      glyph: <span className="font-semibold text-[17px] leading-none">𝕏</span>,
    },
    {
      key: 'linkedin',
      label: 'Share on LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      glyph: <LinkedInIcon style={{ fontSize: 18 }} />,
    },
  ];

  const button =
    'grid place-items-center w-11 h-11 rounded-full shadow-[inset_0_0_0_1px_var(--mo-line)] text-mo-muted hover:bg-mo-fg hover:text-mo-bg hover:-translate-y-0.5 transition-all duration-300';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mo-label text-mo-faint mr-2">Share</span>

      {targets.map((target) => (
        <a key={target.key} href={target.href} target="_blank" rel="noopener noreferrer" aria-label={target.label} title={target.label} className={button}>
          {target.glyph}
        </a>
      ))}

      <button
        type="button"
        onClick={() => copy(url, { label: 'Link copied', failLabel: 'Copying was blocked — select the URL instead' })}
        aria-label="Copy this post's link"
        title="Copy this post's link"
        className={button}
      >
        <Icon.Link className="w-[18px] h-[18px]" />
      </button>
    </div>
  );
}
