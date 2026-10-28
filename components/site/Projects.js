import { AnimatePresence, motion, useMotionValue, useSpring } from 'motion/react';
import Image from 'next/image';
import { forwardRef, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EASE_OUT } from './ease';
import * as Icon from './icons';
import { Roll } from './motion';
import { useShell } from './Shell';

/**
 * The /work page's three project views, which share one detail dialog:
 *
 *   * `ProjectCard` — a grid card. Its screenshot carries a `layoutId`, so when
 *     the card is opened the same image grows into the dialog and shrinks back
 *     into its card on close.
 *   * `ProjectRows` — a dense list; hovering a row floats that project's
 *     screenshot beside the pointer.
 *   * `ProjectDialog` — the details: description, stack, links, and previous /
 *     next through whatever the filter is showing.
 *
 * Clicking a project opens the dialog rather than leaving the site; the live
 * site and the source are one more click, from the dialog.
 */

function Badges({ project, showFeatured = true }) {
    return (
        <>
            {showFeatured && project.isFeatured ? (
                <span className="mo-chip !text-mo-accent-ink !shadow-[inset_0_0_0_1px_var(--mo-accent)]">
                    <Icon.Star className="w-3 h-3" /> Featured
                </span>
            ) : null}
            {project.isNda ? (
                <span className="mo-chip">
                    <Icon.Lock className="w-3 h-3" /> NDA
                </span>
            ) : null}
        </>
    );
}

function Cover({ project, sizes, priority = false }) {
    return project.cover?.url ? (
        <Image
            src={project.cover.url}
            alt={project.cover.alt || `Screenshot of ${project.title}`}
            fill
            priority={priority}
            sizes={sizes}
            className="object-cover object-top"
        />
    ) : (
        <div className="absolute inset-0 grid place-items-center mo-serif text-[80px] text-mo-faint">{project.title?.[0]}</div>
    );
}

// `forwardRef` because `AnimatePresence mode="popLayout"` measures each child.
export const ProjectCard = forwardRef(function ProjectCard({ project, index, onOpen, priority = false }, ref) {
    return (
        <motion.article
            ref={ref}
            layout
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.3 } }}
            transition={{ duration: 0.8, ease: EASE_OUT, delay: Math.min(index, 6) * 0.05 }}
            className="group"
        >
            <button type="button" onClick={() => onOpen(project.slug)} className="block w-full text-left" aria-haspopup="dialog">
                <motion.div layoutId={`cover-${project.slug}`} className="mo-frame rounded-[20px] aspect-[16/10]" data-cursor="Open" style={{ borderRadius: 20 }}>
                    <Cover project={project} priority={priority} sizes="(min-width: 1024px) 45vw, (min-width: 640px) 50vw, 100vw" />
                </motion.div>
                <div className="mt-4 flex items-start justify-between gap-4">
                    <div>
                        <h3 className="text-[20px] font-medium tracking-[-0.02em]">
                            <span className="mo-link">{project.title}</span>
                        </h3>
                        <p className="mt-1 text-[14px] text-mo-muted">{project.stacks?.slice(0, 3).join(' · ')}</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1.5 pt-0.5">
                        <Badges project={project} />
                    </div>
                </div>
            </button>
        </motion.article>
    );
});

export function ProjectRows({ projects, onOpen }) {
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const sx = useSpring(x, { stiffness: 220, damping: 26 });
    const sy = useSpring(y, { stiffness: 220, damping: 26 });
    const [hovered, setHovered] = useState(null);
    const active = projects.find((project) => project.slug === hovered);

    const move = (event) => {
        if (event.pointerType !== 'mouse') return;
        x.set(event.clientX);
        y.set(event.clientY);
    };

    return (
        <div onPointerMove={move} onPointerLeave={() => setHovered(null)}>
            <ul className="border-b border-mo-line">
                <AnimatePresence initial={false} mode="popLayout">
                    {projects.map((project, i) => (
                        <motion.li
                            key={project.slug}
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.5, ease: EASE_OUT }}
                            className="border-t border-mo-line"
                        >
                            <button
                                type="button"
                                onClick={() => onOpen(project.slug)}
                                onPointerEnter={() => setHovered(project.slug)}
                                aria-haspopup="dialog"
                                className="group mo-row w-full grid grid-cols-[40px_1fr_auto] sm:grid-cols-[60px_1.4fr_1fr_auto] items-center gap-4 py-6 px-2 sm:px-4 text-left"
                            >
                                <span className="mo-label text-mo-faint">{String(i + 1).padStart(2, '0')}</span>
                                <span className="text-[clamp(20px,2.6vw,34px)] font-medium tracking-[-0.03em] leading-tight transition-transform duration-500 group-hover:translate-x-2">
                                    {project.title}
                                </span>
                                <span className="hidden sm:block text-[14px] text-mo-muted truncate">{project.stacks?.slice(0, 3).join(' · ')}</span>
                                <span className="flex items-center gap-2">
                                    <span className="hidden md:flex gap-1.5">
                                        <Badges project={project} showFeatured={false} />
                                    </span>
                                    <Icon.ArrowUpRight className="w-5 h-5 text-mo-faint transition-all duration-500 group-hover:text-mo-accent group-hover:rotate-45" />
                                </span>
                            </button>
                        </motion.li>
                    ))}
                </AnimatePresence>
            </ul>

            <motion.div
                aria-hidden="true"
                className="pointer-events-none fixed left-0 top-0 z-40 hidden md:block w-[340px] aspect-[16/10] -ml-[170px] -mt-[106px]"
                style={{ x: sx, y: sy }}
                initial={false}
                animate={active ? { opacity: 1, scale: 1, rotate: -3 } : { opacity: 0, scale: 0.6, rotate: 0 }}
                transition={{ duration: 0.45, ease: EASE_OUT }}
            >
                <div className="mo-frame w-full h-full rounded-2xl shadow-[0_30px_60px_-20px_rgba(0,0,0,0.45)]">
                    {active ? <Cover project={active} sizes="340px" /> : null}
                </div>
            </motion.div>
        </div>
    );
}

