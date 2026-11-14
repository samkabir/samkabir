import Head from 'next/head';
import { siteNav } from '../../lib/siteNav';
import ContactFooter from './ContactFooter';
import { ToastProvider } from './feedback';
import Nav from './Nav';

/**
 * The frame of every public page: nav, the page itself, and the contact footer.
 *
 * `chrome` is the slice of content every page needs for that frame — profile,
 * section copy, social links, whether a résumé and posts exist — which the
 * portfolio pages get from `getPageContent` and the blog pages from
 * `getSiteChrome`. The page sits on a raised sheet with a rounded bottom edge;
 * the footer is underneath it, which is what makes the end of each page read as
 * the sheet lifting away.
 */
export default function SiteLayout({ chrome, children }) {
    const { profile, sections = {}, socialLinks, hasResume = false, hasPosts = false } = chrome ?? {};
    const items = siteNav(sections, { hasPosts });
    const contactLinks = socialLinks?.contact ?? [];

    return (
        <ToastProvider>
            <Head>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" href="/images/Logo.png" />
            </Head>

            <div id="top" className="mo min-h-screen">
                <a
                    href="#content"
                    className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] focus:rounded-full focus:bg-mo-fg focus:text-mo-bg focus:px-4 focus:py-2"
                >
                    Skip to content
                </a>

                <Nav items={items} socialLinks={contactLinks} email={profile?.publicEmail} />

                <div className="relative z-10 bg-mo-bg rounded-b-[28px] sm:rounded-b-[56px] shadow-[0_40px_60px_-40px_rgba(0,0,0,0.5)] pb-24 sm:pb-32">
                    <main id="content">{children}</main>
                </div>

                <ContactFooter section={sections.contact} profile={profile} socialLinks={contactLinks} hasResume={hasResume} />
            </div>
        </ToastProvider>
    );
}
