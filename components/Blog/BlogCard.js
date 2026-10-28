import Image from 'next/image';
import Link from 'next/link';

import { formatDay } from '../../lib/adminFormat';
import TagPill from './TagPill';

/**
 * One post on the listing: a ruled row with the date in the mono column, the
 * title and excerpt beside it, and the cover as a small thumbnail when there is
 * one — the same rhythm as the experience list, so writing and work read as one
 * site.
 *
 * Two decisions kept from the previous card:
 *
 *   * **The title area is one link** to the post.
 *   * **The cover is optional.** A post without one simply has no thumbnail
 *     rather than an empty box, which would read as "broken", not "no image".
 *
 * The tags sit outside that link: a tag is its own destination, and nesting an
 * anchor inside an anchor is invalid HTML that browsers resolve by silently
 * discarding one of them.
 */
export default function BlogCard({ post }) {
  return (
    <article className="group grid gap-2 sm:gap-8 sm:grid-cols-[9rem_1fr] border-t border-ss-line py-7">
      <p className="ss-mono text-ss-faint sm:pt-1">
        {post.publishedAt ? <time dateTime={post.publishedAt}>{formatDay(post.publishedAt)}</time> : null}
        <span className="block mt-0.5">{post.readingMinutes} min read</span>
      </p>

      <div className="flex gap-6">
        <div className="flex-1 min-w-0">
          <Link href={`/blog/${post.slug}`} className="block">
            <h2 className="text-[19px] font-medium tracking-tight text-ss-fg group-hover:text-ss-accent transition-colors">
              {post.title}
            </h2>
            {post.excerpt ? (
              <p className="mt-1.5 text-[15px] leading-relaxed text-ss-muted">{post.excerpt}</p>
            ) : null}
          </Link>

          {post.tags?.length ? (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <TagPill key={tag.slug} name={tag.name} href={`/blog?tag=${encodeURIComponent(tag.slug)}`} />
              ))}
            </div>
          ) : null}
        </div>

        {post.cover?.url ? (
          <Link href={`/blog/${post.slug}`} tabIndex={-1} aria-hidden="true" className="hidden sm:block shrink-0 w-36 aspect-[4/3] relative overflow-hidden rounded-lg border border-ss-line">
            <Image
              src={post.cover.url}
              alt=""
              fill
              sizes="144px"
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
          </Link>
        ) : null}
      </div>
    </article>
  );
}