export function ProjectDialog({ project, onClose, onStep, position }) {
    const { lenis } = useShell();
    const closeRef = useRef(null);
    const restoreFocus = useRef(null);
    const open = Boolean(project);
    // Rendered into the site root rather than in place: the page sits in its own
    // stacking context (the raised sheet), which would keep the dialog under the
    // nav whatever its z-index.
    const [host, setHost] = useState(null);
    useEffect(() => {
        const frame = requestAnimationFrame(() => setHost(document.getElementById('top')));
        return () => cancelAnimationFrame(frame);
    }, []);

    useEffect(() => {
        if (!open) return undefined;
        const smooth = lenis.current;
        smooth?.stop();
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        restoreFocus.current = document.activeElement;
        const frame = requestAnimationFrame(() => closeRef.current?.focus());

        return () => {
            cancelAnimationFrame(frame);
            smooth?.start();
            document.body.style.overflow = previousOverflow;
            restoreFocus.current?.focus?.();
        };
    }, [open, lenis]);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (event) => {
            if (event.key === 'Escape') onClose();
            if (event.key === 'ArrowRight') onStep(1);
            if (event.key === 'ArrowLeft') onStep(-1);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose, onStep]);

    if (!host) return null;

    return createPortal(
        <AnimatePresence>
            {project ? (
                <div key="dialog" className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-6">
                    <motion.div
                        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4 }}
                        onClick={onClose}
                    />
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="project-dialog-title"
                        className="relative w-full sm:max-w-[960px] max-h-[92svh] overflow-y-auto overscroll-contain rounded-t-[28px] sm:rounded-[28px] bg-mo-elev shadow-[0_40px_120px_-30px_rgba(0,0,0,0.6)]"
                        initial={{ opacity: 0, y: 60 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 40, transition: { duration: 0.3 } }}
                        transition={{ duration: 0.6, ease: EASE_OUT }}
                        data-lenis-prevent
                    >
                        <motion.div layoutId={`cover-${project.slug}`} className="mo-frame aspect-[16/9] sm:aspect-[2.4/1]" style={{ borderRadius: 0 }}>
                            <Cover project={project} sizes="(min-width: 1024px) 960px, 100vw" priority />
                        </motion.div>

                        <button
                            ref={closeRef}
                            type="button"
                            onClick={onClose}
                            aria-label="Close"
                            className="absolute top-4 right-4 grid place-items-center w-11 h-11 rounded-full bg-mo-elev text-mo-fg shadow-lg transition-transform duration-500 hover:rotate-90"
                        >
                            <Icon.Close className="w-5 h-5" />
                        </button>

                        <motion.div
                            key={project.slug}
                            className="p-6 sm:p-10"
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.15 }}
                        >
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="mo-label text-mo-faint mr-2">{position}</span>
                                <Badges project={project} />
                            </div>
                            <h2 id="project-dialog-title" className="mt-4 mo-display text-[clamp(34px,5vw,60px)]">
                                {project.title}
                            </h2>
                            {project.description ? (
                                <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-mo-muted">{project.description}</p>
                            ) : null}

                            {project.stacks?.length ? (
                                <ul className="mt-7 flex flex-wrap gap-1.5">
                                    {project.stacks.map((stack, i) => (
                                        <motion.li
                                            key={stack}
                                            className="mo-chip"
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.25 + i * 0.04 }}
                                        >
                                            {stack}
                                        </motion.li>
                                    ))}
                                </ul>
                            ) : null}

                            <div className="mt-9 flex flex-wrap items-center justify-between gap-4 border-t border-mo-line pt-6">
                                <div className="flex flex-wrap gap-2.5">
                                    {project.liveUrl ? (
                                        <a href={project.liveUrl} target="_blank" rel="noreferrer" className="mo-btn mo-btn--solid">
                                            <Roll>Visit site</Roll>
                                            <Icon.ArrowUpRight className="mo-arrow mo-arrow-ne w-4 h-4" />
                                        </a>
                                    ) : null}
                                    {project.repoUrl ? (
                                        <a href={project.repoUrl} target="_blank" rel="noreferrer" className="mo-btn mo-btn--ghost">
                                            <Roll>Source code</Roll>
                                            <Icon.ArrowUpRight className="mo-arrow mo-arrow-ne w-4 h-4" />
                                        </a>
                                    ) : null}
                                </div>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => onStep(-1)} aria-label="Previous project" className="grid place-items-center w-11 h-11 rounded-full border border-mo-line hover:bg-mo-fg hover:text-mo-bg transition-colors">
                                        <Icon.ArrowLeft className="w-4 h-4" />
                                    </button>
                                    <button type="button" onClick={() => onStep(1)} aria-label="Next project" className="grid place-items-center w-11 h-11 rounded-full border border-mo-line hover:bg-mo-fg hover:text-mo-bg transition-colors">
                                        <Icon.ArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                </div>
            ) : null}
        </AnimatePresence>,
        host,
    );
}
