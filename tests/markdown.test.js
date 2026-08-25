import { rehype } from 'rehype';
import { describe, expect, it } from 'vitest';

import { linkProps, plainSummary, sanitizeSchema } from '../lib/markdown.js';
import { rehypePlugins } from '../lib/markdown.js';

/**
 * The one test suite in this project whose failures would be live
 * vulnerabilities.
 *
 * Post content is the only input that is deliberately turned into markup and
 * served from this site's own origin. Everything else is escaped as text. So
 * these are not "does the renderer work" tests — they are "can anything that
 * executes survive the pipeline", asked with hostile input.
 *
 * The assertions run the real `rehype-sanitize` with the real schema, rather than
 * a copy of it. A test that reimplemented the allowlist would pass while the
 * shipped one was wrong.
 */
const processor = rehype().use({ plugins: rehypePlugins }).data('settings', { fragment: true });

const sanitize = (html) => String(processor.processSync(html));

describe('the sanitiser strips anything that executes', () => {
  it('removes a script tag entirely, not just its tags', () => {
    const out = sanitize('<p>before</p><script>alert(document.cookie)</script><p>after</p>');

    expect(out).not.toContain('<script');
    // The *contents* must go too. Leaving the text behind would be harmless here
    // but would mean the element was unwrapped rather than dropped, and an
    // unwrapped <style> or <title> can change what follows it.
    expect(out).not.toContain('alert(document.cookie)');
    expect(out).toContain('before');
    expect(out).toContain('after');
  });

  it.each([
    ['inline event handler', '<img src="https://x/y.png" onerror="alert(1)">', 'onerror'],
    ['onload', '<svg onload="alert(1)"></svg>', 'onload'],
    ['onclick', '<p onclick="alert(1)">hi</p>', 'onclick'],
    ['iframe', '<iframe src="https://evil.test"></iframe>', '<iframe'],
    ['object', '<object data="x.swf"></object>', '<object'],
    ['embed', '<embed src="x.swf">', '<embed'],
    ['form', '<form action="https://evil.test"><input name="p"></form>', '<form'],
    ['style block', '<style>body{display:none}</style>', '<style'],
    ['style attribute', '<p style="position:fixed;inset:0">x</p>', 'style='],
    ['meta refresh', '<meta http-equiv="refresh" content="0;url=https://evil.test">', '<meta'],
    ['base tag', '<base href="https://evil.test/">', '<base'],
    ['link tag', '<link rel="stylesheet" href="https://evil.test/x.css">', '<link'],
  ])('drops %s', (_label, input, forbidden) => {
    expect(sanitize(input)).not.toContain(forbidden);
  });

  it.each([
    ['javascript:', '<a href="javascript:alert(1)">click</a>'],
    ['uppercase JavaScript:', '<a href="JaVaScRiPt:alert(1)">click</a>'],
    ['data: URL', '<a href="data:text/html,<script>alert(1)</script>">click</a>'],
    ['vbscript:', '<a href="vbscript:msgbox(1)">click</a>'],
    ['tab-obfuscated', '<a href="java\tscript:alert(1)">click</a>'],
  ])('strips a %s href while keeping the link text', (_label, input) => {
    const out = sanitize(input);

    expect(out.toLowerCase()).not.toContain('javascript:');
    expect(out.toLowerCase()).not.toContain('vbscript:');
    expect(out).not.toContain('data:text/html');
    // The text survives — the anchor becomes inert rather than the sentence
    // losing a word.
    expect(out).toContain('click');
  });

  it('refuses a data: image source', () => {
    // `src` is restricted to https, so a data: URL cannot smuggle an SVG —
    // which would otherwise be a scriptable document served same-origin.
    expect(sanitize('<img src="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=">')).not.toContain('data:');
  });

  it('refuses an http image source, which would be mixed content', () => {
    expect(sanitize('<img src="http://insecure.test/x.png" alt="x">')).not.toContain('http://insecure.test');
  });

  it('keeps an https image with its alt text', () => {
    const out = sanitize('<img src="https://cdn.test/x.png" alt="A chart">');

    expect(out).toContain('https://cdn.test/x.png');
    expect(out).toContain('A chart');
  });
});

