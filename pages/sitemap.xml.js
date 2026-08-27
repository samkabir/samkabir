import { getPublishedPostSlugs, getSeoSettings } from '@/lib/content';
import { absoluteUrl } from '@/lib/seo';

/**
 * `/sitemap.xml`, generated from the database on request.
 *
 * Server-rendered rather than static, and that is the whole reason it exists as a
 * page: a sitemap built at deploy time stops listing new posts the moment the
 * deploy is older than the newest post. Publishing from the dashboard has to be
 * enough, and here it is — the next crawl sees the new URL.
 *
 * Escaping matters more than it looks. A slug is derived from a title through
 * `lib/slug.js` and cannot contain `&` or `<` today, but a sitemap that would
 * break on one is a sitemap that breaks silently later: an invalid document is
 * rejected wholesale, so one bad character would delist the entire site rather
 * than one URL.
 */
function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlEntry({ loc, lastmod, changefreq, priority }) {
  return [
    '  <url>',
    `    <loc>${escapeXml(loc)}</loc>`,
    lastmod ? `    <lastmod>${escapeXml(lastmod.slice(0, 10))}</lastmod>` : null,
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : null,
    priority ? `    <priority>${priority}</priority>` : null,
    '  </url>',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function getServerSideProps({ res }) {
  const [seo, posts] = await Promise.all([getSeoSettings(), getPublishedPostSlugs()]);

  /**
   * Without a canonical URL there is nothing to write.
   *
   * A sitemap of relative paths is invalid — `<loc>` must be absolute — and one
   * built from a guessed host would point search engines at the wrong domain,
   * which is worse than having no sitemap. So this 404s until the canonical URL
   * is set on the Settings screen, and says so where someone will read it.
   */
  if (!seo?.canonicalUrl) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.write(
      'No sitemap: the canonical URL is not set. Add it on /admin/settings — a sitemap needs absolute URLs and guessing the host would point crawlers at the wrong domain.\n'
    );
    res.end();
    return { props: {} };
  }

  const newestPost = posts[0]?.updatedAt ?? null;

  const entries = [
    // The home page changes whenever any content does, so its lastmod is the most
    // recent thing on the site rather than a fixed date.
    { loc: absoluteUrl(seo.canonicalUrl, '/'), lastmod: newestPost, changefreq: 'weekly', priority: '1.0' },
    ...(posts.length
      ? [{ loc: absoluteUrl(seo.canonicalUrl, '/blog'), lastmod: newestPost, changefreq: 'weekly', priority: '0.8' }]
      : []),
    ...posts.map((post) => ({
      loc: absoluteUrl(seo.canonicalUrl, `/blog/${post.slug}`),
      lastmod: post.updatedAt,
      changefreq: 'monthly',
      priority: '0.7',
    })),
  ];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(urlEntry),
    '</urlset>',
  ].join('\n');

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  // Cached at the edge for an hour: a crawler re-fetching this does not need to
  // wake the database, and an hour is far tighter than any crawl interval.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
  res.write(xml);
  res.end();

  return { props: {} };
}

/**
 * Never rendered — `getServerSideProps` ends the response itself.
 *
 * Next.js still requires a default export from a page module, so this exists to
 * satisfy that and returns null rather than throwing, which would turn a
 * successfully written sitemap into a 500 in the logs.
 */
export default function Sitemap() {
  return null;
}
