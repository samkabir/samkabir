import { AnimatePresence, motion, useScroll, useSpring } from 'motion/react';
import { useRef, useState } from 'react';
import { EASE_OUT } from './ease';
import * as Icon from './icons';
import { Reveal } from './motion';

/**
 * Roles as an accordion on a timeline. The line on the left draws itself as the
 * list scrolls past; each row opens to its responsibilities, which stagger in.
 *
 * The current role carries a pulsing dot. NDA roles are marked, and their
 * company name is shown exactly as the dashboard has it. `initiallyOpen` opens
 * the first row, so the page never looks like a list of closed boxes.
 */
function Row({ role, index, open, onToggle }) {
    const id = `role-${role.id}`;

    return (
        <Reveal as="div" delay={index * 0.06} y={20} className="relative pl-8 sm:pl-10 border-t border-mo-line">
            <span
                aria-hidden="true"
                className={`absolute left-0 top-[34px] -ml-[4.5px] w-[9px] h-[9px] rounded-full ring-4 ring-[color:var(--mo-bg)] ${role.isCurrent ? 'bg-mo-accent' : 'bg-mo-faint'}`}
            />
            <button
                type="button"
                className="group mo-row w-full grid gap-1 sm:grid-cols-[180px_1fr_auto] sm:gap-6 items-baseline text-left py-6 -mx-3 px-3 rounded-2xl"
                aria-expanded={open}
                aria-controls={id}
                onClick={onToggle}
            >
                <span className="mo-label text-mo-faint flex items-center gap-2">
                    {role.isCurrent ? <span className="mo-pulse" aria-hidden="true" /> : null}
                    {role.timeline}
                </span>
                <span>
                    <span className="block text-[clamp(20px,2.2vw,28px)] font-medium tracking-tight leading-tight transition-transform duration-500 group-hover:translate-x-1">
                        {role.jobPosition}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-mo-muted">
                        {role.companyName}
                        {role.location ? <span className="text-mo-faint">· {role.location}</span> : null}
                        {role.isNda ? (
                            <span className="mo-chip !h-6 !text-[11.5px]">
                                <Icon.Lock className="w-3 h-3" /> NDA
                            </span>
                        ) : null}
                    </span>
                </span>
                {role.responsibilities?.length ? (
                    <motion.span
                        aria-hidden="true"
                        className="hidden sm:grid place-items-center w-10 h-10 rounded-full border border-mo-line text-mo-muted group-hover:text-mo-fg"
                        animate={{ rotate: open ? 45 : 0 }}
                        transition={{ duration: 0.5, ease: EASE_OUT }}
                    >
                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
                            <path d="M12 5v14M5 12h14" />
                        </svg>
                    </motion.span>
                ) : null}
            </button>

            <AnimatePresence initial={false}>
                {open && role.responsibilities?.length ? (
                    <motion.div
                        id={id}
                        key="body"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.6, ease: EASE_OUT }}
                        className="overflow-hidden"
                    >
                        <ul className="sm:ml-[204px] pb-8 pr-4 space-y-3 max-w-3xl">
                            {role.responsibilities.map((item, i) => (
                                <motion.li
                                    key={i}
                                    initial={{ opacity: 0, x: -14 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.1 + i * 0.05 }}
                                    className="relative pl-5 text-[15.5px] leading-relaxed text-mo-muted before:absolute before:left-0 before:top-[0.7em] before:w-2 before:h-px before:bg-mo-accent"
                                >
                                    {item}
                                </motion.li>
                            ))}
                        </ul>
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </Reveal>
    );
}

export default function ExperienceList({ experiences = [], initiallyOpen = true }) {
    const ref = useRef(null);
    const [openId, setOpenId] = useState(initiallyOpen ? experiences[0]?.id ?? null : null);
    const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.75', 'end 0.6'] });
    const line = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });

    return (
        <div ref={ref} className="relative border-b border-mo-line">
            <div aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-px bg-mo-line" />
            <motion.div aria-hidden="true" className="absolute left-0 top-0 bottom-0 w-px bg-mo-accent origin-top" style={{ scaleY: line }} />
            {experiences.map((role, i) => (
                <Row
                    key={role.id}
                    role={role}
                    index={i}
                    open={openId === role.id}
                    onToggle={() => setOpenId((current) => (current === role.id ? null : role.id))}
                />
            ))}
        </div>
    );
}
