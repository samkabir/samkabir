import { Box, Typography } from '@mui/material';
import Image from 'next/image';
import Link from 'next/link';

import { formatDay } from '../../lib/adminFormat';
import { rubikFont } from '../../lib/fonts';
import TagPill from './TagPill';

/**
 * One post on the listing.
 *
 * Built on `ProjectCard`'s surface on purpose — `#233352`, the same radius, the
 * same `hover:scale-105` and 500ms transition. The blog is a new section of an
 * existing site, and inventing a second card style would make it look like a
 * different product.
 *
 * Two differences from a project card, both deliberate:
 *
 *   * **The whole card is a link**, not just the title. A card that only responds
 *     to a small text target is a worse version of the same thing, and a project
 *     card links out to two different places so it cannot do this.
 *   * **The cover is optional.** A post without one gets the text layout rather
 *     than a placeholder box: an empty grey rectangle communicates "broken", not
 *     "no image".
 */
export default function BlogCard({ post }) {
  return (
    <Box className="bg-[#233352] rounded transform transition duration-500 hover:scale-105 mt-6 md:mt-0 pb-4 pt-2 h-full">
      <Link href={`/blog/${post.slug}`} className="block">
        {post.cover?.url ? (
          <Box className="flex justify-center py-3">
            <Image
              src={post.cover.url}
              alt={post.coverAlt || post.cover.alt || `Cover image for ${post.title}`}
              width={post.cover.width ?? 280}
              height={post.cover.height ?? 158}
              className="rounded"
              sizes="280px"
              style={{ width: 280, height: 'auto' }}
            />
          </Box>
        ) : null}

        <Box className="px-5 py-2">
          <Box className="flex flex-wrap items-baseline gap-x-3">
            <Typography variant="caption" className={`text-[#7a61ff] ${rubikFont.className}`}>
              {post.publishedAt ? formatDay(post.publishedAt) : ''}
            </Typography>
            <Typography variant="caption" className={`text-[#d6d6d6] opacity-70 ${rubikFont.className}`}>
              {post.readingMinutes} min read
            </Typography>
          </Box>

          <Typography variant="h6" className={`font-[600] text-[#d6d6d6] pt-1 ${rubikFont.className}`}>
            {post.title}
          </Typography>

          {post.excerpt ? (
            <Typography variant="caption" className={`text-[#d6d6d6] ${rubikFont.className}`}>
              {post.excerpt}
            </Typography>
          ) : null}
        </Box>
      </Link>

      {/* Outside the card link: a tag is its own destination, and nesting an
          anchor inside an anchor is invalid HTML that browsers resolve by
          silently discarding one of them. */}
      {post.tags?.length ? (
        <Box className="flex flex-wrap px-5 pt-3">
          {post.tags.map((tag) => (
            <TagPill key={tag.slug} name={tag.name} href={`/blog?tag=${encodeURIComponent(tag.slug)}`} />
          ))}
        </Box>
      ) : null}
    </Box>
  );
}
