import { Counter, Reveal } from './motion';
import { useLeetcode } from './useLeetcode';

/**
 * A row of figures, every one counted from the dashboard's own data: published
 * projects, roles (full-time and contract), technologies, and — when the
 * dashboard has it switched on — problems solved on LeetCode. Each counts up the
 * first time it scrolls into view.
 */
export default function Stats({ projects, roles, skills, profile, className = '' }) {
    const leetcodeOn = Boolean(profile?.showLeetcode && profile?.leetcodeUsername);
    const leetcode = useLeetcode(leetcodeOn);

    const items = [
        { label: 'Projects shipped', value: projects },
        { label: 'Roles held', value: roles },
        { label: 'Technologies', value: skills },
        ...(leetcodeOn
            ? [{ label: 'LeetCode solved', value: leetcode.status === 'ready' ? leetcode.solved : null, pending: leetcode.status === 'loading' }]
            : []),
    ];

    return (
        <dl className={`grid grid-cols-2 lg:grid-cols-4 border-b border-mo-line ${className}`}>
            {items.map((item, i) => (
                <Reveal key={item.label} delay={i * 0.08} className={`py-7 pr-4 border-t border-mo-line ${i % 2 ? 'pl-5 border-l' : ''} ${i === 2 ? 'lg:pl-5 lg:border-l' : ''}`}>
                    <dt className="mo-label text-mo-faint">{item.label}</dt>
                    <dd className="mt-3 mo-display text-[clamp(44px,6vw,84px)] tabular-nums">
                        {typeof item.value === 'number' ? <Counter value={item.value} /> : <span className={item.pending ? 'animate-pulse' : ''}>—</span>}
                    </dd>
                </Reveal>
            ))}
        </dl>
    );
}
