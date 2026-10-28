import Reveal from './Reveal';
import * as Icon from './icons';

/**
 * Roles as a quiet timeline: dates in a narrow mono column on the left, the role
 * on the right with company, location and what the work involved.
 *
 * Everything shown is a dashboard field — `location`, the NDA flag and
 * `isCurrent` included — so a role marked current gets a live dot, and NDA work
 * says so rather than leaving a gap where a company name might be expected.
 * `compact` drops the responsibilities for the home page's short version.
 */
const ExperienceList = ({ experiences = [], compact = false }) => (
    <ol className="relative">
        {experiences.map((e, i) => (
            <Reveal
                as="li"
                key={e.id}
                id={`role-${e.id}`}
                delay={Math.min(i * 60, 300)}
                className={`grid gap-1 sm:gap-8 sm:grid-cols-[11rem_1fr] border-t border-ss-line ${compact ? 'py-5' : 'py-8'} last:border-b`}
            >
                <p className="ss-mono text-ss-faint sm:pt-1">{e.timeline}</p>
                <div>
                    <h3 className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[16px] font-medium text-ss-fg">
                        {e.isCurrent ? <span className="ss-pulse" title="Current role" /> : null}
                        {e.jobPosition}
                        {e.isNda ? (
                            <span className="ss-chip !h-5 !text-[11px] gap-1"><Icon.Lock className="w-3 h-3" /> NDA</span>
                        ) : null}
                    </h3>
                    <p className="mt-0.5 text-[14px] text-ss-muted">
                        {e.companyName}
                        {e.location ? <span className="text-ss-faint"> · {e.location}</span> : null}
                    </p>
                    {!compact && e.responsibilities?.length ? (
                        <ul className="mt-4 space-y-2 max-w-2xl">
                            {e.responsibilities.map((item, j) => (
                                <li key={j} className="relative pl-5 text-[14.5px] leading-relaxed text-ss-muted">
                                    <span aria-hidden="true" className="absolute left-0 top-[0.7em] w-2 h-px bg-ss-faint" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </div>
            </Reveal>
        ))}
    </ol>
);

export default ExperienceList;
