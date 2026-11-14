import { motion } from 'motion/react';
import Link from 'next/link';

/**
 * A tag, in the same pill shape as the site's other chips.
 *
 * Renders as a link when `href` is given and as a plain chip otherwise, because
 * the same pill appears in two roles: navigation on the listing, and a label on
 * a post where the tag is describing the thing you are already reading. On the
 * listing the active tag's dark backing slides from one pill to the next (a
 * shared `layoutId`).
 */
export default function TagPill({ name, href, count, active = false }) {
  const body = (
    <>
      {active ? (
        <motion.span
          layoutId="tag-pill"
          className="absolute inset-0 rounded-full bg-mo-fg"
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        />
      ) : null}
      <span className="relative">
        {name}
        {typeof count === 'number' ? <span className="opacity-60"> {count}</span> : null}
      </span>
    </>
  );

  const className = `relative inline-flex items-center h-9 px-4 rounded-full text-[13.5px] font-medium transition-colors duration-300 ${
    active ? 'text-mo-bg' : 'text-mo-muted hover:text-mo-fg shadow-[inset_0_0_0_1px_var(--mo-line)]'
  }`;

  if (!href) {
    return <span className={className}>{body}</span>;
  }

  return (
    <Link href={href} scroll={false} aria-current={active ? 'page' : undefined} className={className}>
      {body}
    </Link>
  );
}
