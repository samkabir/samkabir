import Link from 'next/link';
import Reveal from './Reveal';
import * as Icon from './icons';

/**
 * A section's opening line: a small mono label, the heading, and optionally a
 * "see all" link on the right. The label and heading come from the section's
 * `SectionCopy` row (`navLabel` and `heading`), so the dashboard names them.
 */
export const SectionHeader = ({ label, heading, action, id, as: Tag = 'h2' }) => (
    <Reveal className="flex items-end justify-between gap-6 mb-8">
        <div>
            {label ? <p className="ss-mono uppercase tracking-wider text-ss-faint mb-2">{label}</p> : null}
            <Tag id={id} className="ss-serif text-[30px] sm:text-[34px] leading-[1.1] text-ss-fg">{heading}</Tag>
        </div>
        {action ? (
            <Link href={action.href} className="group shrink-0 inline-flex items-center gap-1.5 text-[14px] text-ss-muted hover:text-ss-fg transition-colors pb-1">
                {action.label}
                <Icon.ArrowRight className="ss-arrow w-4 h-4" />
            </Link>
        ) : null}
    </Reveal>
);

/** The page-level opening used by Work, About and Writing. */
export const PageHeader = ({ label, heading, children, aside = null }) => (
    <header className="relative">
        <div aria-hidden="true" className="ss-dots absolute inset-x-0 -top-16 h-[360px] pointer-events-none" />
        <div className="relative mx-auto max-w-5xl px-5 sm:px-8 pt-16 sm:pt-24 pb-12 sm:pb-16 flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
                {label ? <p className="ss-in ss-mono uppercase tracking-wider text-ss-accent">{label}</p> : null}
                <h1 className="ss-in ss-serif mt-3 text-[44px] sm:text-[60px] leading-[1.02] text-ss-fg" style={{ '--d': '80ms' }}>
                    {heading}
                </h1>
                {children ? (
                    <div className="ss-in mt-5 text-[17px] leading-relaxed text-ss-muted" style={{ '--d': '160ms' }}>
                        {children}
                    </div>
                ) : null}
            </div>
            {aside ? <div className="ss-in" style={{ '--d': '240ms' }}>{aside}</div> : null}
        </div>
    </header>
);
