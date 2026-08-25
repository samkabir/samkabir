import { Box } from '@mui/material';
import Link from 'next/link';

/**
 * A tag, styled as the stack chips on a project card are.
 *
 * Deliberately the same border, radius, hover and transition as the `stacks`
 * chips in `ProjectCard` — the blog should read as part of this site rather than
 * as something bolted on, and reusing the existing vocabulary is most of how that
 * happens.
 *
 * Renders as a link when `href` is given and as a plain chip otherwise, because
 * the same pill appears in two roles: navigation on the listing, and a label on
 * a post where the tag is describing the thing you are already reading.
 */
export default function TagPill({ name, href, count, active = false }) {
  const base =
    'border-2 rounded mr-2 mb-1 px-2 transform transition duration-500 text-sm';

  const tone = active
    ? 'text-[#7a61ff] border-[#7a61ff]'
    : 'text-[#d6d6d6] border-[#d6d6d6] hover:border-[#7a61ff] hover:text-[#7a61ff]';

  const body = (
    <>
      {name}
      {typeof count === 'number' ? <span className="opacity-60"> {count}</span> : null}
    </>
  );

  if (!href) {
    return <Box className={`${base} ${tone} inline-block`}>{body}</Box>;
  }

  return (
    <Link href={href} className={`${base} ${tone} inline-block cursor-pointer`}>
      {body}
    </Link>
  );
}
