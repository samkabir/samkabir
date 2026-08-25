import { Box, Typography } from '@mui/material';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';

import BlogPostBody from '@/components/Blog/BlogPostBody';
import ShareRow from '@/components/Blog/ShareRow';
import TagPill from '@/components/Blog/TagPill';
import Footer from '@/components/Footer/Footer';
import Header from '@/components/Header/header';
import { formatDay } from '@/lib/adminFormat';
import { rubikFont } from '@/lib/fonts';
import { plainSummary } from '@/lib/markdown';
import { absoluteUrl, serialiseJsonLd } from '@/lib/seo';
import {
  getPostBySlug,
  getPostNeighbours,
  getProfile,
  getPublishedPostSlugs,
  getSectionCopy,
  getSeoSettings,
  navFromSections,
} from '@/lib/content';

/**
 * `/blog/[slug]` — one post.
 *
 * The draft rule lives in `getStaticProps`, not here: `getPostBySlug` cannot
 * return an unpublished post, so this component has no branch for one. That is
 * the point — a visibility check in a component is a check someone can render
 * around.
 */
export default function BlogPost({ post, neighbours, seo, profile, nav, canonical }) {
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
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/images/Logo.png" />
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

      <main>
        <Header sections={nav} />

        <Box className="px-4 md:px-20 py-8 cursor-default">
          <Box className="px-4 md:px-20 max-w-[820px] mx-auto">
            <Box className="pt-10">
              <Link href="/blog" className={`text-[#7a61ff] text-sm ${rubikFont.className}`}>
                ← All writing
              </Link>
            </Box>

            <article>
              <header className="pt-6 pb-8">
                <Typography variant="h3" className="font-semibold text-[#d2d2d2] hidden md:block">
                  {post.title}
                </Typography>
                <Typography variant="h4" className="font-semibold text-[#d2d2d2] md:hidden">
                  {post.title}
                </Typography>

                <Box className={`flex flex-wrap items-baseline gap-x-4 pt-4 ${rubikFont.className}`}>
                  {post.publishedAt ? (
                    <Typography variant="caption" className="text-[#7a61ff]">
                      {/* A machine-readable date beside the human one, so the
                          published date is not only in JSON-LD. */}
                      <time dateTime={post.publishedAt}>{formatDay(post.publishedAt)}</time>
                    </Typography>
                  ) : null}

                  <Typography variant="caption" className="text-[#d2d2d2] opacity-70">
                    {post.readingMinutes} min read
                  </Typography>

                  <Typography variant="caption" className="text-[#d2d2d2] opacity-70">
                    {authorName}
                  </Typography>
                </Box>

                {post.tags.length ? (
                  <Box className="flex flex-wrap pt-5">
                    {post.tags.map((tag) => (
                      <TagPill
                        key={tag.slug}
                        name={tag.name}
                        href={`/blog?tag=${encodeURIComponent(tag.slug)}`}
                      />
                    ))}
                  </Box>
                ) : null}
              </header>

              {post.cover?.url ? (
                <Box className="pb-10">
                  <Image
                    src={post.cover.url}
                    alt={post.coverAlt || post.cover.alt || ''}
                    width={post.cover.width ?? 1200}
                    height={post.cover.height ?? 630}
                    className="rounded"
                    sizes="(max-width: 820px) 100vw, 820px"
                    style={{ width: '100%', height: 'auto' }}
                    priority
                  />
                </Box>
              ) : null}

              <BlogPostBody markdown={post.contentMarkdown} />
            </article>

            <Box className="border-t border-[#d2d2d2]/20 mt-14 pt-8">
              {canonical ? <ShareRow url={canonical} title={post.title} /> : null}
            </Box>

            {/* Previous is the next post *older* — the direction a reader moving
                backwards through an archive expects. */}
            {neighbours.previous || neighbours.next ? (
              <Box className="grid md:grid-cols-2 gap-4 mt-10">
                {neighbours.previous ? (
                  <Link
                    href={`/blog/${neighbours.previous.slug}`}
                    className={`bg-[#233352] rounded p-5 transform transition duration-500 hover:scale-105 ${rubikFont.className}`}
                  >
                    <Typography variant="caption" className="text-[#7a61ff]">
                      ← Previous
                    </Typography>
                    <Typography variant="subtitle1" className="text-[#d6d6d6] font-[600]">
                      {neighbours.previous.title}
                    </Typography>
                  </Link>
                ) : (
                  <Box />
                )}

                {neighbours.next ? (
                  <Link
                    href={`/blog/${neighbours.next.slug}`}
                    className={`bg-[#233352] rounded p-5 transform transition duration-500 hover:scale-105 md:text-right ${rubikFont.className}`}
                  >
                    <Typography variant="caption" className="text-[#7a61ff]">
                      Next →
                    </Typography>
                    <Typography variant="subtitle1" className="text-[#d6d6d6] font-[600]">
                      {neighbours.next.title}
                    </Typography>
                  </Link>
                ) : null}
              </Box>
            ) : null}
          </Box>
        </Box>

        <Footer profile={profile} />
      </main>
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

  const [neighbours, seo, profile, sections] = await Promise.all([
    getPostNeighbours(post.publishedAt),
    getSeoSettings(),
    getProfile(),
    getSectionCopy(),
  ]);

  return {
    props: {
      post,
      neighbours,
      seo,
      profile,
      nav: navFromSections(sections, { hasPosts: true }),
      // Built here rather than in the component: `window.location` is not
      // available while prerendering, and a canonical URL that only appears
      // client-side is a canonical URL search engines never see.
      canonical: absoluteUrl(seo?.canonicalUrl, `/blog/${post.slug}`),
    },
    revalidate: 60,
  };
}
