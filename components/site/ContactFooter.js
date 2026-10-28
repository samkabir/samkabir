import { socialIcon } from '../SocialMediaLinks/socialIcons';
import { useCopy } from './feedback';
import Reveal from './Reveal';
import * as Icon from './icons';

/**
 * The end of every page: the contact block, then a one-line footer.
 *
 * It carries `id="contact"`, which is what the nav's Contact link points at, so
 * "Contact" works from any page without a contact page of its own. Its copy is
 * the `contact` `SectionCopy` row — `navLabel` as the small label, `heading` as
 * the serif headline, `subheading` beneath — and the actions are built from
 * `Profile.publicEmail`, the active résumé and the social links.
 *
 * The footer keeps the credit and the "Web Design Idea" attribution exactly as
 * `Profile` stores them, and drops the attribution line when either half is
 * empty rather than leaving a dangling "Web Design Idea -".
 */
const ContactFooter = ({ section, profile, socialLinks = [], hasResume = false }) => {
    const copy = useCopy();
    const email = profile?.publicEmail;
    const credit = profile?.footerCredit;
    const attributionLabel = profile?.attributionLabel;
    const attributionUrl = profile?.attributionUrl;
    const year = new Date().getFullYear();

    return (
        <footer id={section?.anchor || 'contact'} className="mx-auto max-w-5xl px-5 sm:px-8 pt-16 pb-10">
            <Reveal className="ss-card relative overflow-hidden px-6 py-12 sm:px-12 sm:py-16">
                <div aria-hidden="true" className="ss-dots absolute inset-0 opacity-70 pointer-events-none" />
                <div className="relative max-w-xl">
                    <p className="ss-mono uppercase tracking-wider text-ss-accent">{section?.navLabel || 'Contact'}</p>
                    <h2 className="ss-serif mt-3 text-[40px] sm:text-[52px] leading-[1.05] text-ss-fg">
                        {section?.heading || 'Get In Touch'}
                    </h2>
                    <p className="mt-4 text-[17px] text-ss-muted">
                        {section?.subheading || 'Feel free to contact me anytime.'}
                    </p>

                    <div className="mt-8 flex flex-wrap items-center gap-2.5">
                        {email ? (
                            <>
                                <a href={`mailto:${email}`} className="ss-btn ss-btn--solid">
                                    <Icon.Mail className="w-4 h-4" />
                                    Send an email
                                </a>
                                <button
                                    type="button"
                                    className="ss-btn ss-btn--ghost"
                                    onClick={() => copy(email, { label: 'Email copied', fallbackHref: `mailto:${email}` })}
                                >
                                    <Icon.Copy className="w-4 h-4" />
                                    Copy address
                                </button>
                            </>
                        ) : null}
                        {hasResume ? (
                            <a href="/cv" target="_blank" rel="noreferrer" className="ss-btn ss-btn--ghost">
                                Résumé
                                <Icon.ArrowUpRight className="ss-arrow-ne w-4 h-4" />
                            </a>
                        ) : null}
                    </div>

                    {socialLinks.length ? (
                        <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2">
                            {socialLinks.map((link) => {
                                const { Icon: Brand } = socialIcon(link.iconKey);
                                return (
                                    <li key={link.id}>
                                        <a
                                            href={link.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="group inline-flex items-center gap-1.5 text-[14px] text-ss-muted hover:text-ss-fg transition-colors"
                                        >
                                            <Brand style={{ fontSize: 16 }} />
                                            {link.label}
                                            <Icon.ArrowUpRight className="ss-arrow-ne w-3.5 h-3.5 opacity-60" />
                                        </a>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : null}
                </div>
            </Reveal>

            <div className="mt-10 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-[13px] text-ss-faint">
                <p>
                    {/* The build year can trail the visitor's by a few days each January. */}
                    <span suppressHydrationWarning>© {year}</span>
                    {credit ? <> · {credit}</> : null}
                </p>
                {attributionLabel && attributionUrl ? (
                    <p>
                        Web Design Idea -{' '}
                        <a href={attributionUrl} target="_blank" rel="noreferrer" className="ss-link text-ss-muted hover:text-ss-fg">
                            {attributionLabel}
                        </a>
                    </p>
                ) : null}
            </div>
        </footer>
    );
};

export default ContactFooter;
