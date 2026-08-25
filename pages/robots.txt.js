import { getSeoSettings } from '@/lib/content';
import { absoluteUrl } from '@/lib/seo';

/**
 * `/robots.txt`, served rather than committed.
 *
 * A static file in `public/` would be simpler, but it cannot know the canonical
 * URL — and a `Sitemap:` line is only useful if it is absolute. Generating it here
 * means setting the canonical URL on the Settings screen is the single action that
 * makes both this and `/sitemap.xml` correct.
 *
 * `/admin` and `/api` are disallowed as a courtesy to crawlers, not as a control:
 * the dashboard is protected by a server-side session check on every page and
 * every endpoint, and the admin pages already send `noindex`. A `robots.txt` entry
 * is a request that well-behaved bots honour — it is emphatically not a security
 * boundary, and treating it as one is how an unguarded route ends up shipped
 * because "robots.txt covers it".
 */
export async function getServerSideProps({ res }) {
  const seo = await getSeoSettings();
  const sitemap = absoluteUrl(seo?.canonicalUrl, '/sitemap.xml');

  const lines = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /api/',
    '',
    ...(sitemap ? [`Sitemap: ${sitemap}`, ''] : []),
  ];

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
  res.write(lines.join('\n'));
  res.end();

  return { props: {} };
}

export default function Robots() {
  return null;
}
