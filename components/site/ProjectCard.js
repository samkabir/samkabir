import Image from 'next/image';
import * as Icon from './icons';

/**
 * One project: the screenshot inset on a tinted panel, then the title, the
 * description and the stack.
 *
 * The whole card is one link — to the live site when there is one, else the
 * repository — made with a stretched `::after` on the title link, so the source
 * link can still sit on top as its own target. A project with neither link is a
 * plain card. NDA work and featured projects are marked from their dashboard
 * flags (the home page, which only shows featured work, turns that badge off); the card's `id` is the project's slug, which the command palette links to.
 */
const ProjectCard = ({ project, wide = false, priority = false, showFeatured = true }) => {
    const primary = project.liveUrl || project.repoUrl;
    const showRepo = project.repoUrl && project.liveUrl;

    return (
        <article id={project.slug} className={`ss-card ss-card--hover group relative flex flex-col overflow-hidden h-full ${wide ? 'sm:col-span-2' : ''}`}>
            <div className={`ss-shot ${wide ? 'aspect-[16/10] sm:aspect-[2.1/1]' : 'aspect-[16/10]'}`}>
                {project.cover?.url ? (
                    <div className="ss-shot__img">
                        <Image
                            src={project.cover.url}
                            alt={project.cover.alt || `Screenshot of ${project.title}`}
                            fill
                            priority={priority}
                            sizes={wide ? '(min-width: 1024px) 960px, 100vw' : '(min-width: 1024px) 480px, (min-width: 640px) 50vw, 100vw'}
                            className="object-cover object-top"
                        />
                    </div>
                ) : (
                    <div className="absolute inset-0 grid place-items-center ss-serif text-[64px] text-ss-faint">{project.title?.[0]}</div>
                )}
            </div>

            <div className="flex flex-col flex-1 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                    <h3 className="text-[17px] font-medium tracking-tight text-ss-fg">
                        {primary ? (
                            <a href={primary} target="_blank" rel="noreferrer" className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
                                {project.title}
                            </a>
                        ) : (
                            project.title
                        )}
                    </h3>
                    {primary ? <Icon.ArrowUpRight className="ss-arrow-ne w-4 h-4 mt-1 shrink-0 text-ss-faint group-hover:text-ss-fg" /> : null}
                </div>

                {project.description ? (
                    <p className={`mt-2 text-[14px] leading-relaxed text-ss-muted ${wide ? 'line-clamp-3 max-w-2xl' : 'line-clamp-3'}`}>
                        {project.description}
                    </p>
                ) : null}

                <div className="mt-auto pt-5 flex flex-wrap items-center gap-1.5">
                    {showFeatured && project.isFeatured ? (
                        <span className="ss-chip !text-ss-accent !border-transparent !bg-ss-accent-soft gap-1">
                            <Icon.Star className="w-3 h-3" /> Featured
                        </span>
                    ) : null}
                    {project.isNda ? (
                        <span className="ss-chip gap-1"><Icon.Lock className="w-3 h-3" /> NDA</span>
                    ) : null}
                    {project.stacks?.slice(0, wide ? 6 : 4).map((stack) => (
                        <span key={stack} className="ss-chip">{stack}</span>
                    ))}
                    {showRepo ? (
                        <a
                            href={project.repoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="relative z-[1] ml-auto ss-mono text-ss-faint hover:text-ss-fg transition-colors"
                        >
                            Source ↗
                        </a>
                    ) : null}
                </div>
            </div>
        </article>
    );
};

export default ProjectCard;
