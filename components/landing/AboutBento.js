import Image from 'next/image';
import { useEffect, useState } from 'react';
import Reveal from '../ui/Reveal';
import { leetcodeProfileUrl } from '../../lib/leetcode';
import { CountUp, ScrollWords, SectionIntro } from './motion';

const ACCENT = 'text-[#f2f0ea] font-semibold';

/**
 * One education row, word for word as the site has always printed it.
 *
 * The rows read differently — a degree with a subject ("… in **Computer Science
 * and Engineering** from **BRAC University**.") and a qualification without one
 * ("Completed **O and A Levels** under Pearson Edexcel Education.") — so the
 * branch is on `field`, exactly as in the previous About section.
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
 * Copies the address and says so for two seconds. Falls back to opening the mail
 * client where the Clipboard API is unavailable (an insecure origin, an old
 * browser) — the tile should never do nothing.
 */
function EmailTile({ email }) {
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!copied) return undefined;
        const timer = setTimeout(() => setCopied(false), 2000);
        return () => clearTimeout(timer);
    }, [copied]);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(email);
            setCopied(true);
        } catch {
            window.location.href = `mailto:${email}`;
        }
    };

    return (
        <button type="button" onClick={copy} className="lp-tile group w-full h-full text-left flex flex-col justify-between gap-10" data-cursor="Copy">
            <div className="flex items-start justify-between">
                <span className="lp-mono lp-label">Email</span>
                <span className="lp-mono text-[#d4ff4f]" aria-live="polite">{copied ? 'Copied ✓' : 'Click to copy'}</span>
            </div>
            <span className="lp-display text-[clamp(1.4rem,3.2vw,2.6rem)] break-all leading-none">{email}</span>
        </button>
    );
}

/**
 * The About section as a bento grid: the bio is the big tile and lights up word
 * by word on scroll; around it sit the LeetCode count, the size of the toolbox,
 * education, a copy-the-email tile, the social links and the résumé.
 *
 * Tiles appear only when their data does — no avatar, no portrait tile; LeetCode
 * switched off in the dashboard, no LeetCode tile *and no request*. `grid-flow-dense`
 * lets the remaining tiles close any gap that leaves.
 *
 * The solved count comes from this site's own `/api/leetcode`, which asks LeetCode
 * server-side (a browser call would fail on CORS). The fetch is caught and aborted
 * on unmount, and a failure shows a dash rather than an empty tile.
 */
