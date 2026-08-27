import { Box, Typography } from '@mui/material';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

import BlogCard from '@/components/Blog/BlogCard';
import TagPill from '@/components/Blog/TagPill';
import Footer from '@/components/Footer/Footer';
import Header from '@/components/Header/header';
import { rubikFont } from '@/lib/fonts';
import { absoluteUrl } from '@/lib/seo';
import {
  getPostTags,
  getProfile,
  getPublishedPosts,
  getSectionCopy,
  getSeoSettings,
  navFromSections,
} from '@/lib/content';

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
export default function BlogIndex({ posts, tags, seo, profile, nav }) {
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
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/images/Logo.png" />
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

      <main>
        <Header sections={nav} />

        <Box className="px-4 md:px-20 py-8 cursor-default">
          <Box className="px-4 md:px-20">
            <Box className="py-10">
              <Typography variant="h4" className="font-semibold text-[#d2d2d2]">
                <span className="text-[#7a61ff]">100. </span> Writing
              </Typography>

              <Typography variant="subtitle1" className={`text-[#d2d2d2] pt-4 ${rubikFont.className}`}>
                Notes on the things I build, and the mistakes that taught me
                something.
              </Typography>

              {tags.length ? (
                <Box className="flex flex-wrap items-center pt-8">
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
                </Box>
              ) : null}
            </Box>

            {visible.length ? (
              <Box className="md:grid md:grid-cols-3 gap-4 items-stretch">
                {visible.map((post) => (
                  <BlogCard key={post.id} post={post} />
                ))}
              </Box>
            ) : (
              /**
               * Two different empty states, because they mean different things.
               * "No posts yet" is a site that has not started; "nothing under this
               * tag" is a filter to clear. Showing the first when the second is
               * true reads as a broken page.
               */
              <Box className="py-16 text-center">
                <Typography variant="h6" className={`text-[#d2d2d2] ${rubikFont.className}`}>
                  {activeTag ? `Nothing filed under ${activeTagName} yet.` : 'No posts yet.'}
                </Typography>

                <Typography variant="subtitle2" className={`text-[#d2d2d2] opacity-70 pt-2 ${rubikFont.className}`}>
                  {activeTag ? (
                    <Link href="/blog" className="text-[#64ffda] underline">
                      Show everything
                    </Link>
                  ) : (
                    'Something will land here soon.'
                  )}
                </Typography>
              </Box>
            )}

            <Box className="flex justify-center mt-14">
              <Link
                href="/"
                className="transform transition duration-500 border-2 border-[#7a61ff] py-2 px-6 my-4 font-semibold text-[#7a61ff] hover:text-[#000] hover:bg-[#7a61ff] normal-case"
              >
                Back to the portfolio
              </Link>
            </Box>
          </Box>
        </Box>

        <Footer profile={profile} />
      </main>
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
  const [{ posts }, tags, seo, profile, sections] = await Promise.all([
    getPublishedPosts(),
    getPostTags(),
    getSeoSettings(),
    getProfile(),
    getSectionCopy(),
  ]);

  return {
    props: {
      posts,
      tags,
      seo,
      profile,
      // `hasPosts` is true by definition on a page listing them — but only if
      // there are any, and an empty archive should still not advertise itself in
      // the nav.
      nav: navFromSections(sections, { hasPosts: posts.length > 0 }),
    },
    revalidate: 60,
  };
}
