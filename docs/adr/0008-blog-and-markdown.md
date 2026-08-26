# 0008 — The blog, and the Markdown sanitisation pipeline

**Phase:** 8
**Status:** accepted

## Context

Phase 8 added a blog: public listing, post pages, and a dashboard editor with
drafts. The load-bearing risk is that a blog post body is **author-written markup
rendered on a public page** — the author is trusted, but the output is not, and
stored markup is the main XSS vector in the whole system.

## Decision

Post bodies render through `react-markdown` + `remark-gfm` + `rehype-sanitize`
with an **explicit allowlist** (the pipeline lives in `lib/markdown.js`), and there
is **no `dangerouslySetInnerHTML`** for post markup anywhere
(`components/Blog/BlogPostBody.js`). Two independent properties make it safe:
`rehype-raw` is deliberately absent, so raw HTML in a post is text and never
becomes a tag; and the sanitiser is the second line that drops anything not on the
allowlist. The dashboard's editor
preview renders through the *same* component and sanitiser, so what the author
previews is what publishes — sanitisation included. JSON-LD is emitted through
`serialiseJsonLd` (which escapes `<`), never `JSON.stringify`, so a post title
cannot break out of the `<script type="application/ld+json">` tag. Draft and
future-dated posts are excluded in the query `where` clause, not by a check on the
result. One `PostEditor` serves both `/admin/blogs/new` and `/admin/blogs/[id]`.

## Rejected alternatives

- **`dangerouslySetInnerHTML` with a hand-rolled sanitiser.** A second sanitiser
  is a second thing to get wrong, and the one place it is wrong is the one place it
  matters.
- **A separate preview renderer.** A preview with its own renderer disagrees with
  the real one, and the disagreement always surfaces after publishing.
- **Free-text tags typed into a post.** They breed near-duplicates — "nextjs",
  "Next.js", "next-js" — that then have to be found and merged, so tags are created
  deliberately on the Blog screen and only selected on a post.

## Consequences

A `<script>` pasted into a post vanishes in the preview before it is ever
published, and `tests/markdown.test.js` asserts it. The single editor means adding
a field is one change, not two. (This ADR is where ADR 0006's note that "the blog
editor is Phase 8" is discharged.)