const AboutBento = ({ profile, skills = [], education = [], sections = {}, socialLinks = [], hasResume = false }) => {
    const [stats, setStats] = useState();
    const [statsFailed, setStatsFailed] = useState(false);

    const about = sections.about;
    const showLeetcode = profile?.showLeetcode !== false;
    // `|| undefined` so the default username applies to a null column, rather than
    // building `leetcode.com/null/`.
    const leetcodeUsername = profile?.leetcodeUsername || undefined;
    const avatar = profile?.avatar;
    const email = profile?.publicEmail;

    useEffect(() => {
        if (!showLeetcode) return undefined;
        const controller = new AbortController();

        fetch('/api/leetcode', { signal: controller.signal })
            .then((response) => (response.ok ? response.json() : Promise.reject(response)))
            .then(setStats)
            .catch((error) => {
                if (error?.name === 'AbortError') return;
                setStatsFailed(true);
            });

        return () => controller.abort();
    }, [showLeetcode]);

    return (
        <section id={about?.anchor || 'about'} className="px-4 md:px-8 py-24 md:py-36">
            <SectionIntro
                numberLabel={about?.numberLabel || '00.'}
                label={about?.navLabel || 'About'}
                heading={about?.heading || 'About Me'}
            />

            <div className="grid gap-3 md:gap-4 md:grid-cols-6 grid-flow-dense">
                {profile?.bio ? (
                    <Reveal className="lp-tile md:col-span-6 lg:col-span-4 lg:row-span-2 flex flex-col justify-between gap-10 !p-7 md:!p-10">
                        <span className="lp-mono lp-label">Who I am</span>
                        <ScrollWords
                            text={profile.bio}
                            className="lp-display !font-semibold !tracking-[-0.03em] !leading-[1.12] text-[clamp(1.5rem,2.9vw,2.6rem)]"
                        />
                    </Reveal>
                ) : null}

                {avatar ? (
                    <Reveal delay={80} className="lp-tile !p-0 md:col-span-3 lg:col-span-2 lg:row-span-2 min-h-[320px]">
                        <Image
                            src={avatar.url}
                            alt={avatar.alt || profile?.fullName || 'Portrait'}
                            fill
                            sizes="(min-width: 1024px) 33vw, 100vw"
                            className="object-cover grayscale transition duration-700 hover:grayscale-0 hover:scale-105"
                        />
                    </Reveal>
                ) : null}

                {showLeetcode ? (
                    <Reveal delay={160} className="md:col-span-3 lg:col-span-2">
                        <a
                            href={leetcodeProfileUrl(leetcodeUsername)}
                            target="_blank"
                            rel="noreferrer"
                            className="lp-tile lp-tile--lime flex flex-col justify-between gap-6 h-full min-h-[220px]"
                            data-cursor="LeetCode"
                        >
                            <div className="flex items-start justify-between">
                                <span className="lp-mono">LeetCode</span>
                                <span className="lp-tile__arrow" aria-hidden="true">→</span>
                            </div>
                            <div>
                                <div className="lp-display text-[clamp(4rem,8vw,6.5rem)] tabular-nums">
                                    {stats ? <CountUp value={stats.totalSolved} /> : statsFailed ? '—' : '…'}
                                </div>
                                <p className="mt-2 font-semibold">Problems solved</p>
                                <p className="text-sm opacity-70">It ain&apos;t much, but it&apos;s honest work.</p>
                            </div>
                        </a>
                    </Reveal>
                ) : null}

                {skills.length ? (
                    <Reveal delay={240} className="lp-tile md:col-span-3 lg:col-span-2 flex flex-col justify-between gap-6 min-h-[220px]">
                        <span className="lp-mono lp-label">{sections.skills?.heading || 'Skill Stack'}</span>
                        <div>
                            <div className="lp-display text-[clamp(4rem,8vw,6.5rem)]">
                                <CountUp value={skills.length} />
                            </div>
                            <p className="mt-2 font-semibold">Tools in the toolbox</p>
                        </div>
                        <ul className="flex flex-wrap gap-1.5">
                            {skills.map((skill, i) => (
                                <li key={`${skill}-${i}`} className="px-2.5 py-1 rounded-full border border-[rgba(242,240,234,0.14)] text-xs text-[#c9c7bf] transition-colors hover:bg-[#d4ff4f] hover:text-[#10120a] hover:border-transparent">
                                    {skill}
                                </li>
                            ))}
                        </ul>
                    </Reveal>
                ) : null}

                {education.length ? (
                    <Reveal delay={0} className="lp-tile md:col-span-6 lg:col-span-3 flex flex-col gap-8">
                        <span className="lp-mono lp-label">Education</span>
                        <ol className="space-y-5">
                            {education.map((row, i) => (
                                <li key={row.id} className="grid grid-cols-[auto_1fr] gap-4 items-baseline">
                                    <span className="lp-mono text-[#d4ff4f]">0{i + 1}</span>
                                    <p className="text-[#a9a79f] leading-relaxed">
                                        <EducationLine row={row} />
                                    </p>
                                </li>
                            ))}
                        </ol>
                    </Reveal>
                ) : null}

                {email ? (
                    <Reveal delay={100} className="md:col-span-6 lg:col-span-3">
                        <EmailTile email={email} />
                    </Reveal>
                ) : null}

                {socialLinks.length ? (
                    <Reveal delay={0} className={`lp-tile md:col-span-3 ${hasResume ? 'lg:col-span-4' : 'lg:col-span-6'} flex flex-col gap-6`}>
                        <span className="lp-mono lp-label">Elsewhere</span>
                        <ul className="divide-y divide-[rgba(242,240,234,0.1)]">
                            {socialLinks.map((link) => (
                                <li key={link.id}>
                                    <a
                                        href={link.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="group flex items-center justify-between py-3 text-lg font-medium transition-colors hover:text-[#d4ff4f]"
                                    >
                                        {link.label}
                                        <span aria-hidden="true" className="transition-transform duration-500 group-hover:rotate-45">↗</span>
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </Reveal>
                ) : null}

                {hasResume ? (
                    <Reveal delay={100} className="md:col-span-3 lg:col-span-2">
                        <a
                            href="/cv"
                            target="_blank"
                            rel="noreferrer"
                            className="lp-tile group flex flex-col justify-between gap-10 h-full min-h-[200px]"
                            data-cursor="Open"
                        >
                            <div className="flex items-start justify-between">
                                <span className="lp-mono lp-label">Résumé</span>
                                <span className="lp-tile__arrow" aria-hidden="true">→</span>
                            </div>
                            <span className="lp-display text-[clamp(2rem,3.5vw,3rem)]">
                                Read the <span className="lp-serif text-[#d4ff4f]">full</span> story
                            </span>
                        </a>
                    </Reveal>
                ) : null}
            </div>
        </section>
    );
};

export default AboutBento;
