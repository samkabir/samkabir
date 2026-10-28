import { AnimatePresence, LayoutGroup, motion, useMotionValueEvent, useScroll } from 'motion/react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { isActivePath } from '../../lib/siteNav';
import { EASE_IN_OUT, EASE_OUT } from './ease';
import { Roll } from './motion';
import { TLink, useShell } from './Shell';
import { ThemeToggle } from './theme';

/**
 * The top bar. It slides away while you scroll down and comes back as soon as
 * you scroll up; once the page has moved it gains a frosted backing.
 *
 * The links share a hover pill that glides from one to the next (a shared
 * `layoutId`), and the current page is marked by a dot that does the same as
 * you move between pages. On small screens the links move into a full-screen
 * menu that opens as a circle from the button.
 */
export default function Nav({ items = [], socialLinks = [], email }) {
    const { pathname } = useRouter();
    const { lenis, ready } = useShell();
    const { scrollY } = useScroll();
    const [hidden, setHidden] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [open, setOpen] = useState(false);
    const [hovered, setHovered] = useState(null);
    const menuButton = useRef(null);

    useMotionValueEvent(scrollY, 'change', (y) => {
        const previous = scrollY.getPrevious() ?? 0;
        setHidden(y > previous && y > 200);
        setScrolled(y > 12);
    });

    useEffect(() => {
        if (!open) return undefined;
        const smooth = lenis.current;
        smooth?.stop();
        const onKey = (event) => {
            if (event.key === 'Escape') {
                setOpen(false);
                menuButton.current?.focus();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => {
            smooth?.start();
            window.removeEventListener('keydown', onKey);
        };
    }, [open, lenis]);

    const pageLinks = items.filter((item) => item.href.startsWith('/'));
    const contact = items.find((item) => item.key === 'contact');

    return (
        <>
            <motion.header
                className="fixed inset-x-0 top-0 z-50"
                initial={{ y: '-140%' }}
                animate={{ y: ready && !(hidden && !open) ? '0%' : '-140%' }}
                transition={{ duration: 0.7, ease: EASE_OUT }}
            >
                <div className="mx-auto max-w-[1440px] px-4 sm:px-8 pt-3">
                    <div
                        className={`relative flex items-center justify-between h-14 rounded-full pl-4 pr-2 transition-[background-color,box-shadow,backdrop-filter] duration-500 ${
                            scrolled && !open
                                ? 'bg-[color:color-mix(in_srgb,var(--mo-elev)_80%,transparent)] backdrop-blur-xl shadow-[0_0_0_1px_var(--mo-line),0_10px_30px_-18px_rgba(0,0,0,0.35)]'
                                : ''
                        }`}
                    >
                        <TLink href="/" label="Home" aria-label="Home" className="relative z-[61] flex items-center" onClick={() => setOpen(false)}>
                            <Image src="/images/Logo.png" alt="" width={342} height={262} priority className="mo-logo" style={{ width: 34, height: 'auto' }} />
                        </TLink>

                        <nav aria-label="Primary" className="hidden md:block absolute left-1/2 -translate-x-1/2">
                            <LayoutGroup id="nav">
                                <ul className="flex items-center gap-1" onPointerLeave={() => setHovered(null)}>
                                    {pageLinks.map((item) => {
                                        const active = isActivePath(item.href, pathname);
                                        return (
                                            <li key={item.key} className="relative" onPointerEnter={() => setHovered(item.key)}>
                                                {hovered === item.key ? (
                                                    <motion.span
                                                        layoutId="nav-hover"
                                                        className="absolute inset-0 rounded-full bg-mo-sunk"
                                                        transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                                                    />
                                                ) : null}
                                                <TLink
                                                    href={item.href}
                                                    label={item.label}
                                                    aria-current={active ? 'page' : undefined}
                                                    className={`relative flex items-center h-10 px-4 text-[14px] font-medium ${active ? 'text-mo-fg' : 'text-mo-muted hover:text-mo-fg'} transition-colors`}
                                                >
                                                    <Roll>{item.label}</Roll>
                                                    {active ? (
                                                        <motion.span
                                                            layoutId="nav-active"
                                                            className="absolute left-1/2 -bottom-0.5 -ml-[2.5px] w-[5px] h-[5px] rounded-full bg-mo-accent"
                                                        />
                                                    ) : null}
                                                </TLink>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </LayoutGroup>
                        </nav>

                        <div className="relative z-[61] flex items-center gap-1.5">
                            <ThemeToggle />
                            {contact ? (
                                <TLink href={contact.href} className="hidden md:inline-flex mo-btn mo-btn--solid mo-btn--sm">
                                    <Roll>{contact.label}</Roll>
                                </TLink>
                            ) : null}
                            <button
                                ref={menuButton}
                                type="button"
                                className="md:hidden grid place-items-center w-10 h-10 rounded-full bg-mo-fg text-mo-bg"
                                aria-expanded={open}
                                aria-controls="mo-menu"
                                aria-label={open ? 'Close menu' : 'Open menu'}
                                onClick={() => setOpen((value) => !value)}
                            >
                                <span className="relative block w-4 h-4" aria-hidden="true">
                                    {[-1, 1].map((side) => (
                                        <motion.span
                                            key={side}
                                            className="absolute left-0 right-0 top-1/2 -mt-[0.75px] h-[1.5px] bg-current rounded-full"
                                            initial={false}
                                            animate={open ? { y: 0, rotate: side * 45 } : { y: side * 3.5, rotate: 0 }}
                                            transition={{ duration: 0.45, ease: EASE_OUT }}
                                        />
                                    ))}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            </motion.header>

            <AnimatePresence>
                {open ? (
                    <motion.div
                        id="mo-menu"
                        key="menu"
                        className="fixed inset-0 z-[49] flex flex-col justify-between bg-mo-bg px-6 pt-28 pb-10 md:hidden"
                        initial={{ clipPath: 'circle(0% at calc(100% - 44px) 44px)' }}
                        animate={{ clipPath: 'circle(150% at calc(100% - 44px) 44px)' }}
                        exit={{ clipPath: 'circle(0% at calc(100% - 44px) 44px)' }}
                        transition={{ duration: 0.75, ease: EASE_IN_OUT }}
                        data-lenis-prevent
                    >
                        <nav aria-label="Menu">
                            <ul>
                                {[{ key: 'home', label: 'Home', href: '/' }, ...items].map((item, i) => (
                                    <li key={item.key} className="overflow-hidden border-b border-mo-line">
                                        <motion.div
                                            initial={{ y: '100%' }}
                                            animate={{ y: '0%' }}
                                            exit={{ y: '100%' }}
                                            transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.2 + i * 0.06 }}
                                        >
                                            <TLink
                                                href={item.href}
                                                label={item.label}
                                                onClick={() => setOpen(false)}
                                                className="flex items-baseline justify-between py-4 text-[40px] leading-none mo-display"
                                            >
                                                {item.label}
                                                <span className="mo-label text-mo-faint">0{i + 1}</span>
                                            </TLink>
                                        </motion.div>
                                    </li>
                                ))}
                            </ul>
                        </nav>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.5 }}
                            className="space-y-3"
                        >
                            {email ? (
                                <a href={`mailto:${email}`} className="block text-[17px] text-mo-fg">
                                    {email}
                                </a>
                            ) : null}
                            <ul className="flex flex-wrap gap-x-5 gap-y-2">
                                {socialLinks.map((link) => (
                                    <li key={link.id}>
                                        <a href={link.url} target="_blank" rel="noreferrer" className="mo-label text-mo-muted">
                                            {link.label} ↗
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </motion.div>
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </>
    );
}