describe('the sanitiser keeps what a post is made of', () => {
  it.each([
    ['headings', '<h2>Title</h2>', '<h2>'],
    ['paragraphs', '<p>Words</p>', '<p>'],
    ['bold', '<strong>x</strong>', '<strong>'],
    ['code', '<code>npm run build</code>', '<code>'],
    ['pre blocks', '<pre><code>x</code></pre>', '<pre>'],
    ['lists', '<ul><li>x</li></ul>', '<li>'],
    ['tables', '<table><tbody><tr><td>x</td></tr></tbody></table>', '<td>'],
    ['blockquotes', '<blockquote><p>x</p></blockquote>', '<blockquote>'],
    ['strikethrough', '<del>x</del>', '<del>'],
    ['https links', '<a href="https://example.test">x</a>', 'https://example.test'],
    ['mailto links', '<a href="mailto:a@b.test">x</a>', 'mailto:a@b.test'],
  ])('keeps %s', (_label, input, expected) => {
    expect(sanitize(input)).toContain(expected);
  });

  it('keeps a language class on a fenced block but not an arbitrary one', () => {
    expect(sanitize('<code class="language-js">x</code>')).toContain('language-js');

    // Bounded to `language-*` on purpose: an unrestricted className is not an
    // XSS vector, but it would let post content borrow the site's own utility
    // classes and impersonate site chrome.
    const out = sanitize('<code class="fixed inset-0 bg-black">x</code>');
    expect(out).not.toContain('fixed inset-0');
  });
});

describe('DOM clobbering', () => {
  it('namespaces ids generated from content', () => {
    // Without a clobber prefix, a heading anchor called "login" produces
    // `id="login"`, and `document.getElementById('login')` elsewhere on the page
    // starts resolving to post content.
    expect(sanitizeSchema.clobberPrefix).toBe('user-content-');

    const out = sanitize('<h2 id="login">Sign in</h2>');
    expect(out).toContain('user-content-login');
    expect(out).not.toMatch(/id="login"/);
  });
});

describe('the allowlist itself', () => {
  it('never names a tag that can execute', () => {
    for (const tag of ['script', 'iframe', 'object', 'embed', 'style', 'link', 'meta', 'base', 'form', 'svg']) {
      expect(sanitizeSchema.tagNames, tag).not.toContain(tag);
    }
  });

  it('allows only protocols this site has a use for', () => {
    expect(sanitizeSchema.protocols.href).toEqual(['http', 'https', 'mailto']);
    expect(sanitizeSchema.protocols.src).toEqual(['https']);

    // The default allows these; a blog has no use for them, and each one is
    // another thing a link can do.
    for (const gone of ['irc', 'ircs', 'xmpp', 'javascript', 'data', 'vbscript']) {
      expect(sanitizeSchema.protocols.href, gone).not.toContain(gone);
    }
  });

  it('allows alt on an image, which the default schema omits', () => {
    // The reason this file overrides the default at all: an image in a post with
    // no alt text is an accessibility failure on a public page.
    expect(sanitizeSchema.attributes.img).toContain('alt');
  });
});

describe('linkProps', () => {
  it('opens an external link safely in a new tab', () => {
    expect(linkProps('https://example.test')).toEqual({
      target: '_blank',
      rel: 'noopener noreferrer nofollow',
    });
  });

  it('leaves internal links alone', () => {
    // Opening the site's own pages in a new tab is a nuisance, not a safeguard.
    expect(linkProps('/blog/x')).toEqual({});
    expect(linkProps('#a-heading')).toEqual({});
  });

  it('treats a missing or non-string href as external', () => {
    // The safe default: an unrecognised value gets the restrictive treatment
    // rather than the permissive one.
    expect(linkProps(undefined).rel).toContain('noreferrer');
    expect(linkProps(null).rel).toContain('noreferrer');
  });
});

describe('plainSummary', () => {
  it('strips Markdown syntax rather than rendering it', () => {
    const summary = plainSummary('## Heading\n\nSome **bold** and `code` and [a link](https://x.test).');

    expect(summary).not.toMatch(/[#*`[\]()]/);
    expect(summary).toContain('Some bold and code and a link');
  });

  it('drops code fences, which are scanned rather than read', () => {
    expect(plainSummary('Intro.\n\n```js\nconst x = 1;\n```\n\nOutro.')).not.toContain('const x');
  });

  it('cuts at a word boundary and marks the truncation', () => {
    const summary = plainSummary('word '.repeat(80), 40);

    expect(summary.length).toBeLessThanOrEqual(41);
    expect(summary.endsWith('…')).toBe(true);
    expect(summary).not.toMatch(/wo…$/);
  });

  it('returns an empty string for empty input rather than throwing', () => {
    expect(plainSummary('')).toBe('');
    expect(plainSummary(null)).toBe('');
    expect(plainSummary(undefined)).toBe('');
  });
});
