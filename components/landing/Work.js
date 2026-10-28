import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import Reveal from '../ui/Reveal';
import { SectionIntro } from './motion';

/**
 * The projects, in two registers.
 *
 * **Featured** projects are large cards that pin under the nav and stack: each
 * one slides up over the last, which shrinks and dims behind it. The pinning is
 * plain `position: sticky`; the recede is measured in `useStackRecede`, because a
 * card that is stuck in place does not move, so a CSS view-timeline on it never
 * advances.
 *
 * **Everything else** is an index — one ruled row per project — with the
 * screenshot trailing the mouse over whichever row it is on.
 *
 * Which projects are featured is the dashboard's `isFeatured` switch. When none
 * is set, the first three stand in, so the section never opens with an empty
 * stack (the same fallback the site has always used).
 */

const ArrowLink = ({ href, children }) =>
    href ? (
        <a href={href} target="_blank" rel="noreferrer" className="lp-btn lp-btn--line !py-2.5 !px-4 !text-sm">
            {children} <span className="lp-btn__arrow" aria-hidden="true">↗</span>
        </a>
    ) : null;

function StackCard({ project, index, total }) {
    const link = project.liveUrl || project.repoUrl;

    return (
        <li className="lp-stack-card" style={{ '--i': index }}>
            <article className="lp-stack-card__inner grid md:grid-cols-[1fr_1.35fr] gap-6 md:gap-10 rounded-[2rem] bg-[#151513] border border-[rgba(242,240,234,0.1)] p-4 md:p-6 shadow-[0_-20px_60px_-30px_rgba(0,0,0,0.9)]">
                <div className="flex flex-col justify-between gap-8 p-3 md:p-4 order-2 md:order-1">
                    <div className="flex items-center justify-between lp-mono text-[#8f8d85]">
                        <span>
                            {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
                        </span>
                        <span>Featured</span>
                    </div>
                    <div>
                        <h3 className="lp-display text-[clamp(2.2rem,4.5vw,4.2rem)]">{project.title}</h3>
                        {project.description ? (
                            <p className="mt-5 text-[#a9a79f] leading-relaxed max-w-md line-clamp-4" title={project.description}>{project.description}</p>
                        ) : null}
                    </div>
                    <div className="space-y-6">
                        {project.stacks?.length ? (
                            <ul className="flex flex-wrap gap-1.5">
                                {project.stacks.map((stack, i) => (
                                    <li key={i} className="px-2.5 py-1 rounded-full bg-[rgba(242,240,234,0.06)] text-xs text-[#c9c7bf]">
                                        {stack}
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                            <ArrowLink href={project.liveUrl}>Live site</ArrowLink>
                            <ArrowLink href={project.repoUrl}>Source</ArrowLink>
                        </div>
                    </div>
                </div>

                <a
                    href={link || undefined}
                    target="_blank"
                    rel="noreferrer"
                    tabIndex={-1}
                    aria-hidden="true"
                    data-cursor={link ? 'View' : undefined}
                    className="lp-stack-card__media relative block overflow-hidden rounded-[1.4rem] bg-[#1c1c19] aspect-[16/11] md:aspect-auto md:min-h-[420px] order-1 md:order-2"
                >
                    {project.cover?.url ? (
                        <Image
                            src={project.cover.url}
                            alt=""
                            fill
                            sizes="(min-width: 768px) 55vw, 100vw"
                            className="object-cover object-top"
                        />
                    ) : (
                        <span className="absolute inset-0 grid place-items-center lp-display text-[8rem] text-[#2a2a26]">
                            {project.title?.[0]}
                        </span>
                    )}
                </a>
            </article>
        </li>
    );
}

/**
 * As each card is covered by the next, scale it down and dim it by how far the
 * next one has slid over it. Writes `transform`/`filter` straight onto the inner
 * element inside one animation frame per scroll.
 */
function useStackRecede(listRef) {
    useEffect(() => {
        const list = listRef.current;
        if (!list || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
        let frame = 0;

        const paint = () => {
            frame = 0;
            const cards = [...list.children];
            cards.forEach((card, i) => {
                const inner = card.firstElementChild;
                const nextCard = cards[i + 1];
                if (!inner) return;
                if (!nextCard) {
                    inner.style.transform = '';
                    inner.style.filter = '';
                    return;
                }
                const rect = card.getBoundingClientRect();
                const nextTop = nextCard.getBoundingClientRect().top;
                const p = Math.min(1, Math.max(0, (rect.bottom - nextTop) / rect.height));
                inner.style.transform = p ? `scale(${1 - p * 0.08})` : '';
                inner.style.filter = p ? `brightness(${1 - p * 0.55})` : '';
            });
        };
        const schedule = () => {
            if (!frame) frame = requestAnimationFrame(paint);
        };

        window.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', schedule);
        schedule();
        return () => {
            window.removeEventListener('scroll', schedule);
            window.removeEventListener('resize', schedule);
            if (frame) cancelAnimationFrame(frame);
        };
    }, [listRef]);
}

/** The screenshot that follows the mouse over the project index. */
function useTrailingPreview() {
    const ref = useRef(null);
    const [current, setCurrent] = useState(null);

    useEffect(() => {
        const node = ref.current;
        if (!node || !window.matchMedia?.('(pointer: fine)').matches) return undefined;

        const target = { x: 0, y: 0 };
        const pos = { x: 0, y: 0 };
        let frame = 0;
        let started = false;

        const tick = () => {
            pos.x += (target.x - pos.x) * 0.15;
            pos.y += (target.y - pos.y) * 0.15;
            const tilt = Math.max(-8, Math.min(8, (target.x - pos.x) * 0.08));
            node.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) rotate(${tilt}deg)`;
            const settled = Math.abs(target.x - pos.x) + Math.abs(target.y - pos.y) < 0.1;
            frame = settled ? 0 : requestAnimationFrame(tick);
        };

        const onMove = (event) => {
            target.x = event.clientX;
            target.y = event.clientY;
            if (!started) {
                pos.x = target.x;
                pos.y = target.y;
                started = true;
            }
            if (!frame) frame = requestAnimationFrame(tick);
        };

        window.addEventListener('pointermove', onMove, { passive: true });
        return () => {
            window.removeEventListener('pointermove', onMove);
            cancelAnimationFrame(frame);
        };
    }, []);

    return { ref, current, setCurrent };
}

function ProjectIndex({ projects }) {
    const { ref, current, setCurrent } = useTrailingPreview();

    return (
        <>
            <ul className="lp-index" onPointerLeave={() => setCurrent(null)}>
                {projects.map((project, i) => {
                    const link = project.liveUrl || project.repoUrl;
                    return (
                        <Reveal
                            as="li"
                            key={project.id}
                            delay={Math.min(i * 50, 400)}
                            className="lp-index-row grid-cols-[3rem_1fr_auto] md:grid-cols-[4rem_1.2fr_1fr_auto] gap-4 py-5 md:py-7"
                            onPointerEnter={() => project.cover?.url && setCurrent(project)}
                        >
                            <span className="lp-mono text-[#8f8d85]">{String(i + 1).padStart(2, '0')}</span>
                            <h4 className="lp-display !leading-[1] text-[clamp(1.4rem,3vw,2.4rem)] !tracking-[-0.035em]">
                                {/* The row is one big link: this anchor's ::after covers it. */}
                                {link ? (
                                    <a
                                        href={link}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="after:absolute after:inset-0 after:content-['']"
                                    >
                                        {project.title}
                                    </a>
                                ) : (
                                    project.title
                                )}
                            </h4>
                            <span className="hidden md:block lp-mono text-[#8f8d85] truncate">
                                {project.stacks?.slice(0, 3).join(' · ')}
                            </span>
                            <span className="flex items-center gap-3 relative z-[1]">
                                {project.repoUrl && project.liveUrl ? (
                                    <a href={project.repoUrl} target="_blank" rel="noreferrer" className="lp-mono text-[#8f8d85] hover:text-[#d4ff4f] transition-colors">
                                        Code
                                    </a>
                                ) : null}
                                <span aria-hidden="true" className="text-xl">↗</span>
                            </span>
                        </Reveal>
                    );
                })}
            </ul>

            <div ref={ref} className="lp-preview hidden md:block" data-visible={Boolean(current)} aria-hidden="true">
                {current?.cover?.url ? (
                    <Image key={current.id} src={current.cover.url} alt="" fill sizes="320px" className="object-cover object-top" />
                ) : null}
            </div>
        </>
    );
}

const Work = ({ projects = [], section }) => {
    const flagged = projects.filter((project) => project.isFeatured);
    const featured = flagged.length > 0 ? flagged : projects.slice(0, 3);
    const featuredIds = new Set(featured.map((project) => project.id));
    const others = projects.filter((project) => !featuredIds.has(project.id));

    if (!projects.length) return null;

    return (
        <WorkSection section={section} projects={projects} featured={featured} others={others} />
    );
};

function WorkSection({ section, projects, featured, others }) {
    const stackRef = useRef(null);
    useStackRecede(stackRef);

    return (
        <section id={section?.anchor || 'project'} className="px-4 md:px-8 py-24 md:py-36">
            <SectionIntro
                numberLabel={section?.numberLabel || '10.'}
                label={section?.navLabel || 'Work'}
                heading={section?.heading || 'Some Projects I worked on...'}
                aside={
                    <p className="lp-mono text-[#8f8d85]">
                        {String(projects.length).padStart(2, '0')} projects
                    </p>
                }
            />

            <ul ref={stackRef} className="space-y-6 md:space-y-10">
                {featured.map((project, i) => (
                    <StackCard key={project.id} project={project} index={i} total={featured.length} />
                ))}
            </ul>

            {others.length ? (
                <div className="mt-28 md:mt-40">
                    <div className="flex items-end justify-between mb-8">
                        <h3 className="lp-display text-[clamp(2rem,5vw,4rem)]">
                            More <span className="lp-serif text-[#d4ff4f]">projects</span>
                        </h3>
                        <span className="lp-mono text-[#8f8d85]">{String(others.length).padStart(2, '0')}</span>
                    </div>
                    <ProjectIndex projects={others} />
                </div>
            ) : null}
        </section>
    );
}

export default Work;
