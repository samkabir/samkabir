import Reveal from './Reveal';

/**
 * The numbered heading every landing section opens with: a mono index, the
 * title, and a hairline that runs to the edge of the column.
 *
 * `numberLabel` and `heading` come from the section's `SectionCopy` row, with the
 * caller's fallback for an unseeded database — the same contract the sections
 * had before, now drawn in one place.
 */
const SectionHeading = ({ numberLabel, heading, as: Tag = 'h2', size = 'lg' }) => {
    const text = size === 'lg' ? 'text-2xl md:text-4xl' : 'text-xl md:text-2xl';

    return (
        <Reveal className="flex items-center gap-4 mb-10">
            <Tag className={`flex items-baseline gap-3 font-bold tracking-tight text-[#e6e9f5] md:whitespace-nowrap ${text}`}>
                {numberLabel ? (
                    <span className="font-mono text-base md:text-lg font-normal text-accent">{numberLabel}</span>
                ) : null}
                {heading}
            </Tag>
            <span aria-hidden="true" className="hidden sm:block h-px flex-1 max-w-xs bg-gradient-to-r from-[rgba(148,163,222,0.3)] to-transparent" />
        </Reveal>
    );
};

export default SectionHeading;
