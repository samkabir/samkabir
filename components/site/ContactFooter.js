import { motion, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';
import { socialIcon } from '../SocialMediaLinks/socialIcons';
import { EASE_OUT } from './ease';
import { useCopy } from './feedback';
import * as Icon from './icons';
import { Magnetic, Roll, useEntrance } from './motion';
import { useShell } from './Shell';

/**
 * The end of every page: the contact block and the footer line, on a dark panel
 * the page appears to lift off as you reach it. The panel sits beneath the
 * page's rounded bottom edge and its contents rise into place as it comes into
 * view (scroll-linked, so it tracks the reader's own speed).
 *
 * It carries `id="contact"`, which the nav's Contact link points at, so
 * "Contact" works from any page. Its copy is the `contact` `SectionCopy` row —
 * `navLabel` as the small label, `heading` as the headline, `subheading`
 * beneath — and the actions come from `Profile.publicEmail`, the active résumé
 * and the social links.
 *
 * The footer keeps the credit and the "Web Design Idea" attribution exactly as
 * `Profile` stores them, and drops the attribution line when either half is
 * empty rather than leaving a dangling "Web Design Idea -".
 */
function Letters({ text }) {
    const ref = useRef(null);
    const show = useEntrance(ref, { amount: 0.4 });
    const words = text.split(' ');
    // Each letter's place in the whole line, so the stagger runs across words.
    const starts = words.map((_, w) => words.slice(0, w).join('').length);

    return (
        <span ref={ref} className="block">
            <span className="sr-only">{text}</span>
            {words.map((word, w) => (
                <span key={w} aria-hidden="true" className="inline-block whitespace-nowrap">
                    {[...word].map((char, c) => (
                        <motion.span
                            key={c}
                            className="mo-mask"
                            whileHover={{ y: '-12%' }}
                            transition={{ type: 'spring', stiffness: 500, damping: 12 }}
                        >
                            <motion.span
                                initial={{ y: '110%' }}
                                animate={{ y: show ? '0%' : '110%' }}
                                transition={{ duration: 1, ease: EASE_OUT, delay: (starts[w] + c) * 0.035 }}
                            >
                                {char}
                            </motion.span>
                        </motion.span>
                    ))}
                    {w < words.length - 1 ? '\u00a0' : null}
                </span>
            ))}
        </span>
    );
}

const ContactFooter = ({ section, profile, socialLinks = [], hasResume = false }) => {
    const copy = useCopy();
    const { lenis } = useShell();
    const ref = useRef(null);
    const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end end'] });
    const y = useTransform(scrollYProgress, [0, 1], ['-28%', '0%']);
    const scale = useTransform(scrollYProgress, [0, 1], [0.94, 1]);

    const email = profile?.publicEmail;
    const credit = profile?.footerCredit;
    const attributionLabel = profile?.attributionLabel;
    const attributionUrl = profile?.attributionUrl;
    const year = new Date().getFullYear();

    const toTop = () => {
        if (lenis.current) lenis.current.scrollTo(0, { duration: 1.6 });
        else window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <footer
            ref={ref}
            id={section?.anchor || 'contact'}
            className="relative z-0 -mt-12 overflow-hidden bg-[color:var(--mo-ink)] text-[color:var(--mo-ink-fg)]"
        >
            <motion.div style={{ y, scale }} className="mx-auto max-w-[1440px] px-5 sm:px-8 pt-32 sm:pt-40 pb-8 origin-bottom">
                <p className="mo-label flex items-center gap-3 text-white/55">
                    <span className="mo-pulse" aria-hidden="true" />
                    {section?.navLabel || 'Contact'}
                </p>

                <h2 className="mt-6 mo-display text-[clamp(56px,12.5vw,210px)]">
                    <Letters text={section?.heading || 'Get In Touch'} />
                </h2>

                <div className="mt-10 grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-end">
                    <div>
                        <p className="max-w-md text-[18px] leading-relaxed text-white/65">
                            {section?.subheading || 'Feel free to contact me anytime.'}
                        </p>
                        {email ? (
                            <a href={`mailto:${email}`} className="group mt-6 inline-flex items-center gap-3 text-[clamp(22px,3vw,40px)] tracking-tight">
                                <span className="mo-link">{email}</span>
                                <Icon.ArrowUpRight className="w-6 h-6 sm:w-8 sm:h-8 text-[color:var(--mo-accent)] transition-transform duration-500 group-hover:translate-x-1 group-hover:-translate-y-1" />
                            </a>
                        ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                        {email ? (
                            <Magnetic>
                                <button
                                    type="button"
                                    className="mo-btn !bg-white !text-[color:var(--mo-ink)] hover:!text-white before:!bg-[color:var(--mo-accent)]"
                                    onClick={() => copy(email, { label: 'Email copied', fallbackHref: `mailto:${email}` })}
                                >
                                    <Icon.Copy className="w-4 h-4" />
                                    <Roll>Copy email</Roll>
                                </button>
                            </Magnetic>
                        ) : null}
                        {hasResume ? (
                            <Magnetic>
                                <a href="/cv" target="_blank" rel="noreferrer" className="mo-btn !text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)] before:!bg-white hover:!text-[color:var(--mo-ink)]">
                                    <Roll>Résumé</Roll>
                                    <Icon.ArrowUpRight className="mo-arrow mo-arrow-ne w-4 h-4" />
                                </a>
                            </Magnetic>
                        ) : null}
                    </div>
                </div>

                <div className="mt-20 sm:mt-28 grid gap-8 border-t border-white/10 pt-8 sm:grid-cols-[1fr_auto] sm:items-end">
                    {socialLinks.length ? (
                        <ul className="flex flex-wrap gap-x-8 gap-y-3">
                            {socialLinks.map((link) => {
                                const { Icon: Brand } = socialIcon(link.iconKey);
                                return (
                                    <li key={link.id}>
                                        <a href={link.url} target="_blank" rel="noreferrer" className="group inline-flex items-center gap-2 text-[15px] text-white/70 hover:text-white transition-colors">
                                            <Brand style={{ fontSize: 17 }} />
                                            <Roll>{link.label}</Roll>
                                        </a>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <span />
                    )}
                    <button type="button" onClick={toTop} className="group mo-label inline-flex items-center gap-2 text-white/55 hover:text-white transition-colors">
                        <Roll>Back to top</Roll>
                        <Icon.ArrowRight className="w-3.5 h-3.5 -rotate-90 transition-transform duration-500 group-hover:-translate-y-0.5" />
                    </button>
                </div>

                <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-[13px] text-white/40">
                    <p>
                        {/* The build year can trail the visitor's by a few days each January. */}
                        <span suppressHydrationWarning>© {year}</span>
                        {credit ? <> · {credit}</> : null}
                    </p>
                    {attributionLabel && attributionUrl ? (
                        <p>
                            Web Design Idea -{' '}
                            <a href={attributionUrl} target="_blank" rel="noreferrer" className="mo-link text-white/60 hover:text-white">
                                {attributionLabel}
                            </a>
                        </p>
                    ) : null}
                </div>
            </motion.div>
        </footer>
    );
};

export default ContactFooter;
