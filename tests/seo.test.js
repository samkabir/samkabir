import { describe, expect, it } from 'vitest';

import { absoluteUrl, serialiseJsonLd } from '../lib/seo.js';

/**
 * `serialiseJsonLd` exists because of a real vulnerability, and these tests are
 * the record of it.
 *
 * The first version of the post page used `JSON.stringify` directly, with a
 * comment asserting that it escaped the characters which could close a `<script>`
 * element. It does not. A post *title* containing `</script>` was therefore
 * enough to execute script on the page — from a field that is plain text
 * everywhere else on the site.
 */
describe('serialiseJsonLd', () => {
  it('never emits a literal closing script tag', () => {
    const out = serialiseJsonLd({ headline: '</script><img src=x onerror=alert(1)>' });

    expect(out.toLowerCase()).not.toContain('</script');
    // The angle brackets are gone entirely, not merely the exact sequence — a
    // check for `</script` alone would pass on `</ScRiPt` or `</script\n>`.
    expect(out).not.toContain('<');
  });

  it.each([
    ['a closing tag in a title', '</script>'],
    ['mixed case', '</ScRiPt>'],
    ['with a newline before the bracket', '</script\n>'],
    ['an opening tag', '<script>alert(1)</script>'],
    ['an img with a handler', '<img src=x onerror=alert(1)>'],
    ['an HTML comment opener', '<!--'],
  ])('escapes %s', (_label, payload) => {
    expect(serialiseJsonLd({ value: payload })).not.toContain('<');
  });

  it('still parses back to exactly the original data', () => {
    // The escape has to be transparent: consumers must see the real title, or
    // the fix would be corrupting the structured data to protect the page.
    const data = {
      '@type': 'BlogPosting',
      headline: '</script> & "quotes" and \u2028 and \u2029 and emoji 🎉',
      nested: { keywords: 'a, b', count: 3 },
    };

    expect(JSON.parse(serialiseJsonLd(data))).toEqual(data);
  });

  it('escapes the JavaScript line terminators', () => {
    // Legal inside a JSON string, but line terminators in JavaScript source — so
    // a parser treating this block as script rather than data can be
    // desynchronised by them.
    const out = serialiseJsonLd({ value: 'a\u2028b\u2029c' });

    expect(out).not.toContain('\u2028');
    expect(out).not.toContain('\u2029');
    expect(JSON.parse(out).value).toBe('a\u2028b\u2029c');
  });

  it('produces valid JSON for ordinary input', () => {
    const data = { '@context': 'https://schema.org', '@type': 'BlogPosting', wordCount: 12 };

    expect(JSON.parse(serialiseJsonLd(data))).toEqual(data);
  });
});

describe('absoluteUrl', () => {
  it('joins a base and a path', () => {
    expect(absoluteUrl('https://x.test', '/blog/a')).toBe('https://x.test/blog/a');
  });

  it('does not double the slash when the base has one', () => {
    // `https://x.test//blog` is a different URL to every crawler that sees it.
    expect(absoluteUrl('https://x.test/', '/blog')).toBe('https://x.test/blog');
    expect(absoluteUrl('https://x.test///', '/blog')).toBe('https://x.test/blog');
  });

  it('adds the leading slash when the path lacks one', () => {
    expect(absoluteUrl('https://x.test', 'blog')).toBe('https://x.test/blog');
  });

  it('returns null without a base rather than a relative URL', () => {
    // A relative canonical tag or sitemap <loc> is ignored at best and harmful at
    // worst, so the honest answer is to omit the tag entirely.
    expect(absoluteUrl(null, '/blog')).toBe(null);
    expect(absoluteUrl('', '/blog')).toBe(null);
    expect(absoluteUrl(undefined, '/blog')).toBe(null);
  });

  it('defaults to the root path', () => {
    expect(absoluteUrl('https://x.test')).toBe('https://x.test/');
  });
});
