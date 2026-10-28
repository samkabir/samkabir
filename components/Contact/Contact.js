import Reveal from '../ui/Reveal';
import { trackPointer } from '../ui/spotlight';
import { socialIcon } from '../SocialMediaLinks/socialIcons';

/**
 * The closing contact block.
 *
 * This is the section that needs both halves of a `SectionCopy` row: the small
 * accent line reads `{numberLabel} {navLabel}` — "11. Contact" — while the large
 * heading below it reads `{heading}` — "Get In Touch". Every other section uses
 * only one of the two, which is why the model carries both.
 *
 * The icon row here is the mobile counterpart to the desktop rail in
 * `SocialMediaLinks`: same rows, same lookup, different styling. It shows each
 * platform's colour outright rather than on hover, since there is no hover on a
 * touchscreen. The rail only appears on wide screens (`lg`), so the row stays
 * until then.
 */
const Contact = ({ links = [], profile, section }) => {
    const email = profile?.publicEmail;

    return (
        <section className="py-24 md:py-32" id={section?.anchor || 'contact'}>
            <Reveal>
                <div
                    onPointerMove={trackPointer}
                    className="spotlight glass relative overflow-hidden rounded-3xl px-6 py-16 md:px-16 md:py-20 text-center"
                >
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[520px] h-[260px] rounded-full bg-accent opacity-25 blur-[100px]"
                    />

                    <p className="relative font-mono text-sm text-mint">
                        {section?.numberLabel || '11.'} {section?.navLabel || 'Contact'}
                    </p>
                    <h2 className="relative mt-4 text-4xl md:text-6xl font-extrabold tracking-tight text-[#f1f3fb]">
                        {section?.heading || 'Get In Touch'}
                    </h2>
                    <p className="relative mt-5 max-w-xl mx-auto text-base md:text-lg text-[#b4bdd6]">
                        {section?.subheading || 'Feel free to contact me anytime.'}
                    </p>

                    {email ? (
                        <div className="relative mt-10 flex flex-col items-center gap-4">
                            <a href={`mailto:${email}`} className="btn btn-primary text-base px-8 py-4">
                                Say Hello
                                <span className="btn-arrow" aria-hidden="true">→</span>
                            </a>
                            <a href={`mailto:${email}`} className="font-mono text-xs text-[#94a0bf] hover:text-white transition-colors">
                                {email}
                            </a>
                        </div>
                    ) : null}

                    {links.length ? (
                        <ul className="relative lg:hidden list-none flex justify-center gap-3 mt-10">
                            {links.map((link) => {
                                const { Icon, colorClass } = socialIcon(link.iconKey);

                                return (
                                    <li key={link.id}>
                                        <a
                                            href={link.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            aria-label={link.label}
                                            className="grid place-items-center w-12 h-12 rounded-full border border-[rgba(148,163,222,0.18)] bg-[rgba(255,255,255,0.03)] transition-transform duration-300 hover:-translate-y-1"
                                        >
                                            <Icon className={`text-[22px] ${colorClass}`} />
                                        </a>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : null}
                </div>
            </Reveal>
        </section>
    );
};

export default Contact;
