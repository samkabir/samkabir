import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';

import BlogPostBody from '@/components/Blog/BlogPostBody';
import ShareRow from '@/components/Blog/ShareRow';
import TagPill from '@/components/Blog/TagPill';
import SiteLayout from '@/components/site/SiteLayout';
import * as Icon from '@/components/site/icons';
import { formatDay } from '@/lib/adminFormat';
import { plainSummary } from '@/lib/markdown';
import { absoluteUrl, serialiseJsonLd } from '@/lib/seo';
import {
  getPostBySlug,
  getPostNeighbours,
  getPublishedPostSlugs,
  getSiteChrome,
} from '@/lib/content';

/**
 * `/blog/[slug]` — one post.
 *
 * The draft rule lives in `getStaticProps`, not here: `getPostBySlug` cannot
 * return an unpublished post, so this component has no branch for one. That is
 * the point — a visibility check in a component is a check someone can render
 * around.
 */
export default function BlogPost({ post, neighbours, chrome, canonical }) {
  const { seo, profile } = chrome ?? {};
  const siteTitle = seo?.siteTitle || 'Samiul Kabir';
  const authorName = post.authorName || profile?.fullName || siteTitle;

  const title = post.seoTitle || `${post.title} — ${siteTitle}`;

  /**
   * Description, in the order of how deliberate each source is.
   *
   * `seoDescription` is written for search results, `excerpt` for the card, and
   * the summary is derived. Falling through means a post always has one rather
   * than search engines inventing a snippet from the first sentence of markup.
   */
  const description = post.seoDescription || post.excerpt || plainSummary(post.contentMarkdown);

  const shareImage = post.ogImage?.url || post.cover?.url || null;

  /**
   * `BlogPosting`, as JSON-LD.
   *
   * Serialised through `serialiseJsonLd`, **not** `JSON.stringify`.
   *
   * That distinction is the whole point, and this comment previously got it
   * wrong. `JSON.stringify` does not escape `<`, so a post titled
   * `</script><img src=x onerror=alert(1)>` produced a literal `</script>` inside
   * this element, ended it early, and had the remainder parsed as markup — script
   * execution from a title. `lib/seo.js` escapes it; `tests/seo.test.js` is the
   * regression test.
   *
   * Post *markup* still never goes near `innerHTML` — see
   * `components/Blog/BlogPostBody.js`. This string is different in kind: it is
   * built here from known fields rather than authored as markup.
   */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: { '@type': 'Person', name: authorName },
    ...(shareImage ? { image: shareImage } : {}),
    ...(canonical ? { mainEntityOfPage: { '@type': 'WebPage', '@id': canonical } } : {}),
    ...(post.tags.length ? { keywords: post.tags.map((tag) => tag.name).join(', ') } : {}),
    wordCount: post.contentMarkdown.split(/\s+/).filter(Boolean).length,
  };

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        {canonical ? <link rel="canonical" href={canonical} /> : null}

        <meta property="og:type" content="article" />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={description} />
        {canonical ? <meta property="og:url" content={canonical} /> : null}
        {shareImage ? <meta property="og:image" content={shareImage} /> : null}
        {post.publishedAt ? (
          <meta property="article:published_time" content={post.publishedAt} />
        ) : null}
        <meta property="article:modified_time" content={post.updatedAt} />

        <meta name="twitter:card" content={shareImage ? 'summary_large_image' : 'summary'} />
        <meta name="twitter:title" content={post.title} />
        <meta name="twitter:description" content={description} />
        {shareImage ? <meta name="twitter:image" content={shareImage} /> : null}
        {seo?.twitterHandle ? <meta name="twitter:site" content={seo.twitterHandle} /> : null}

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serialiseJsonLd(jsonLd) }}
        />
      </Head>

      <SiteLayout chrome={chrome}>
        <article className="mx-auto max-w-[720px] px-5 sm:px-8 pt-12 sm:pt-20">
          <Link href="/blog" className="ss-in group inline-flex items-center gap-1.5 text-[14px] text-ss-muted hover:text-ss-fg transition-colors">
            <Icon.ArrowLeft className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
            All writing
          </Link>

          <header className="pt-8 pb-10">
            <h1 className="ss-in ss-serif text-[38px] sm:text-[52px] leading-[1.06] text-ss-fg" style={{ '--d': '80ms' }}>
              {post.title}
            </h1>

            <p className="ss-in ss-mono flex flex-wrap items-center gap-x-3 gap-y-1 pt-5 text-ss-faint" style={{ '--d': '160ms' }}>
              {post.publishedAt ? (
                /* A machine-readable date beside the human one, so the
                   published date is not only in JSON-LD. */
                <time dateTime={post.publishedAt}>{formatDay(post.publishedAt)}</time>
              ) : null}
              <span aria-hidden="true">·</span>
              <span>{post.readingMinutes} min read</span>
              <span aria-hidden="true">·</span>
              <span>{authorName}</span>
            </p>

            {post.tags.length ? (
              <div className="ss-in flex flex-wrap gap-1.5 pt-5" style={{ '--d': '220ms' }}>
                {post.tags.map((tag) => (
                  <TagPill
                    key={tag.slug}
                    name={tag.name}
                    href={`/blog?tag=${encodeURIComponent(tag.slug)}`}
                  />
                ))}
              </div>
            ) : null}
          </header>

          {post.cover?.url ? (
            <div className="ss-in pb-10" style={{ '--d': '260ms' }}>
              <Image
                src={post.cover.url}
                alt={post.coverAlt || post.cover.alt || ''}
                width={post.cover.width ?? 1200}
                height={post.cover.height ?? 630}
                className="rounded-xl border border-ss-line"
                sizes="(max-width: 720px) 100vw, 720px"
                style={{ width: '100%', height: 'auto' }}
                priority
              />
            </div>
          ) : null}

          <div className="ss-in" style={{ '--d': '300ms' }}>
            <BlogPostBody markdown={post.contentMarkdown} />
          </div>

          <div className="border-t border-ss-line mt-14 pt-6">
            {canonical ? <ShareRow url={canonical} title={post.title} /> : null}
          </div>

          {/* Previous is the next post *older* — the direction a reader moving
              backwards through an archive expects. */}
          {neighbours.previous || neighbours.next ? (
            <nav aria-label="More posts" className="grid sm:grid-cols-2 gap-3 mt-10">
              {neighbours.previous ? (
                <Link href={`/blog/${neighbours.previous.slug}`} className="ss-card group p-5">
                  <span className="ss-mono text-ss-faint">← Previous</span>
                  <span className="block mt-1 text-[15px] font-medium text-ss-fg">{neighbours.previous.title}</span>
                </Link>
              ) : (
                <span />
              )}

              {neighbours.next ? (
                <Link href={`/blog/${neighbours.next.slug}`} className="ss-card group p-5 sm:text-right">
                  <span className="ss-mono text-ss-faint">Next →</span>
                  <span className="block mt-1 text-[15px] font-medium text-ss-fg">{neighbours.next.title}</span>
                </Link>
              ) : null}
            </nav>
          ) : null}
        </article>

        <div className="h-8 sm:h-12" />
      </SiteLayout>
    </>
  );
}

