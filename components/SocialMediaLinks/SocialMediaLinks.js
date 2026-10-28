import { socialIcon } from './socialIcons';

/**
 * The fixed rail of social icons, and the rotated email address opposite it.
 *
 * Desktop only (`hidden md:block`) — `Contact` renders the same links for narrow
 * screens, which is why both flags exist on the row rather than one list being
 * derived from the other.
 *
 * Each rail ends in a hairline that runs down to the bottom of the viewport, and
 * both slide in after the hero has finished its entrance.
 */
const Rail = ({ side, delay, children }) => (
    <div
        className={`fade-up hidden lg:flex fixed bottom-0 z-40 flex-col items-center gap-6 ${side === 'left' ? 'left-8' : 'right-8'}`}
        style={{ '--delay': delay }}
    >
        {children}
        <span aria-hidden="true" className="w-px h-24 bg-gradient-to-b from-[rgba(148,163,222,0.5)] to-transparent" />
    </div>
);

const SocialMediaLinks = ({ links = [], email }) => (
    <>
        {links.length ? (
            <Rail side="left" delay="1500ms">
                <ul className="flex flex-col items-center gap-5 list-none m-0 p-0">
                    {links.map((link) => {
                        const { Icon, hoverClass } = socialIcon(link.iconKey);

                        return (
                            <li key={link.id}>
                                <a
                                    href={link.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    aria-label={link.label}
                                    className={`block text-[#94a0bf] ${hoverClass} transition-all duration-300 hover:-translate-y-1`}
                                >
                                    <Icon className="text-[22px]" />
                                </a>
                            </li>
                        );
                    })}
                </ul>
            </Rail>
        ) : null}
        {email ? (
            <Rail side="right" delay="1600ms">
                <a
                    href={`mailto:${email}`}
                    className="font-mono text-xs tracking-[0.2em] text-[#94a0bf] hover:text-accent-soft transition-all duration-300 hover:-translate-y-1 [writing-mode:vertical-rl]"
                >
                    {email}
                </a>
            </Rail>
        ) : null}
    </>
);

export default SocialMediaLinks;
