import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * The nav, built from `SectionCopy` rows rather than four hardcoded `<li>`s.
 *
 * The numbering and labels used to live in two places at once — here and in each
 * section component — so renumbering meant editing both files and hoping they
 * agreed. `lib/content.js` derives this list from the same rows the sections read,
 * and drops any row without an anchor so a half-filled dashboard form cannot
 * produce a link to nowhere.
 *
 * Each entry carries a full `href`, which is what lets one list hold both kinds
 * of destination: `#about` scrolls this page, `/blog` leaves it. Routes go
 * through `next/link` so navigation stays client-side; anchors stay plain `<a>`,
 * because `Link` on a same-page fragment adds a history entry and a scroll
 * behaviour nobody asked for. Blog appears only when a post is published — see
 * `navFromSections`.
 *
 * `sections` defaults to `[]` rather than to the old hardcoded list: an empty nav
 * on an unseeded database is obviously empty, whereas a fallback list would look
 * correct while linking to sections that are not there.
 *
 * The bar is sticky and turns to frosted glass once the page has scrolled. It
 * slides away while scrolling down and comes back on any scroll up, and the link
 * for whichever section is in view is highlighted — that one is found with an
 * `IntersectionObserver` on the anchors the nav already knows about, so a link to
 * `/blog` simply never matches.
 */
