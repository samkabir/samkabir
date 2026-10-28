import Link from 'next/link';

/**
 * A tag, drawn as the site's chip (`.ss-chip`), so the blog reads as part of the
 * same site as the project cards' stack chips.
 *
 * Renders as a link when `href` is given and as a plain chip otherwise, because
 * the same pill appears in two roles: navigation on the listing, and a label on
 * a post where the tag is describing the thing you are already reading.
 */
export default function TagPill({ name, href, count, active = false }) {
  const body = (
    <>
      {name}
      {typeof count === 'number' ? <span className="ml-1.5 opacity-60">{count}</span> : null}
    </>
  );

  if (!href) {
    return <span className="ss-chip">{body}</span>;
  }

  return (
    <Link href={href} className="ss-chip" data-active={active} aria-current={active ? 'page' : undefined}>
      {body}
    </Link>
  );
}
