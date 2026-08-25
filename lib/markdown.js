import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

/**
 * The Markdown pipeline, and the allowlist that makes it safe to render.
 *
 * This is the most security-sensitive file in the project, and it is worth being
 * precise about why. Every other input is validated and then stored as data:
 * a job title is escaped by React and rendered as text. Post content is
 * different — it is *markup*, authored to become HTML, and that HTML is served
 * from this site's own origin to the public. Anything that survives this file and
 * executes runs with the site's origin, its cookies, and its reputation.
 *
 * The author is trusted. That is not the point. The threat is a mistake, a pasted
 * snippet from somewhere else, or a future feature that widens who can write —
 * and in all three cases the damage is the same. So the rule here is not "keep
 * the author honest", it is **the pipeline cannot emit anything that executes,
 * whatever it is given.**
 *
 * Two independent properties make that true:
 *
 *   1. **`rehype-sanitize` with an explicit allowlist**, applied after parsing.
 *      Anything not named is dropped, so a tag nobody thought about is excluded
 *      by default rather than included by default.
 *   2. **No `dangerouslySetInnerHTML`, anywhere.** `react-markdown` builds a
 *      React element tree; the browser never parses a string of our HTML. Raw
 *      HTML in the source is not passed through at all, because `rehype-raw` is
 *      deliberately *not* in the plugin list — so `<script>` in a post is text,
 *      not a tag, and never reaches the sanitiser to be stripped in the first
 *      place. The sanitiser is the second line, not the only one.
 */

/**
 * `remark-gfm` adds tables, strikethrough, task lists and autolinks.
 *
 * Autolinking is the one worth noting: it turns a bare URL into an anchor, which
 * means a URL in a post becomes a link whose protocol the sanitiser then checks
 * against `protocols.href` below. That is the intended path — it is how
 * `javascript:` in a bare URL gets neutralised.
 */
export const remarkPlugins = [remarkGfm];

/**
 * The allowlist, as a narrowing of `rehype-sanitize`'s default.
 *
 * Starting from the default rather than from nothing is deliberate: it already
 * excludes `script`, `iframe`, `object`, `style` and every event-handler
 * attribute, and it has been maintained against real bypasses for longer than
 * this project has existed. Re-deriving that from scratch would be a worse
 * allowlist that looked more thorough.
 *
 * What is changed:
 *
 *   * **`img` gains `alt`, `title`, `width` and `height`.** `alt` is the reason —
 *     the default omits it from `img` specifically, and an image in a post with
 *     no alt text is an accessibility failure on the public site.
 *   * **`a` gains `title` and keeps `href`**, whose protocols are restricted
 *     below.
 *   * **`code` and `pre` gain `className`**, restricted to the `language-*` form
 *     so fenced blocks can be styled or highlighted later. An unrestricted
 *     `className` is not an XSS vector on its own, but it lets post content
 *     borrow the site's own utility classes and impersonate site chrome, so it
 *     is bounded to the one prefix that has a reason.
 *   * **`irc`, `ircs` and `xmpp` are removed from `href`.** The default allows
 *     them; this site has no use for them, and every protocol that stays is one
 *     more thing a link can do. `http`, `https` and `mailto` are what a blog
 *     needs.
 *   * **`src` on an image is restricted to `https`.** Not `http`: a post is
 *     served over HTTPS, so an `http` image is mixed content that browsers block
 *     or downgrade anyway. Making it explicit means the failure is a missing
 *     image rather than a security warning on the page.
 *
 * `clobberPrefix` is left at the default `user-content-`. It namespaces `id` and
 * `name` attributes generated from post content so a heading called "Sign in"
 * cannot produce `id="login"` and shadow a real element that scripts or CSS on
 * the page reference by id — DOM clobbering, which is easy to forget and free to
 * prevent.
 */
export const sanitizeSchema = {
  ...defaultSchema,

  attributes: {
    ...defaultSchema.attributes,
    a: [...(defaultSchema.attributes?.a ?? []), 'title'],
    img: [...(defaultSchema.attributes?.img ?? []), 'alt', 'title', 'width', 'height'],
    code: [...(defaultSchema.attributes?.code ?? []), ['className', /^language-./]],
    pre: [...(defaultSchema.attributes?.pre ?? []), ['className', /^language-./]],
  },

  protocols: {
    ...defaultSchema.protocols,
    href: ['http', 'https', 'mailto'],
    cite: ['http', 'https'],
    src: ['https'],
  },
};

export const rehypePlugins = [[rehypeSanitize, sanitizeSchema]];

/**
 * What every anchor in post content gets.
 *
 * `rel="noreferrer"` on an external link is the meaningful half: without it the
 * target learns which page linked to it, and with `target="_blank"` an older
 * browser would also hand over a `window.opener` handle that can navigate this
 * page elsewhere. `nofollow` is there because a comment-free blog still
 * accumulates outbound links over time and none of them are endorsements this
 * site wants to spend ranking on.
 *
 * Internal links — anything starting `/` or `#` — are left alone: opening the
 * site's own pages in a new tab is a nuisance, not a safety measure.
 */
export function linkProps(href) {
  const isInternal = typeof href === 'string' && (href.startsWith('/') || href.startsWith('#'));

  if (isInternal) return {};

  return { target: '_blank', rel: 'noopener noreferrer nofollow' };
}

/**
 * A one-line summary for a meta description, from Markdown source.
 *
 * Used only when a post sets neither `excerpt` nor `seoDescription`. Strips the
 * syntax rather than rendering it, because a description containing `##` or a
 * raw URL reads as broken in a search result.
 */
export function plainSummary(markdown, limit = 160) {
  const prose = String(markdown ?? '')
    // A fenced block is dropped whole — a description is prose, and a snippet of
    // JavaScript in a search result is noise.
    .replace(/```[\s\S]*?```/g, ' ')
    // Inline code is *unwrapped*, not dropped. `estimateReadingMinutes` removes
    // it because code is scanned rather than read, but a description is a
    // sentence: deleting the word inside the backticks leaves "Some bold and and
    // a link", which reads as a bug rather than as a summary.
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_~>#|`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (prose.length <= limit) return prose;

  // Cut at a word boundary so the ellipsis does not land mid-word.
  const cut = prose.slice(0, limit);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
