import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * The landing page's navigation: logo on the left, a floating glass pill of
 * section links in the middle, and a "Let's talk" button on the right. On a phone
 * the pill gives way to a round button that opens a full-screen lime menu.
 *
 * The links are the same `nav` list the blog header reads (`navFromSections`), so
 * renaming or hiding a section in the dashboard changes both. A soft blob slides
 * behind whichever link's section is on screen; that is found with one
 * `IntersectionObserver` over the anchors the list already names, so `/blog`
 * simply never matches.
 */
function useActiveSection(items) {
    const [active, setActive] = useState(null);
    const key = items.filter((s) => s.href.startsWith('#')).map((s) => s.href.slice(1)).join('|');

    useEffect(() => {
        if (typeof IntersectionObserver === 'undefined') return undefined;
        const nodes = key.split('|').map((id) => id && document.getElementById(id)).filter(Boolean);
        if (!nodes.length) return undefined;

        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) setActive(entry.target.id);
                });
            },
            { rootMargin: '-45% 0px -50% 0px' },
        );
        nodes.forEach((node) => io.observe(node));
        return () => io.disconnect();
    }, [key]);

    return active;
}

const NavItem = ({ item, ...rest }) =>
    item.href.startsWith('#') ? (
        <a href={item.href} {...rest}>{item.label}</a>
    ) : (
        <Link href={item.href} {...rest}>{item.label}</Link>
    );

const Nav = ({ items = [], contactHref = '#contact', email, socialLinks = [] }) => {
    const [open, setOpen] = useState(false);
    const [blob, setBlob] = useState(null);
    const active = useActiveSection(items);
    const pillRef = useRef(null);

    useIsoLayoutEffect(() => {
        const measure = () => {
            const link = active && pillRef.current?.querySelector(`a[href="#${active}"]`);
            setBlob(link ? { left: link.offsetLeft, width: link.offsetWidth } : null);
        };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [active]);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (event) => event.key === 'Escape' && setOpen(false);
        document.documentElement.style.overflow = 'hidden';
        window.addEventListener('keydown', onKey);
        return () => {
            document.documentElement.style.overflow = '';
            window.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const close = () => setOpen(false);

    return (
        <>
            <header className="lp-nav lp-fade" style={{ '--d': '900ms' }}>
                <Link href="/" aria-label="Home" className="relative z-[60] grid place-items-center w-12 h-12 rounded-full lp-pill !p-0">
                    {/* Intrinsic size 342×262; the browser reserves the box from these. */}
                    <Image src="/images/Logo.png" alt="" width={342} height={262} priority style={{ width: 30, height: 'auto' }} />
                </Link>

                {items.length ? (
                    <nav aria-label="Sections" className="hidden md:block">
                        <div ref={pillRef} className="lp-pill relative">
                            <span
                                aria-hidden="true"
                                className="lp-pill__blob"
                                style={blob ? { left: blob.left, width: blob.width } : { opacity: 0 }}
                            />
                            {items.map((item) => (
                                <NavItem
                                    key={item.key}
                                    item={item}
                                    aria-current={active && item.href === `#${active}` ? 'true' : undefined}
                                />
                            ))}
                        </div>
                    </nav>
                ) : null}

                <div className="flex items-center gap-2">
                    <a href={contactHref} className="lp-btn lp-btn--lime hidden md:inline-flex">
                        Let&apos;s talk <span className="lp-btn__arrow" aria-hidden="true">→</span>
                    </a>
                    <button
                        type="button"
                        onClick={() => setOpen(!open)}
                        aria-expanded={open}
                        aria-controls="lp-menu"
                        aria-label={open ? 'Close menu' : 'Open menu'}
                        className={`md:hidden relative z-[60] w-12 h-12 rounded-full transition-colors duration-500 ${
                            open ? 'bg-[#10120a] text-[#d4ff4f]' : 'lp-pill !p-0 text-[#f2f0ea]'
                        }`}
                    >
                        <span className={`absolute left-1/2 top-1/2 h-[2px] w-5 -translate-x-1/2 bg-current transition-transform duration-500 ${open ? 'rotate-45' : '-translate-y-[4px]'}`} />
                        <span className={`absolute left-1/2 top-1/2 h-[2px] w-5 -translate-x-1/2 bg-current transition-transform duration-500 ${open ? '-rotate-45' : 'translate-y-[4px]'}`} />
                    </button>
                </div>
            </header>

            <div id="lp-menu" className="lp-menu md:hidden" data-open={open} aria-hidden={!open}>
                <nav aria-label="Menu">
                    {[...items, { key: 'contact-cta', label: "Let's talk", href: contactHref }].map((item, i) => (
                        <NavItem
                            key={item.key}
                            item={item}
                            onClick={close}
                            tabIndex={open ? 0 : -1}
                            className="lp-menu__link"
                            style={{ '--i': i }}
                        />
                    ))}
                </nav>
                <div className="mt-10 pt-6 border-t border-[rgba(16,18,10,0.2)] flex flex-wrap gap-x-6 gap-y-2 lp-mono">
                    {email ? <a href={`mailto:${email}`} tabIndex={open ? 0 : -1}>{email}</a> : null}
                    {socialLinks.map((link) => (
                        <a key={link.id} href={link.url} target="_blank" rel="noreferrer" tabIndex={open ? 0 : -1}>
                            {link.label} ↗
                        </a>
                    ))}
                </div>
            </div>
        </>
    );
};

export default Nav;
