import { Magnetic } from './motion';

/**
 * The opening screen: the name set as large as the viewport allows, split over
 * two lines that rise out of a mask once the preloader lifts, with the headline in
 * italic serif beneath and a spinning "scroll" badge.
 *
 * Every word comes from `Profile`. The first word of the name takes the first
 * line and the rest takes the second, pushed right — the asymmetry is the layout.
 * The CV button keeps the old contract: it points at `/cv` (which resolves to the
 * active `Resume` row) and is omitted entirely when no résumé is published.
 */
function ScrollBadge({ href }) {
    const text = 'Scroll to explore • Scroll to explore • ';

    return (
        <Magnetic>
            <a href={href} className="lp-badge" aria-label="Scroll to the next section" data-cursor="Scroll">
                <svg className="lp-badge__ring" viewBox="0 0 128 128" aria-hidden="true">
                    <defs>
                        <path id="lp-badge-path" d="M64,64 m-50,0 a50,50 0 1,1 100,0 a50,50 0 1,1 -100,0" />
                    </defs>
                    <text className="lp-mono" style={{ fontSize: 10.5, letterSpacing: '0.18em' }} fill="currentColor">
                        <textPath href="#lp-badge-path">{text}</textPath>
                    </text>
                </svg>
                <span className="lp-badge__core" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12l7 7 7-7" />
                    </svg>
                </span>
            </a>
        </Magnetic>
    );
}

const Hero = ({ profile, hasResume = false, workHref = '#project', nextHref = '#about' }) => {
    const greeting = profile?.greeting || 'Hi, This is';
    const [first = '', ...rest] = (profile?.fullName || '').split(' ');
    const headline = profile?.headline || '';
    const year = new Date().getFullYear();

    return (
        <section className="relative min-h-[100svh] flex flex-col justify-end px-4 md:px-8 pt-28 pb-8 md:pb-10 overflow-hidden">
            {/* A low lime glow behind the name; decoration only. */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-[20vw] bottom-[-30vh] w-[80vw] h-[80vh] rounded-full opacity-[0.13] blur-[120px] bg-[#d4ff4f]"
            />

            <div className="lp-fade grid grid-cols-2 md:grid-cols-4 gap-4 lp-mono text-[#8f8d85] mb-8 md:mb-12" style={{ '--d': '700ms' }}>
                <span className="lp-label">{greeting}</span>
                <span className="hidden md:block">Portfolio</span>
                {/* The build year can trail the visitor's by a few days each January. */}
                <span className="hidden md:block" suppressHydrationWarning>©{year}</span>
                <span className="text-right">Scroll ↓</span>
            </div>

            <h1 className="lp-display lp-hero-name">
                <span className="lp-line"><span style={{ '--d': '0ms' }}>{first}</span></span>
                {rest.length ? (
                    <span className="lp-line text-right"><span style={{ '--d': '120ms' }}>{rest.join(' ')}</span></span>
                ) : null}
            </h1>

            <div className="mt-8 md:mt-12 grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
                <div className="lp-fade" style={{ '--d': '450ms' }}>
                    {headline ? (
                        <p className="lp-serif text-[clamp(1.8rem,4vw,3.4rem)] leading-[1.05] max-w-2xl text-[#f2f0ea]">
                            {headline}
                        </p>
                    ) : null}
                    <div className="flex flex-wrap gap-3 mt-8">
                        <a href={workHref} className="lp-btn lp-btn--lime">
                            See my work <span className="lp-btn__arrow" aria-hidden="true">→</span>
                        </a>
                        {hasResume ? (
                            <a href="/cv" target="_blank" rel="noreferrer" className="lp-btn lp-btn--line">
                                Résumé <span className="lp-btn__arrow" aria-hidden="true">↗</span>
                            </a>
                        ) : null}
                    </div>
                </div>
                <div className="lp-fade hidden md:block" style={{ '--d': '650ms' }}>
                    <ScrollBadge href={nextHref} />
                </div>
            </div>
        </section>
    );
};

export default Hero;
