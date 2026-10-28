import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import SkillCard from '../SkillCard/SkillCard';
import Reveal from '../ui/Reveal';
import SectionHeading from '../ui/SectionHeading';
import { trackPointer } from '../ui/spotlight';
import { leetcodeProfileUrl } from '../../lib/leetcode';

const ACCENT = 'text-[#c9c2ff] font-semibold';

/**
 * One education row, in the prose the site already used.
 *
 * The two rows on the site read differently — "Completed UnderGraduation,
 * Bachelor's in **Computer Science and Engineering** from **BRAC University**."
 * and "Completed **O and A Levels** under Pearson Edexcel Education." — and they
 * accent different words. That is not a template with one shape; it is two.
 *
 * So the branch is on `field`, which is the actual difference between a degree
 * that has a subject and a qualification that does not:
 *
 *   * with a field → "in {field} from {institution}", accenting both
 *   * without one  → "under {institution}", accenting the qualification instead
 *
 * `note` carries any qualifier that belongs before the degree ("UnderGraduation"),
 * which is the only way to keep the first sentence word-for-word without hardcoding
 * it. Reproducing both exactly was the bar — this phase is not allowed to reword
 * the page while moving where the words come from.
 */
function EducationLine({ row }) {
    if (row.field) {
        return (
            <>
                Completed {row.note ? `${row.note}, ` : ''}{row.degree ? `${row.degree} ` : ''}in{' '}
                <span className={ACCENT}>{row.field}</span> from{' '}
                <span className={ACCENT}>{row.institution}</span>.
            </>
        );
    }

    return (
        <>
            Completed <span className={ACCENT}>{row.degree}</span> under {row.institution}
            {row.note ? ` ${row.note}` : ''}.
        </>
    );
}

/**
 * Counts from zero to `value` once it scrolls into view, easing out so the last
 * digits settle rather than stop. Reduced motion shows the number outright.
 */
function CountUp({ value }) {
    const ref = useRef(null);
    const [shown, setShown] = useState(0);

    useEffect(() => {
        const node = ref.current;
        if (!node) return undefined;

        const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const duration = reduced ? 0 : 1600;
        let frame = 0;

        const run = () => {
            const start = performance.now();
            const step = (now) => {
                const t = duration ? Math.min(1, (now - start) / duration) : 1;
                setShown(Math.round(value * (1 - Math.pow(1 - t, 4))));
                if (t < 1) frame = requestAnimationFrame(step);
            };
            frame = requestAnimationFrame(step);
        };

        if (typeof IntersectionObserver === 'undefined') {
            run();
            return () => cancelAnimationFrame(frame);
        }

        const io = new IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting) return;
            io.disconnect();
            run();
        }, { threshold: 0.5 });

        io.observe(node);
        return () => {
            io.disconnect();
            cancelAnimationFrame(frame);
        };
    }, [value]);

    return <span ref={ref}>{shown}</span>;
}

