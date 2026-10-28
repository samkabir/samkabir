import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { isActivePath } from '../../lib/siteNav';
import { openPalette } from './CommandPalette';
import { ThemeToggle } from './theme';
import * as Icon from './icons';

/**
 * The top bar: the monogram home link, the page links, a search button that
 * opens the command palette, and the theme toggle.
 *
 * It is transparent over the top of the page and turns to frosted glass with a
 * hairline once the page scrolls. The current page's link is marked with
 * `aria-current`, which is also what styles it. Below `sm` the links fold into a
 * small sheet under the bar.
 *
 * Only the monogram identifies whose site this is — the name is said once, in
 * the hero, rather than in every corner.
 */
const NavLink = ({ item, pathname, onClick, className = 'ss-navlink' }) => {
    const current = isActivePath(item.href, pathname) ? 'page' : undefined;
    return item.href.startsWith('#') ? (
        <a href={item.href} className={className} onClick={onClick}>{item.label}</a>
    ) : (
        <Link href={item.href} className={className} aria-current={current} onClick={onClick}>{item.label}</Link>
    );
};

const Nav = ({ items = [], name }) => {
    const { pathname } = useRouter();
    const [scrolled, setScrolled] = useState(false);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        let frame = 0;
        const update = () => {
            frame = 0;
            setScrolled(window.scrollY > 8);
        };
        const onScroll = () => {
            if (!frame) frame = requestAnimationFrame(update);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
        return () => {
            window.removeEventListener('scroll', onScroll);
            if (frame) cancelAnimationFrame(frame);
        };
    }, []);

    const close = () => setOpen(false);

    return (
        <header className="ss-nav sticky top-0 z-50" data-scrolled={scrolled || open}>
            <div className="mx-auto max-w-5xl px-5 sm:px-8 h-16 flex items-center gap-2">
                <Link href="/" aria-label={name ? `${name} — home` : 'Home'} className="mr-auto flex items-center rounded-full p-1 -ml-1 transition-opacity hover:opacity-70">
                    {/* Intrinsic 342×262; the browser reserves the box from these. */}
                    <Image src="/images/Logo.png" alt="" width={342} height={262} priority className="ss-logo" style={{ width: 34, height: 'auto' }} />
                </Link>

                <nav aria-label="Main" className="hidden sm:flex items-center gap-1">
                    {items.map((item) => (
                        <NavLink key={item.key} item={item} pathname={pathname} />
                    ))}
                </nav>

                <button
                    type="button"
                    onClick={openPalette}
                    className="hidden sm:inline-flex items-center gap-2 h-9 pl-3 pr-1.5 ml-2 rounded-full border border-ss-line bg-ss-elev text-[13px] text-ss-muted hover:text-ss-fg hover:border-ss-faint transition-colors"
                    aria-label="Open command menu"
                >
                    <Icon.Search className="w-3.5 h-3.5" />
                    Search
                    <kbd className="ss-kbd">⌘K</kbd>
                </button>
                <button
                    type="button"
                    onClick={openPalette}
                    className="sm:hidden grid place-items-center w-9 h-9 rounded-full text-ss-muted hover:text-ss-fg hover:bg-ss-subtle"
                    aria-label="Open command menu"
                >
                    <Icon.Search className="w-[18px] h-[18px]" />
                </button>
                <ThemeToggle />
                <button
                    type="button"
                    onClick={() => setOpen(!open)}
                    className="sm:hidden grid place-items-center w-9 h-9 rounded-full text-ss-fg hover:bg-ss-subtle"
                    aria-label={open ? 'Close menu' : 'Open menu'}
                    aria-expanded={open}
                    aria-controls="ss-mobile-nav"
                >
                    {open ? <Icon.Close className="w-[18px] h-[18px]" /> : <Icon.Menu className="w-[18px] h-[18px]" />}
                </button>
            </div>

            <div
                id="ss-mobile-nav"
                className={`sm:hidden grid transition-[grid-template-rows] duration-500 ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
            >
                <nav aria-label="Main" className="overflow-hidden">
                    <ul className="px-5 pb-5 pt-1">
                        {items.map((item) => (
                            <li key={item.key}>
                                <NavLink
                                    item={item}
                                    pathname={pathname}
                                    onClick={close}
                                    className="flex items-center justify-between py-3 border-b border-ss-line text-[17px] text-ss-fg"
                                />
                            </li>
                        ))}
                    </ul>
                </nav>
            </div>
        </header>
    );
};

export default Nav;
