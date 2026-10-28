import { leetcodeProfileUrl } from '../../lib/leetcode';
import { useLeetcode } from './useLeetcode';

/**
 * A quiet strip of numbers, all counted from published content: projects,
 * roles, technologies, and — when the dashboard has it switched on — the
 * LeetCode solved count, which links to the profile.
 */
const Stats = ({ projects = 0, roles = 0, skills = 0, profile, className = '' }) => {
    const showLeetcode = profile?.showLeetcode !== false;
    const leetcode = useLeetcode(showLeetcode);
    // `|| undefined` so the default username applies to a null column, rather than
    // building `leetcode.com/null/`.
    const leetcodeUrl = leetcodeProfileUrl(profile?.leetcodeUsername || undefined);

    const items = [
        projects ? { label: 'Projects shipped', value: projects } : null,
        roles ? { label: 'Roles held', value: roles } : null,
        skills ? { label: 'Technologies', value: skills } : null,
        showLeetcode
            ? {
                  label: 'LeetCode solved',
                  value: leetcode.status === 'ready' ? leetcode.solved : leetcode.status === 'failed' ? '—' : '…',
                  href: leetcodeUrl,
              }
            : null,
    ].filter(Boolean);

    if (!items.length) return null;

    return (
        <dl className={`grid grid-cols-2 sm:grid-cols-4 border-y border-ss-line divide-ss-line sm:divide-x ${className}`}>
            {items.map((item) => {
                const body = (
                    <>
                        <dt className="ss-mono text-ss-faint">{item.label}</dt>
                        <dd className="mt-1 text-[26px] font-medium tracking-tight text-ss-fg tabular-nums">{item.value}</dd>
                    </>
                );
                return item.href ? (
                    <a key={item.label} href={item.href} target="_blank" rel="noreferrer" className="ss-row block px-4 sm:px-6 py-5">
                        {body}
                    </a>
                ) : (
                    <div key={item.label} className="px-4 sm:px-6 py-5">{body}</div>
                );
            })}
        </dl>
    );
};

export default Stats;
