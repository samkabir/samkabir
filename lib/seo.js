/**
 * Helpers for the two things every public page needs: an absolute URL and, on a
 * post, a block of structured data.
 */

/**
 * Serialises structured data for embedding inside a `<script>` element.
 *
 * **`JSON.stringify` alone is not safe here, and it is worth being blunt about
 * why**, because the first version of this code used it and carried a comment
 * claiming the opposite.
 *
 * `JSON.stringify` does not escape `<`. So a post titled
 *
 *     </script><img src=x onerror=alert(1)>
 *
 * serialises to a string containing a literal `</script>`, which ends the script
 * element early — and everything after it is parsed as markup by the browser.
 * The result is script execution from a *title*, a field that is otherwise just
 * text everywhere else on the site. Verified by experiment rather than reasoned
 * about: the raw output really does contain `</script`, and the escaped output
 * really does not.
 *
 * Escaping `<` as `\u003c` fixes it: that is a valid escape inside a JSON string,
 * so `JSON.parse` still returns the original characters and consumers see the
 * real title — the sequence simply never appears literally in the HTML.
 *
 * U+2028 and U+2029 are escaped for a related reason. Both are legal inside a
 * JSON string but are *line terminators* in JavaScript source, so a parser
 * treating this block as a script rather than as data can be desynchronised by
 * them. Cheap to close, and the kind of gap that is only found deliberately.
 *
 * Note that both are written as escape sequences in the regexes below rather
 * than as literal characters. They have to be: a literal U+2028 inside a regex
 * literal *is* a line break to the parser, so the source would not compile — the
 * same property that makes them worth escaping in the output.
 *
 * This is the one place in the project that hands a string to
 * `dangerouslySetInnerHTML`. Post *markup* never goes near it — see
 * `lib/markdown.js` — and the difference is that this string is built here from
 * known fields rather than authored, and every character that could escape its
 * container is neutralised above.
 */
export function serialiseJsonLd(data) {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * Joins a canonical base with a path, or returns null.
 *
 * Null rather than a relative URL when the base is unset. A canonical tag, an
 * `og:url` and a sitemap `<loc>` all have to be absolute — a relative value in
 * any of them is either ignored or actively harmful, so the honest answer to "no
 * canonical URL configured" is to omit the tag rather than emit a broken one.
 *
 * The trailing slash is stripped from the base so `https://x.com/` and
 * `https://x.com` produce the same result. Without that, one of them yields
 * `https://x.com//blog`, which is a different URL to every crawler that sees it.
 */
export function absoluteUrl(base, path = '/') {
  if (!base) return null;

  const root = String(base).replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;

  return `${root}${suffix}`;
}
