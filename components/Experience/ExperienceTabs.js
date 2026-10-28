import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Reveal from '../ui/Reveal';
import { trackPointer } from '../ui/spotlight';

// `useLayoutEffect` warns during server rendering; the indicator only needs it in
// the browser, where it positions the bar before paint so it never jumps.
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * The tabbed role list both experience sections render — permanent roles and
 * contract work are the same table split by `kind`, so they share one view.
 *
 * Tabs run vertically on desktop and scroll horizontally on a phone; one list
 * does both, and the accent bar that marks the active tab slides to it in either
 * orientation. It follows the WAI-ARIA tabs pattern: arrow keys move between
 * tabs, Home/End jump to the ends, and only the selected tab is in the tab order.
 *
 * `idPrefix` keeps the tab and panel ids unique when two of these share a page.
 */
const ExperienceTabs = ({ experiences = [], idPrefix }) => {
    const [value, setValue] = useState(0);
    const [bar, setBar] = useState(null);
    const listRef = useRef(null);
    const tabRefs = useRef([]);

    useIsoLayoutEffect(() => {
        const measure = () => {
            const tab = tabRefs.current[value];
            const list = listRef.current;
            if (!tab || !list) return;
            setBar({
                top: tab.offsetTop,
                left: tab.offsetLeft,
                width: tab.offsetWidth,
                height: tab.offsetHeight,
            });
        };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [value, experiences.length]);

    if (!experiences.length) return null;

    const select = (index) => {
        setValue(index);
        const tab = tabRefs.current[index];
        tab?.focus();
        tab?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    };

    const onKeyDown = (event) => {
        const last = experiences.length - 1;
        const moves = {
            ArrowDown: value === last ? 0 : value + 1,
            ArrowRight: value === last ? 0 : value + 1,
            ArrowUp: value === 0 ? last : value - 1,
            ArrowLeft: value === 0 ? last : value - 1,
            Home: 0,
            End: last,
        };
        if (!(event.key in moves)) return;
        event.preventDefault();
        select(moves[event.key]);
    };

    const active = experiences[value] ?? experiences[0];

    return (
        <Reveal className="md:flex gap-8">
            <div
                ref={listRef}
                role="tablist"
                aria-orientation="vertical"
                onKeyDown={onKeyDown}
                className="relative flex md:flex-col overflow-x-auto md:overflow-visible no-scrollbar tabs-fade border-b md:border-b-0 md:border-l border-[rgba(148,163,222,0.15)] md:min-w-[200px] md:max-w-[240px] md:self-start shrink-0 mb-6 md:mb-0"
            >
                {experiences.map((e, i) => {
                    const selected = i === value;
                    return (
                        <button
                            key={e.id}
                            ref={(node) => (tabRefs.current[i] = node)}
                            type="button"
                            role="tab"
                            id={`${idPrefix}-tab-${i}`}
                            aria-selected={selected}
                            aria-controls={`${idPrefix}-panel-${i}`}
                            tabIndex={selected ? 0 : -1}
                            onClick={() => setValue(i)}
                            className={`relative whitespace-nowrap md:whitespace-normal text-left px-5 py-3 text-sm font-medium font-mono transition-colors duration-300 ${
                                selected
                                    ? 'text-[#c9c2ff] bg-[rgba(122,97,255,0.08)]'
                                    : 'text-[#94a0bf] hover:text-[#e6e9f5] hover:bg-[rgba(122,97,255,0.05)]'
                            }`}
                        >
                            {e.jobPosition}
                        </button>
                    );
                })}

                {bar ? (
                    <>
                        <span
                            aria-hidden="true"
                            className="hidden md:block absolute -left-px w-[2px] rounded-full bg-accent shadow-[0_0_12px_rgba(122,97,255,0.9)] transition-all duration-500"
                            style={{ top: bar.top, height: bar.height, transitionTimingFunction: 'var(--ease-out)' }}
                        />
                        <span
                            aria-hidden="true"
                            className="md:hidden absolute bottom-0 h-[2px] rounded-full bg-accent transition-all duration-500"
                            style={{ left: bar.left, width: bar.width, transitionTimingFunction: 'var(--ease-out)' }}
                        />
                    </>
                ) : null}
            </div>

            <div
                key={active.id}
                role="tabpanel"
                id={`${idPrefix}-panel-${value}`}
                aria-labelledby={`${idPrefix}-tab-${value}`}
                tabIndex={0}
                onPointerMove={trackPointer}
                className="tab-panel-enter spotlight glass flex-1 rounded-2xl p-6 md:p-8 min-h-[280px]"
            >
                <h3 className="text-lg md:text-xl font-semibold text-[#f1f3fb]">
                    {active.jobPosition}{' '}
                    {active.companyName ? <span className="text-accent-soft">@ {active.companyName}</span> : null}
                </h3>
                {active.timeline ? (
                    <p className="mt-1 font-mono text-xs md:text-sm text-[#94a0bf]">{active.timeline}</p>
                ) : null}

                {active.responsibilities?.length ? (
                    <ul className="mt-6 space-y-3">
                        {active.responsibilities.map((item, i) => (
                            <li
                                key={i}
                                className="fade-up relative pl-6 text-sm md:text-[15px] leading-relaxed text-[#b4bdd6]"
                                style={{ '--delay': `${80 + i * 60}ms` }}
                            >
                                <span aria-hidden="true" className="absolute left-0 top-[0.1em] text-mint">▹</span>
                                {item}
                            </li>
                        ))}
                    </ul>
                ) : null}
            </div>
        </Reveal>
    );
};

export default ExperienceTabs;
