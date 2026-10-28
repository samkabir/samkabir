import Head from 'next/head';
import { siteNav } from '../../lib/siteNav';
import CommandPalette from './CommandPalette';
import ContactFooter from './ContactFooter';
import { ToastProvider } from './feedback';
import Nav from './Nav';

/**
 * The frame every public page shares: nav, the page itself, the contact footer,
 * the command palette and the toast.
 *
 * `chrome` is the slice of content the frame needs (`getSiteChrome()` or the
 * same keys from `getPageContent()`). `projects` is optional and only feeds the
 * palette, so a blog page can pass none and the palette simply has no project
 * entries.
 *
 * Page-specific `<head>` tags (title, description, canonical, Open Graph) belong
 * to each page; this adds only what every page shares.
 */
const SiteLayout = ({ chrome = {}, projects = [], children }) => {
    const { profile, sections = {}, socialLinks = { sidebar: [], contact: [] }, hasResume = false, hasPosts = false } = chrome;
    const nav = siteNav(sections, { hasPosts });
    const links = socialLinks.contact ?? [];

    return (
        <ToastProvider>
            <Head>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" href="/images/Logo.png" />
            </Head>
            <div className="ss">
                <a
                    href="#content"
                    className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] ss-btn ss-btn--solid"
                >
                    Skip to content
                </a>
                <Nav items={nav} name={profile?.fullName} />
                <main id="content">{children}</main>
                <ContactFooter section={sections.contact} profile={profile} socialLinks={links} hasResume={hasResume} />
                <CommandPalette
                    nav={nav}
                    projects={projects}
                    socialLinks={links}
                    email={profile?.publicEmail}
                    hasResume={hasResume}
                />
            </div>
        </ToastProvider>
    );
};

export default SiteLayout;
