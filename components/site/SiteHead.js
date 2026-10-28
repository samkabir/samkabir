import Head from 'next/head';
import { absoluteUrl } from '../../lib/seo';

/**
 * Title, description, canonical and Open Graph for a portfolio page, from
 * `SeoSettings`. A canonical URL is only emitted when the dashboard has one set —
 * guessing the host would point crawlers at the wrong domain.
 */
const SiteHead = ({ seo, title, description, path = '/' }) => {
    const siteTitle = seo?.siteTitle || 'Portfolio';
    const fullTitle = title ? `${title} — ${siteTitle}` : siteTitle;
    const desc = description || seo?.defaultDescription || '';
    const canonical = absoluteUrl(seo?.canonicalUrl, path);
    const image = seo?.ogImage?.url;

    return (
        <Head>
            <title>{fullTitle}</title>
            {desc ? <meta name="description" content={desc} /> : null}
            {canonical ? <link rel="canonical" href={canonical} /> : null}
            <meta property="og:type" content="website" />
            <meta property="og:title" content={fullTitle} />
            {desc ? <meta property="og:description" content={desc} /> : null}
            {canonical ? <meta property="og:url" content={canonical} /> : null}
            {image ? <meta property="og:image" content={image} /> : null}
            <meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
            {seo?.twitterHandle ? <meta name="twitter:site" content={seo.twitterHandle} /> : null}
        </Head>
    );
};

export default SiteHead;
