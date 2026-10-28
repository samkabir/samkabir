import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';

import TagPill from '@/components/Blog/TagPill';
import PageHeader from '@/components/site/PageHeader';
import SiteLayout from '@/components/site/SiteLayout';
import { EASE_OUT } from '@/components/site/ease';
import * as Icon from '@/components/site/icons';
import { Reveal } from '@/components/site/motion';
import { TLink } from '@/components/site/Shell';
import { formatDay } from '@/lib/adminFormat';
import { absoluteUrl } from '@/lib/seo';
import { getPostTags, getPublishedPosts, getSiteChrome } from '@/lib/content';

/**
 * `/blog` — the archive.
 *
 * Filtering by tag happens **client-side from a query string**, not as a separate
 * route. `/blog?tag=nextjs` keeps one statically generated page instead of one per
 * tag, which matters because the alternative needs `getStaticPaths` over tags and
 * a rebuild of each archive page whenever any post changes. With a personal blog's
 * volume, every post is already in these props, so filtering is a array filter and
 * costs nothing.
 *
 * The consequence to be honest about: a tag archive is not separately indexable.
 * That is the right trade here — `/blog?tag=x` pages are thin, near-duplicate
 * content that search engines discount anyway, and the canonical URL below points
 * at `/blog` so they are not competing with it.
 */
export default function BlogIndex({ posts, tags, chrome }) {
  const { seo, profile } = chrome ?? {};
  const router = useRouter();

  const activeTag = typeof router.query.tag === 'string' ? router.query.tag : null;
  const visible = activeTag
    ? posts.filter((post) => post.tags.some((tag) => tag.slug === activeTag))
    : posts;

  const activeTagName = tags.find((tag) => tag.slug === activeTag)?.name ?? activeTag;

  const siteTitle = seo?.siteTitle || 'Samiul Kabir';
  const title = activeTag ? `${activeTagName} — Blog — ${siteTitle}` : `Blog — ${siteTitle}`;
  const description =
    seo?.defaultDescription
      ? `Writing by ${profile?.fullName || siteTitle}. ${seo.defaultDescription}`
      : `Writing by ${profile?.fullName || siteTitle}.`;

  const canonical = absoluteUrl(seo?.canonicalUrl, '/blog');

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        {/* Always `/blog`, even on a filtered view: the tag pages are the same
            posts in a different order and should not compete for the same query. */}
        {canonical ? <link rel="canonical" href={canonical} /> : null}
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        {canonical ? <meta property="og:url" content={canonical} /> : null}
        <meta name="twitter:card" content="summary" />
        {seo?.twitterHandle ? <meta name="twitter:site" content={seo.twitterHandle} /> : null}
      </Head>

      <SiteLayout chrome={chrome}>
        <PageHeader title="Writing" count={posts.length} lede="Notes on the things I build, and the mistakes that taught me something." />

        <section className="mx-auto max-w-[1440px] px-5 sm:px-8" aria-label="Posts">
          {tags.length ? (
            <Reveal className="flex flex-wrap gap-1.5 mb-10">
              <LayoutGroup id="tags">
                <TagPill name="All" href="/blog" active={!activeTag} />
                {tags.map((tag) => (
                  <TagPill
                    key={tag.slug}
                    name={tag.name}
                    count={tag.count}
                    href={`/blog?tag=${encodeURIComponent(tag.slug)}`}
                    active={tag.slug === activeTag}
                  />
                ))}
              </LayoutGroup>
            </Reveal>
          ) : null}

          {visible.length ? (
            <ul className="border-b border-mo-line">
              <AnimatePresence initial={false} mode="popLayout">
                {visible.map((post, i) => (
                  <motion.li
                    key={post.id}
                    layout
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.7, ease: EASE_OUT, delay: Math.min(i, 6) * 0.06 }}
                    className="border-t border-mo-line"
                  >
                    <TLink href={`/blog/${post.slug}`} label="Writing" className="group mo-row grid gap-4 sm:grid-cols-[200px_1fr_auto] sm:gap-10 py-10 px-2 sm:px-4">
                      <span className="mo-label text-mo-faint flex sm:flex-col gap-x-3 gap-y-1.5">
                        {post.publishedAt ? <time dateTime={post.publishedAt}>{formatDay(post.publishedAt)}</time> : null}
                        <span>{post.readingMinutes} min read</span>
                      </span>
                      <span>
                        <span className="block text-[clamp(26px,3.2vw,44px)] font-medium tracking-[-0.035em] leading-[1.05] transition-transform duration-500 group-hover:translate-x-2">
                          {post.title}
                        </span>
                        {post.excerpt ? <span className="mt-3 block max-w-2xl text-[16px] leading-relaxed text-mo-muted">{post.excerpt}</span> : null}
                        {post.tags?.length ? (
                          <span className="mt-4 flex flex-wrap gap-1.5">
                            {post.tags.map((tag) => (
                              <span key={tag.slug} className="mo-chip">{tag.name}</span>
                            ))}
                          </span>
                        ) : null}
                      </span>
                      {post.cover?.url ? (
                        <span className="hidden md:block mo-frame w-[220px] aspect-[16/10] rounded-2xl">
                          <Image src={post.cover.url} alt="" fill sizes="220px" className="object-cover" />
                        </span>
                      ) : (
                        <span className="hidden sm:grid place-items-center self-center w-14 h-14 rounded-full border border-mo-line transition-all duration-500 group-hover:bg-mo-accent group-hover:border-transparent group-hover:text-white group-hover:-rotate-45">
                          <Icon.ArrowRight className="w-5 h-5" />
                        </span>
                      )}
                    </TLink>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          ) : (
            /**
             * Two different empty states, because they mean different things.
             * "No posts yet" is a site that has not started; "nothing under this
             * tag" is a filter to clear. Showing the first when the second is
             * true reads as a broken page.
             */
            <div className="py-24 text-center">
              <p className="mo-display text-[clamp(32px,4vw,56px)]">
                {activeTag ? `Nothing filed under ${activeTagName} yet.` : 'No posts yet.'}
              </p>
              <p className="pt-4 text-mo-muted">
                {activeTag ? (
                  <Link href="/blog" className="mo-link text-mo-fg">
                    Show everything
                  </Link>
                ) : (
                  'Something will land here soon.'
                )}
              </p>
            </div>
          )}
        </section>
      </SiteLayout>
    </>
  );
}

/**
 * Statically generated, like the home page, and revalidated on publish.
 *
 * `getPublishedPosts` takes no `take` here: a personal blog's whole archive is
 * smaller than one project screenshot, and pagination that nobody needs is a
 * cursor to get wrong. If the archive ever outgrows one page, `total` is already
 * returned and this is where the slice goes.
 */
export async function getStaticProps() {
  const [{ posts }, tags, chrome] = await Promise.all([
    getPublishedPosts(),
    getPostTags(),
    getSiteChrome(),
  ]);

  return {
    props: {
      posts,
      tags,
      // `chrome.hasPosts` drives the nav's Writing link: true here only if there
      // are posts, so an empty archive still does not advertise itself.
      chrome,
    },
    revalidate: 60,
  };
}
