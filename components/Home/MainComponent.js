import { useEffect, useState } from 'react';
import { trackPointer } from '../ui/spotlight';

/**
 * The hero block: greeting, name, headline and the CV link.
 *
 * The CV link is the one behavioural change here. It used to point straight at
 * `/assets/Samiul_Kabir_Resume.pdf`, a file in the repository, which meant
 * replacing a CV was a commit and every link anyone had already shared pointed at
 * whatever that path held. It now points at `/cv`, which resolves through
 * `pages/api/cv.js` to whichever `Resume` row is active — so the URL never
 * changes and uploading a new version takes effect immediately.
 *
 * The button is hidden entirely when no résumé is active, rather than left
 * pointing at a 404. A Resume button that returns "No CV is published yet" is
 * worse than no button.
 *
 * The motion is all CSS so it runs from the server-rendered HTML: the name rises
 * in letter by letter, the rest fades up behind it, and the headline types
 * itself out. The card on the right is built only from rows the page already
 * has — name, headline, the first few skills — so it never says anything the
 * dashboard did not.
 */

/**
 * Types `text` out once. The full string is always in the DOM for screen readers
 * and crawlers; only the visible copy is animated.
 */
function Typewriter({ text, startDelay = 1100, speed = 38 }) {
    const [count, setCount] = useState(text.length);

    useEffect(() => {
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;

        setCount(0);
        let i = 0;
        let timer = setTimeout(function tick() {
            i += 1;
            setCount(i);
            if (i < text.length) timer = setTimeout(tick, speed);
        }, startDelay);

        return () => clearTimeout(timer);
    }, [text, startDelay, speed]);

    return (
        <>
            <span className="sr-only">{text}</span>
            <span aria-hidden="true">
                {text.slice(0, count)}
                <span className="caret" />
            </span>
        </>
    );
}

function AnimatedName({ name }) {
    let index = 0;

    return (
        <>
            <span className="sr-only">{name}</span>
            <span aria-hidden="true">
                {name.split(' ').map((word, w) => (
                    <span key={w} className="inline-block whitespace-nowrap mr-[0.25em]">
                        {[...word].map((letter) => {
                            const i = index++;
                            return (
                                <span key={i} className="hero-letter" style={{ '--i': i }}>
                                    {letter}
                                </span>
                            );
                        })}
                    </span>
                ))}
            </span>
        </>
    );
}

function ProfileCard({ profile, skills }) {
    const firstName = (profile?.fullName || 'developer').split(' ')[0].toLowerCase();
    const stack = skills.slice(0, 4);

    return (
        <div className="float hidden lg:block">
            <div
                onPointerMove={trackPointer}
                className="spotlight glass rounded-2xl w-[380px] shadow-[0_30px_80px_-30px_rgba(2,6,23,0.95)] fade-up"
                style={{ '--delay': '900ms' }}
            >
                <div className="flex items-center gap-2 px-4 py-3 border-b border-[rgba(148,163,222,0.1)]">
                    <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                    <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
                    <span className="w-3 h-3 rounded-full bg-[#28c840]" />
                    <span className="ml-3 font-mono text-xs text-[#94a0bf]">{firstName}.js</span>
                </div>
                <pre className="font-mono text-[13px] leading-6 p-5 text-[#cbd3ec] whitespace-pre-wrap">
                    <span className="text-[#c792ea]">const</span> <span className="text-[#82aaff]">{firstName}</span> = {'{'}
                    {'\n'}  name: <span className="text-[#c3e88d]">&apos;{profile?.fullName}&apos;</span>,
                    {profile?.headline ? (
                        <>
                            {'\n'}  focus: <span className="text-[#c3e88d]">&apos;{profile.headline}&apos;</span>,
                        </>
                    ) : null}
                    {stack.length ? (
                        <>
                            {'\n'}  stack: [
                            {stack.map((s, i) => (
                                <span key={`${s}-${i}`}>
                                    <span className="text-[#c3e88d]">&apos;{s}&apos;</span>
                                    {i < stack.length - 1 ? ', ' : ''}
                                </span>
                            ))}
                            ],
                        </>
                    ) : null}
                    {'\n'}{'}'};
                </pre>
            </div>
        </div>
    );
}

const MainComponent = ({ profile, hasResume = false, skills = [], workHref = '#project', nextHref = '#about' }) => {
    const greeting = profile?.greeting || 'Hi, This is';
    const fullName = profile?.fullName || '';
    const headline = profile?.headline || '';

    return (
        <section className="relative min-h-[calc(100svh-72px)] flex items-center py-16">
            <div className="w-full flex items-center justify-between gap-12">
                <div className="max-w-3xl">
                    <p
                        className="fade-up inline-flex items-center gap-3 font-mono text-sm md:text-base text-mint mb-6"
                        style={{ '--delay': '100ms' }}
                    >
                        <span className="pulse-dot w-2 h-2 rounded-full bg-mint" />
                        {greeting}
                    </p>

                    <h1 className="text-[2.75rem] leading-[1.05] sm:text-6xl md:text-7xl font-extrabold tracking-tight text-[#f1f3fb] mb-5">
                        <AnimatedName name={fullName} />
                    </h1>

                    {headline ? (
                        <p className="text-2xl sm:text-3xl md:text-[2.6rem] md:leading-tight font-bold tracking-tight min-h-[2.6em] md:min-h-[2.4em]">
                            <span className="text-gradient">
                                <Typewriter text={headline} />
                            </span>
                        </p>
                    ) : null}

                    <div className="fade-up flex flex-wrap items-center gap-4 mt-10" style={{ '--delay': '700ms' }}>
                        <a href={workHref} className="btn btn-primary">
                            View my work
                            <span className="btn-arrow" aria-hidden="true">→</span>
                        </a>
                        {hasResume ? (
                            <a href="/cv" target="_blank" rel="noreferrer" className="btn btn-ghost">
                                Resume
                                <svg className="btn-arrow w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M9 7h8v8" />
                                </svg>
                            </a>
                        ) : null}
                    </div>
                </div>

                <ProfileCard profile={profile} skills={skills} />
            </div>

            <a
                href={nextHref}
                aria-label="Scroll down"
                className="fade-up hidden md:flex absolute bottom-6 left-1/2 -translate-x-1/2 w-6 h-10 rounded-full border-2 border-[rgba(148,163,222,0.35)] justify-center pt-2"
                style={{ '--delay': '1400ms' }}
            >
                <span className="scroll-cue w-1 h-2 rounded-full bg-[#cbd3ec]" />
            </a>
        </section>
    );
};

export default MainComponent;