/**
 * Prerender every published post, and build unknown slugs on demand.
 *
 * `fallback: 'blocking'` is the load-bearing choice. With `false`, a post
 * published after the last deploy would 404 until the next build — which would
 * make "publish" mean "publish, then wait for a deploy" and defeat the point of
 * the CMS. With `'blocking'`, the first request for an unknown slug runs
 * `getStaticProps` and either renders the post or 404s, and the result is cached
 * from then on.
 *
 * `true` was the other option and is worse here: it serves a loading skeleton
 * first, which is exactly the indexability problem Phase 7 removed from the home
 * page.
 */
export async function getStaticPaths() {
  const slugs = await getPublishedPostSlugs();

  return {
    paths: slugs.map(({ slug }) => ({ params: { slug } })),
    fallback: 'blocking',
  };
}

export async function getStaticProps({ params }) {
  const post = await getPostBySlug(params.slug);

  /**
   * A draft and a non-existent post are the same 404.
   *
   * `getPostBySlug` filters unpublished posts in the query, so this branch cannot
   * distinguish them — deliberately. Returning a different status for a draft
   * would confirm that a slug exists, and slugs are guessable by design, so a
   * 403 on `/blog/the-big-announcement` would leak the announcement.
   *
   * `notFound` also sets `revalidate`, so a slug that 404s now starts working
   * within the window once the post is published, without a deploy.
   */
  if (!post) {
    return { notFound: true, revalidate: 60 };
  }

  const [neighbours, chrome] = await Promise.all([
    getPostNeighbours(post.publishedAt),
    getSiteChrome(),
  ]);
  const { seo } = chrome;

  return {
    props: {
      post,
      neighbours,
      chrome,
      // Built here rather than in the component: `window.location` is not
      // available while prerendering, and a canonical URL that only appears
      // client-side is a canonical URL search engines never see.
      canonical: absoluteUrl(seo?.canonicalUrl, `/blog/${post.slug}`),
    },
    revalidate: 60,
  };
}