function useScrollState() {
    const [state, setState] = useState({ scrolled: false, hidden: false });

    useEffect(() => {
        let last = window.scrollY;
        let frame = 0;

        const update = () => {
            frame = 0;
            const y = window.scrollY;
            const delta = y - last;
            setState((prev) => {
                const scrolled = y > 12;
                // A small dead zone, so a trackpad's jitter does not flicker the bar.
                const hidden = y > 160 && Math.abs(delta) > 4 ? delta > 0 : prev.hidden && y > 160;
                return prev.scrolled === scrolled && prev.hidden === hidden ? prev : { scrolled, hidden };
            });
            last = y;
        };

        const onScroll = () => {
            if (!frame) frame = requestAnimationFrame(update);
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        update();
        return () => {
            window.removeEventListener('scroll', onScroll);
            if (frame) cancelAnimationFrame(frame);
        };
    }, []);

    return state;
}

function useActiveSection(sections) {
    const [active, setActive] = useState(null);
    const anchors = sections.filter((s) => s.href.startsWith('#')).map((s) => s.href.slice(1));
    const key = anchors.join('|');

    useEffect(() => {
        if (typeof IntersectionObserver === 'undefined') return undefined;
        const nodes = key.split('|').map((id) => id && document.getElementById(id)).filter(Boolean);
        if (!nodes.length) return undefined;

        const io = new IntersectionObserver(
            (entries) => {
                const visible = entries.filter((e) => e.isIntersecting);
                if (visible.length) setActive(visible[0].target.id);
            },
            { rootMargin: '-45% 0px -50% 0px' },
        );
        nodes.forEach((node) => io.observe(node));
        return () => io.disconnect();
    }, [key]);

    return active;
}

const NavLabel = ({ section }) => (
    <>
        {section.numberLabel ? (
            <span className="font-mono text-[0.8em] text-accent mr-1">{section.numberLabel}</span>
        ) : null}
        {section.label}
    </>
);

const NavLink = ({ section, className, onClick, style }) =>
    section.href.startsWith('#') ? (
        <a href={section.href} className={className} onClick={onClick} style={style}>
            <NavLabel section={section} />
        </a>
    ) : (
        <Link href={section.href} className={className} onClick={onClick} style={style}>
            <NavLabel section={section} />
        </Link>
    );

const Header = ({ sections = [] }) => {
    const [navbar, setNavbar] = useState(false);
    const { scrolled, hidden } = useScrollState();
    const active = useActiveSection(sections);

    useEffect(() => {
        if (!navbar) return undefined;
        const onKey = (event) => event.key === 'Escape' && setNavbar(false);
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [navbar]);

    const solid = scrolled || navbar;

    return (
        <header
            className={`site sticky top-0 z-50 w-full transition-all duration-500 ${
                hidden && !navbar ? '-translate-y-full' : 'translate-y-0'
            } ${
                solid
                    ? 'bg-[rgba(11,18,34,0.72)] backdrop-blur-xl border-b border-[rgba(148,163,222,0.1)] shadow-[0_10px_30px_-15px_rgba(2,6,23,0.9)]'
                    : 'bg-transparent border-b border-transparent'
            }`}
        >
            <nav className="flex items-center justify-between px-5 md:px-10 mx-auto max-w-7xl h-[72px]">
                <Link href="/" aria-label="Home" className="group relative flex items-center fade-up">
                    <span
                        aria-hidden="true"
                        className="absolute -inset-2 rounded-xl bg-accent opacity-0 blur-lg transition-opacity duration-500 group-hover:opacity-30"
                    />
                    {/* Intrinsic size 342×262, rendered at 46px wide. Passing both
                        lets the browser reserve the right box before the file
                        arrives, which is what the plain <img> could not do. */}
                    <Image
                        src="/images/Logo.png"
                        alt="Logo"
                        width={342}
                        height={262}
                        priority
                        className="relative transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6"
                        style={{ width: '46px', height: 'auto' }}
                    />
                </Link>

                <ul className="hidden md:flex items-center gap-1 text-sm font-medium">
                    {sections.map((section, i) => {
                        const isActive = active && section.href === `#${active}`;
                        return (
                            <li key={section.key} className="fade-up" style={{ '--delay': `${100 + i * 70}ms` }}>
                                <NavLink
                                    section={section}
                                    className={`relative block px-3 py-2 rounded-full transition-colors duration-300 ${
                                        isActive
                                            ? 'text-white bg-[rgba(122,97,255,0.14)]'
                                            : 'text-[#94a0bf] hover:text-white hover:bg-[rgba(255,255,255,0.04)]'
                                    }`}
                                />
                            </li>
                        );
                    })}
                </ul>

                <button
                    type="button"
                    className="md:hidden relative w-10 h-10 rounded-full text-[#e6e9f5] border border-[rgba(148,163,222,0.18)] bg-[rgba(255,255,255,0.03)]"
                    aria-label={navbar ? 'Close menu' : 'Open menu'}
                    aria-expanded={navbar}
                    aria-controls="mobile-menu"
                    onClick={() => setNavbar(!navbar)}
                >
                    <span
                        className={`absolute left-1/2 top-1/2 h-[2px] w-4 -translate-x-1/2 rounded bg-current transition-transform duration-300 ${
                            navbar ? 'rotate-45' : '-translate-y-[5px]'
                        }`}
                    />
                    <span
                        className={`absolute left-1/2 top-1/2 h-[2px] w-4 -translate-x-1/2 rounded bg-current transition-opacity duration-300 ${
                            navbar ? 'opacity-0' : 'opacity-100'
                        }`}
                    />
                    <span
                        className={`absolute left-1/2 top-1/2 h-[2px] w-4 -translate-x-1/2 rounded bg-current transition-transform duration-300 ${
                            navbar ? '-rotate-45' : 'translate-y-[5px]'
                        }`}
                    />
                </button>
            </nav>

            <div
                id="mobile-menu"
                className={`md:hidden overflow-hidden transition-[max-height] duration-500 ${
                    navbar ? 'max-h-[80vh] menu-open' : 'max-h-0'
                }`}
            >
                <ul className="px-5 pb-6 pt-2 space-y-1 text-lg font-medium">
                    {sections.map((section, i) => (
                        <li key={section.key}>
                            <NavLink
                                section={section}
                                onClick={() => setNavbar(false)}
                                className="menu-link block py-3 border-b border-[rgba(148,163,222,0.08)] text-[#e6e9f5]"
                                style={{ '--i': i }}
                            />
                        </li>
                    ))}
                </ul>
            </div>
        </header>
    );
};

export default Header;
