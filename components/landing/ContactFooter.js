import Reveal from '../ui/Reveal';
import { Magnetic, formatIndex } from './motion';

/**
 * The closing screen and the footer under it.
 *
 * The contact block uses both halves of its `SectionCopy` row: `navLabel` for the
 * small "(11) Contact" label and `heading` for the giant line, with `subheading`
 * set in italic serif beneath. The big lime disc is the mailto, and it leans
 * toward the mouse.
 *
 * The footer keeps the credit and the "Web Design Idea" attribution exactly as
 * `Profile` stores them, and omits the attribution line when either half is
 * empty rather than leaving a dangling "Web Design Idea -". The name runs along
 * the bottom edge in outline at the width of the page.
 */
const ContactFooter = ({ section, profile, socialLinks = [] }) => {
    const email = profile?.publicEmail;
    const index = formatIndex(section?.numberLabel || '11.');
    const heading = section?.heading || 'Get In Touch';
    const credit = profile?.footerCredit;
    const attributionLabel = profile?.attributionLabel;
    const attributionUrl = profile?.attributionUrl;

    return (
        <>
            <section id={section?.anchor || 'contact'} className="relative px-4 md:px-8 pt-24 md:pt-36 pb-16 overflow-hidden">
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 w-[70vw] h-[50vh] rounded-full opacity-[0.1] blur-[140px] bg-[#d4ff4f]"
                />

                <p className="lp-mono lp-label mb-8">({index}) {section?.navLabel || 'Contact'}</p>

                <div className="grid gap-12 lg:grid-cols-[1fr_auto] lg:items-end">
                    <div>
                        <Reveal as="h2" className="lp-display text-[clamp(3.4rem,11vw,10rem)]">
                            <span className="lp-line"><span>{heading}</span></span>
                        </Reveal>
                        <Reveal as="p" delay={150} className="lp-serif mt-6 text-[clamp(1.6rem,3.5vw,3rem)] text-[#a9a79f] max-w-2xl leading-[1.1]">
                            {section?.subheading || 'Feel free to contact me anytime.'}
                        </Reveal>
                    </div>

                    {email ? (
                        <Reveal delay={250} className="justify-self-start lg:justify-self-end">
                            <Magnetic strength={0.4}>
                                <a href={`mailto:${email}`} className="lp-cta-circle" data-cursor="Write">
                                    <span className="flex flex-col items-center gap-1">
                                        Say hello
                                        <span aria-hidden="true" className="text-2xl">→</span>
                                    </span>
                                </a>
                            </Magnetic>
                        </Reveal>
                    ) : null}
                </div>

                <div className="mt-20 md:mt-28 pt-8 border-t border-[rgba(242,240,234,0.1)] grid gap-8 md:grid-cols-3">
                    {email ? (
                        <div>
                            <p className="lp-mono text-[#8f8d85] mb-3">Email</p>
                            <a href={`mailto:${email}`} className="text-lg font-medium hover:text-[#d4ff4f] transition-colors break-all">
                                {email}
                            </a>
                        </div>
                    ) : null}
                    {socialLinks.length ? (
                        <div className="md:col-span-2">
                            <p className="lp-mono text-[#8f8d85] mb-3">Socials</p>
                            <ul className="flex flex-wrap gap-x-8 gap-y-2">
                                {socialLinks.map((link) => (
                                    <li key={link.id}>
                                        <a
                                            href={link.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="group inline-flex items-center gap-2 text-lg font-medium hover:text-[#d4ff4f] transition-colors"
                                        >
                                            {link.label}
                                            <span aria-hidden="true" className="transition-transform duration-500 group-hover:rotate-45">↗</span>
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : null}
                </div>
            </section>

            <footer className="relative px-4 md:px-8 pt-10 overflow-hidden">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between lp-mono text-[#8f8d85]">
                    <div className="space-y-1.5">
                        {credit ? <p>{credit}</p> : null}
                        {attributionLabel && attributionUrl ? (
                            <p>
                                Web Design Idea -{' '}
                                <a href={attributionUrl} target="_blank" rel="noreferrer" className="text-[#f2f0ea] hover:text-[#d4ff4f] transition-colors">
                                    {attributionLabel}
                                </a>
                            </p>
                        ) : null}
                    </div>
                    <a href="#top" className="group inline-flex items-center gap-2 hover:text-[#d4ff4f] transition-colors">
                        Back to top
                        <span aria-hidden="true" className="inline-block transition-transform duration-500 group-hover:-translate-y-1">↑</span>
                    </a>
                </div>
                {/* Sized from the name's length so it spans the page without overflowing. */}
                <p
                    aria-hidden="true"
                    className="lp-display lp-footer-name mt-10 -mb-[0.12em] text-center select-none"
                    style={{ fontSize: `min(16vw, ${(92 / (Math.max(1, (profile?.fullName || '').length) * 0.66)).toFixed(2)}vw)` }}
                >
                    {profile?.fullName}
                </p>
            </footer>
        </>
    );
};

export default ContactFooter;
