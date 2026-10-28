import { motion, useScroll, useSpring } from 'motion/react';
import Head from 'next/head';
import Image from 'next/image';
import { useRef } from 'react';

import BlogPostBody from '@/components/Blog/BlogPostBody';
import ShareRow from '@/components/Blog/ShareRow';
import TagPill from '@/components/Blog/TagPill';
import SiteLayout from '@/components/site/SiteLayout';
import { EASE_IN_OUT } from '@/components/site/ease';
import * as Icon from '@/components/site/icons';
import { Reveal, SplitText, useEntrance } from '@/components/site/motion';
import { TLink } from '@/components/site/Shell';
import { formatDay } from '@/lib/adminFormat';
import { plainSummary } from '@/lib/markdown';
import { absoluteUrl, serialiseJsonLd } from '@/lib/seo';
import {
  getPostBySlug,
  getPostNeighbours,
  getPublishedPostSlugs,
  getSiteChrome,
} from '@/lib/content';

/** A hairline across the top of the window that fills as the post is read. */
function ReadingProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 160, damping: 30 });
  return <motion.div aria-hidden="true" className="fixed inset-x-0 top-0 z-[55] h-[3px] bg-mo-accent origin-left" style={{ scaleX }} />;
}

/** The cover opens like a shutter from the middle out as it comes into view. */
function CoverReveal({ children }) {
  const ref = useRef(null);
  const show = useEntrance(ref, { amount: 0.2 });
  return (
    <div ref={ref} className="mx-auto max-w-[1100px] px-5 sm:px-8 pt-12">
      <motion.div
        className="overflow-hidden rounded-[24px] bg-mo-sunk"
        initial={{ clipPath: 'inset(0% 50% 0% 50%)' }}
        animate={{ clipPath: show ? 'inset(0% 0% 0% 0%)' : 'inset(0% 50% 0% 50%)' }}
        transition={{ duration: 1.2, ease: EASE_IN_OUT, delay: 0.3 }}
      >
        {children}
      </motion.div>
    </div>
  );
}

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
        <ReadingProgress />

        <article className="pt-32 sm:pt-40">
          <header className="mx-auto max-w-[1100px] px-5 sm:px-8">
            <Reveal y={10}>
              <TLink href="/blog" label="Writing" className="group mo-label inline-flex items-center gap-2 text-mo-muted hover:text-mo-fg transition-colors">
                <Icon.ArrowLeft className="w-3.5 h-3.5 transition-transform duration-500 group-hover:-translate-x-1" />
                All writing
              </TLink>
            </Reveal>

            <SplitText
              as="h1"
              text={post.title}
              delay={0.1}
              stagger={0.045}
              className="block mt-8 mo-display text-[clamp(44px,7vw,108px)] !leading-[0.95]"
            />

            <Reveal delay={0.4} y={12} className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-mo-line pt-5">
              <p className="mo-label flex flex-wrap items-center gap-x-3 gap-y-1 text-mo-muted">
                {post.publishedAt ? (
                  /* A machine-readable date beside the human one, so the
                     published date is not only in JSON-LD. */
                  <time dateTime={post.publishedAt}>{formatDay(post.publishedAt)}</time>
                ) : null}
                <span aria-hidden="true" className="text-mo-faint">/</span>
                <span>{post.readingMinutes} min read</span>
                <span aria-hidden="true" className="text-mo-faint">/</span>
                <span>{authorName}</span>
              </p>
              {post.tags.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {post.tags.map((tag) => (
                    <TagPill key={tag.slug} name={tag.name} href={`/blog?tag=${encodeURIComponent(tag.slug)}`} />
                  ))}
                </div>
              ) : null}
            </Reveal>
          </header>

          {post.cover?.url ? (
            <CoverReveal>
              <Image
                src={post.cover.url}
                alt={post.coverAlt || post.cover.alt || ''}
                width={post.cover.width ?? 1200}
                height={post.cover.height ?? 630}
                sizes="(max-width: 1100px) 100vw, 1100px"
                style={{ width: '100%', height: 'auto' }}
                priority
              />
            </CoverReveal>
          ) : null}

          <Reveal delay={0.5} className="mx-auto max-w-[720px] px-5 sm:px-8 pt-14">
            <BlogPostBody markdown={post.contentMarkdown} />

            <div className="border-t border-mo-line mt-14 pt-6">
              {canonical ? <ShareRow url={canonical} title={post.title} /> : null}
            </div>
          </Reveal>

          {/* Previous is the next post *older* — the direction a reader moving
              backwards through an archive expects. */}
          {neighbours.previous || neighbours.next ? (
            <nav aria-label="More posts" className="mx-auto max-w-[1100px] px-5 sm:px-8 mt-20 grid sm:grid-cols-2 border-y border-mo-line">
              {neighbours.previous ? (
                <TLink href={`/blog/${neighbours.previous.slug}`} label="Writing" className="group mo-row block p-6 sm:p-8">
                  <span className="mo-label text-mo-faint">← Previous</span>
                  <span className="block mt-3 text-[22px] font-medium tracking-[-0.02em] leading-snug transition-transform duration-500 group-hover:translate-x-1">{neighbours.previous.title}</span>
                </TLink>
              ) : (
                <span />
              )}

              {neighbours.next ? (
                <TLink href={`/blog/${neighbours.next.slug}`} label="Writing" className="group mo-row block p-6 sm:p-8 sm:text-right sm:border-l border-mo-line">
                  <span className="mo-label text-mo-faint">Next →</span>
                  <span className="block mt-3 text-[22px] font-medium tracking-[-0.02em] leading-snug transition-transform duration-500 group-hover:-translate-x-1">{neighbours.next.title}</span>
                </TLink>
              ) : null}
            </nav>
          ) : null}
        </article>
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
