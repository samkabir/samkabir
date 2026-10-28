import { useState } from 'react';
import Reveal from '../ui/Reveal';
import { SectionIntro } from './motion';

/**
 * Roles as an editorial index: one ruled row per job — number, title, company,
 * dates — that floods lime on hover and opens to show the responsibilities.
 *
 * Both experience sections render through this. Permanent roles and contract
 * work are one table split by `kind` (see `lib/content.js`), so they share one
 * view and differ only in their `SectionCopy` row and `idPrefix`, which keeps the
 * button/region ids unique when both are on the page.
 *
 * The rows are real disclosure buttons (`aria-expanded` + `aria-controls`), and
 * the expand is a `grid-template-rows` transition, so the height animates without
 * measuring anything. The first row starts open so the section never looks empty.
 */
const ExperienceList = ({ experiences = [], section, fallback, idPrefix, compact = false }) => {
    const [open, setOpen] = useState(() => new Set(experiences[0] ? [experiences[0].id] : []));

    if (!experiences.length) return null;

    const toggle = (id) =>
        setOpen((prev) => {
            const nextOpen = new Set(prev);
            if (nextOpen.has(id)) nextOpen.delete(id);
            else nextOpen.add(id);
            return nextOpen;
        });

    return (
        <section id={section?.anchor || fallback.anchor} className={`px-4 md:px-8 ${compact ? 'pb-24 md:pb-36' : 'py-24 md:py-36'}`}>
            <SectionIntro
                numberLabel={section?.numberLabel || fallback.numberLabel}
                label={section?.navLabel || fallback.label}
                heading={section?.heading || fallback.heading}
                aside={
                    <p className="lp-mono text-[#8f8d85]">
                        {String(experiences.length).padStart(2, '0')} {experiences.length === 1 ? 'role' : 'roles'}
                    </p>
                }
            />

            <ol>
                {experiences.map((e, i) => {
                    const isOpen = open.has(e.id);
                    const headId = `${idPrefix}-head-${i}`;
                    const bodyId = `${idPrefix}-body-${i}`;

                    return (
                        <Reveal as="li" key={e.id} delay={i * 70} className="lp-row" data-open={isOpen}>
                            <button
                                type="button"
                                id={headId}
                                aria-expanded={isOpen}
                                aria-controls={bodyId}
                                onClick={() => toggle(e.id)}
                                className="lp-row__head grid grid-cols-[auto_1fr_auto] md:grid-cols-[4rem_1.5fr_1fr_12rem_auto] items-center gap-x-4 md:gap-x-6 gap-y-1 px-2 md:px-4 py-6 md:py-8"
                            >
                                <span className="lp-mono lp-row__muted">{String(i + 1).padStart(2, '0')}</span>
                                <span className="lp-display !leading-[1] text-[clamp(1.4rem,3vw,2.6rem)] !tracking-[-0.035em]">
                                    {e.jobPosition}
                                </span>
                                <span className="lp-row__toggle md:order-last" aria-hidden="true">+</span>
                                <span className="lp-row__muted col-start-2 md:col-start-auto text-sm md:text-base">
                                    {e.companyName}
                                </span>
                                <span className="lp-mono lp-row__muted col-start-2 md:col-start-auto md:text-right">
                                    {e.timeline}
                                </span>
                            </button>

                            <div className="lp-row__body" id={bodyId} role="region" aria-labelledby={headId}>
                                <div>
                                    {e.responsibilities?.length ? (
                                        <ul className="grid gap-x-10 gap-y-4 md:grid-cols-2 px-2 md:pl-[calc(4rem+2.5rem)] md:pr-4 pb-10 pt-2">
                                            {e.responsibilities.map((item, j) => (
                                                <li key={j} className="relative pl-6 text-[#a9a79f] leading-relaxed">
                                                    <span aria-hidden="true" className="absolute left-0 top-[0.55em] w-2 h-2 rounded-full bg-[#d4ff4f]" />
                                                    {item}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : null}
                                </div>
                            </div>
                        </Reveal>
                    );
                })}
            </ol>
        </section>
    );
};

export default ExperienceList;
