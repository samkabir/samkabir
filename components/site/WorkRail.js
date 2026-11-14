import { motion, useMotionValue, useScroll, useSpring, useTransform } from 'motion/react';
import Image from 'next/image';
import { useEffect, useRef } from 'react';
import * as Icon from './icons';
import { Eyebrow, Magnetic, SplitText } from './motion';
import { TLink } from './Shell';

/**
 * The home page's selected work as a horizontal gallery: the section pins to the
 * viewport and scrolling down moves the cards sideways, with each screenshot
 * drifting inside its frame for depth. A last panel leads to every project.
 *
 * The pinned section's height is set from the track's real width (measured, and
 * re-measured on resize), so one pixel of scroll moves the track one pixel and
 * the gallery ends exactly as the section does. Below the `md` breakpoint it is
 * an ordinary vertical list — sideways scroll-jacking on a phone fights the
 * thumb.
 */
const DESKTOP = '(min-width: 768px)';

function RailCard({ project, index, total, progress }) {
    const primary = project.liveUrl || project.repoUrl;
    const drift = useTransform(progress, [0, 1], ['-3%', '3%']);
    // The frame takes the screenshot's own proportions, so it is never cropped
    // or blown up past its resolution.
    const ratio = project.cover?.width && project.cover?.height ? project.cover.width / project.cover.height : 16 / 9;

    const body = (
        <>
            <div className="mo-frame rounded-[22px]" style={{ aspectRatio: ratio }} data-cursor={primary ? 'Visit' : undefined}>
                {project.cover?.url ? (
                    <motion.div className="absolute inset-y-0 inset-x-[-4%]" style={{ x: drift }}>
                        <Image
                            src={project.cover.url}
                            alt={project.cover.alt || `Screenshot of ${project.title}`}
                            fill
                            sizes="(min-width: 768px) 60vw, 100vw"
                            className="object-cover object-top"
                        />
                    </motion.div>
                ) : (
                    <div className="absolute inset-0 grid place-items-center mo-serif text-[96px] text-mo-faint">{project.title?.[0]}</div>
                )}
            </div>
            <div className="mt-5 flex items-start justify-between gap-6">
                <div>
                    <p className="mo-label text-mo-faint">
                        {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
                    </p>
                    <h3 className="mt-2 text-[clamp(24px,2.4vw,34px)] font-medium tracking-[-0.03em] leading-tight">{project.title}</h3>
                </div>
                <div className="hidden lg:flex flex-wrap justify-end gap-1.5 max-w-[50%] pt-1">
                    {project.stacks?.slice(0, 4).map((stack) => (
                        <span key={stack} className="mo-chip">{stack}</span>
                    ))}
                </div>
            </div>
        </>
    );

    return (
        <article className="group shrink-0 w-full md:w-[min(58vw,960px)]">
            {primary ? (
                <a href={primary} target="_blank" rel="noreferrer" aria-label={`${project.title} (opens in a new tab)`} className="block">
                    {body}
                </a>
            ) : (
                body
            )}
        </article>
    );
}

export default function WorkRail({ projects = [], total = 0, section }) {
    const target = useRef(null);
    const track = useRef(null);
    const distance = useMotionValue(0);
    const { scrollYProgress } = useScroll({ target, offset: ['start start', 'end end'] });
    const x = useTransform([scrollYProgress, distance], ([p, d]) => -p * d);
    const bar = useSpring(scrollYProgress, { stiffness: 140, damping: 30 });

    useEffect(() => {
        const section = target.current;
        const rail = track.current;
        if (!section || !rail) return undefined;
        const media = window.matchMedia(DESKTOP);

        const measure = () => {
            if (!media.matches) {
                distance.set(0);
                section.style.height = '';
                return;
            }
            const d = Math.max(0, rail.scrollWidth - window.innerWidth);
            distance.set(d);
            section.style.height = `${window.innerHeight + d}px`;
        };

        const observer = new ResizeObserver(measure);
        observer.observe(rail);
        window.addEventListener('resize', measure);
        media.addEventListener('change', measure);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', measure);
            media.removeEventListener('change', measure);
        };
    }, [distance]);

    if (!projects.length) return null;

    return (
        <section ref={target} aria-labelledby="home-work" className="relative">
            <div className="md:sticky md:top-0 md:h-screen md:overflow-hidden flex flex-col justify-center">
                <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 flex items-end justify-between gap-6 mb-10 md:mb-[5vh]">
                    <div>
                        <Eyebrow index="02">{section?.navLabel || 'Work'}</Eyebrow>
                        <h2 id="home-work" className="mt-5 mo-display text-[clamp(40px,5.4vw,84px)] max-w-[14ch]">
                            <SplitText text={section?.heading || 'Selected work'} />
                        </h2>
                    </div>
                    <TLink href="/work" label="Work" className="hidden sm:inline-flex mo-btn mo-btn--ghost mo-btn--sm shrink-0">
                        All {total} projects
                        <Icon.ArrowRight className="mo-arrow w-4 h-4" />
                    </TLink>
                </div>

                <motion.div
                    ref={track}
                    style={{ x }}
                    className="flex flex-col md:flex-row gap-14 md:gap-[4vw] px-5 sm:px-8 md:pl-[max(2rem,calc((100vw-1440px)/2+2rem))] md:pr-[8vw] md:w-max"
                >
                    {projects.map((project, i) => (
                        <RailCard key={project.id} project={project} index={i} total={projects.length} progress={scrollYProgress} />
                    ))}

                    <div className="shrink-0 grid place-items-center md:w-[min(30vw,480px)] md:self-stretch">
                        <Magnetic strength={0.4}>
                            <TLink
                                href="/work"
                                label="Work"
                                className="group relative grid place-items-center w-48 h-48 md:w-56 md:h-56 rounded-full bg-mo-fg text-mo-bg overflow-hidden"
                            >
                                <span className="absolute inset-0 rounded-full bg-mo-accent scale-0 transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-100" />
                                <span className="relative text-center">
                                    <span className="block text-[15px] font-medium">See all work</span>
                                    <span className="mo-label opacity-70">{total} projects</span>
                                    <Icon.ArrowRight className="mx-auto mt-3 w-5 h-5 transition-transform duration-500 group-hover:translate-x-1" />
                                </span>
                            </TLink>
                        </Magnetic>
                    </div>
                </motion.div>

                <div className="hidden md:flex mx-auto w-full max-w-[1440px] px-8 mt-[5vh] items-center gap-4">
                    <div className="relative h-px flex-1 bg-mo-line overflow-hidden">
                        <motion.div className="absolute inset-0 bg-mo-fg origin-left" style={{ scaleX: bar }} />
                    </div>
                    <span className="mo-label text-mo-faint">Scroll</span>
                </div>
            </div>
        </section>
    );
}
