import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

import BlogCard from '@/components/Blog/BlogCard';
import TagPill from '@/components/Blog/TagPill';
import { PageHeader } from '@/components/site/Section';
import SiteLayout from '@/components/site/SiteLayout';
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
        <PageHeader label="Writing" heading="Notes">
          <p>Notes on the things I build, and the mistakes that taught me something.</p>
        </PageHeader>

        <section className="mx-auto max-w-5xl px-5 sm:px-8" aria-label="Posts">
          {tags.length ? (
            <div className="ss-in flex flex-wrap gap-1.5 mb-6" style={{ '--d': '240ms' }}>
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
            </div>
          ) : null}

          {visible.length ? (
            <div className="border-b border-ss-line">
              {visible.map((post) => (
                <BlogCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            /**
             * Two different empty states, because they mean different things.
             * "No posts yet" is a site that has not started; "nothing under this
             * tag" is a filter to clear. Showing the first when the second is
             * true reads as a broken page.
             */
            <div className="py-20 text-center border-t border-ss-line">
              <p className="text-[17px] text-ss-fg">
                {activeTag ? `Nothing filed under ${activeTagName} yet.` : 'No posts yet.'}
              </p>
              <p className="pt-2 text-ss-muted">
                {activeTag ? (
                  <Link href="/blog" className="ss-link text-ss-accent">
                    Show everything
                  </Link>
                ) : (
                  'Something will land here soon.'
                )}
              </p>
            </div>
          )}
        </section>

        <div className="h-8 sm:h-12" />
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