const AboutMe = ({
    profile,
    skills = [],
    education = [],
    sections = {},
}) => {
    const [data, setData] = useState();
    const [statsFailed, setStatsFailed] = useState(false);

    const about = sections.about;
    const skillsSection = sections.skills;
    const showLeetcode = profile?.showLeetcode !== false;
    // `|| undefined` rather than the raw value: a default parameter only fires for
    // `undefined`, so a null column would otherwise build `leetcode.com/null/`.
    const leetcodeUsername = profile?.leetcodeUsername || undefined;
    const avatar = profile?.avatar;

    /**
     * The solved count, from this site's own endpoint.
     *
     * It used to call leetcode-stats-api.herokuapp.com directly. That service is
     * gone — Heroku retired its free dynos — and a dead host's error page carries
     * no CORS headers, so the browser reported a CORS failure rather than a 503.
     * `/api/leetcode` asks LeetCode itself, server-side, where CORS does not
     * apply, and reads the username from `Profile` rather than a constant.
     *
     * Three things the previous version did not do:
     *
     *   * **Catch.** A rejected fetch with no handler is an unhandled rejection
     *     in the console and nothing on screen — which is how the number could
     *     stop rendering without anyone noticing why.
     *   * **Abort on unmount.** Strict Mode runs this twice in development, so
     *     the first request is cancelled rather than left to set state on a
     *     component that has gone.
     *   * **Have a failed state.** `data && data.totalSolved` renders an empty
     *     circle when the request fails, which looks like a styling bug.
     *
     * Skipped entirely when the block is hidden, so a switch in the dashboard
     * also stops the request rather than only hiding its result.
     */
    useEffect(() => {
        if (!showLeetcode) return undefined;

        const controller = new AbortController();

        fetch('/api/leetcode', { signal: controller.signal })
            .then(response => (response.ok ? response.json() : Promise.reject(response)))
            .then(stats => setData(stats))
            .catch(error => {
                if (error?.name === 'AbortError') return;
                setStatsFailed(true);
            });

        return () => controller.abort();
    }, [showLeetcode])

    const hasAside = Boolean(avatar) || showLeetcode;

    return (
        <section className="py-20 md:py-28" id={about?.anchor || 'about'}>
            <SectionHeading numberLabel={about?.numberLabel || '00.'} heading={about?.heading || 'About Me'} />

            <div className={`grid gap-10 ${hasAside ? 'lg:grid-cols-[1.4fr_1fr]' : ''}`}>
                <div>
                    {profile?.bio ? (
                        <Reveal as="p" className="text-[#b4bdd6] text-base md:text-lg leading-relaxed">
                            {profile.bio}
                        </Reveal>
                    ) : null}

                    {education.length ? (
                        <ol className="relative mt-10 ml-2 border-l border-[rgba(148,163,222,0.18)] space-y-6">
                            {education.map((row, i) => (
                                <Reveal as="li" key={row.id} delay={i * 120} className="relative pl-7">
                                    <span
                                        aria-hidden="true"
                                        className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-[#0b1222] border-2 border-accent shadow-[0_0_12px_rgba(122,97,255,0.8)]"
                                    />
                                    <p className="text-[#b4bdd6] text-sm md:text-base leading-relaxed">
                                        <EducationLine row={row} />
                                    </p>
                                </Reveal>
                            ))}
                        </ol>
                    ) : null}
                </div>

                {hasAside ? (
                    <div className="flex flex-col gap-6 sm:flex-row lg:flex-col items-center lg:items-stretch">
                        {avatar ? (
                            <Reveal delay={100} className="group relative w-64 max-w-full mx-auto">
                                <span
                                    aria-hidden="true"
                                    className="absolute inset-0 rounded-2xl border-2 border-accent translate-x-4 translate-y-4 transition-transform duration-500 group-hover:translate-x-2 group-hover:translate-y-2"
                                />
                                <div className="relative overflow-hidden rounded-2xl">
                                    <Image
                                        src={avatar.url}
                                        alt={avatar.alt || profile?.fullName || 'Portrait'}
                                        width={avatar.width ?? 400}
                                        height={avatar.height ?? 400}
                                        sizes="256px"
                                        className="w-full h-auto grayscale-[40%] transition duration-500 group-hover:grayscale-0 group-hover:scale-105"
                                    />
                                    <span aria-hidden="true" className="absolute inset-0 bg-accent mix-blend-multiply opacity-30 transition-opacity duration-500 group-hover:opacity-0" />
                                </div>
                            </Reveal>
                        ) : null}

                        {showLeetcode ? (
                            <Reveal delay={200} className="w-full">
                                <a
                                    href={leetcodeProfileUrl(leetcodeUsername)}
                                    target="_blank"
                                    rel="noreferrer"
                                    onPointerMove={trackPointer}
                                    className="spotlight glass group block rounded-2xl p-6 transition-transform duration-500 hover:-translate-y-1"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#94a0bf]">LeetCode</span>
                                        <svg className="w-4 h-4 text-[#94a0bf] transition-transform duration-500 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M9 7h8v8" />
                                        </svg>
                                    </div>
                                    <div className="mt-4 text-5xl md:text-6xl font-extrabold tracking-tight text-gradient tabular-nums">
                                        {/* A dash rather than a blank when the count is unavailable:
                                            the link still works, and an empty card reads as a
                                            broken layout. */}
                                        {data ? <CountUp value={data.totalSolved} /> : statsFailed ? '—' : '…'}
                                    </div>
                                    <p className="mt-1 text-sm font-medium text-[#e6e9f5]">Problems solved</p>
                                    <p className="mt-3 text-xs text-[#94a0bf]">
                                        It ain&apos;t much, but it&apos;s honest work.
                                    </p>
                                </a>
                            </Reveal>
                        ) : null}
                    </div>
                ) : null}
            </div>

            {skills.length ? (
                <div className="mt-20">
                    <SectionHeading
                        as="h3"
                        size="sm"
                        numberLabel={skillsSection?.numberLabel || '00.0'}
                        heading={skillsSection?.heading || 'Skill Stack'}
                    />
                    <ul className="flex flex-wrap gap-2.5 -mt-4">
                        {skills.map((item, i) => (
                            <Reveal as="li" key={`${item}-${i}`} delay={Math.min(i * 30, 600)}>
                                <SkillCard name={item} />
                            </Reveal>
                        ))}
                    </ul>
                </div>
            ) : null}
        </section>
    );
};

export default AboutMe;
