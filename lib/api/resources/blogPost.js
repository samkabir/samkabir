import { defineResource } from '../resource.js';
import { createBlogPostSchema, updateBlogPostSchema } from '../../validation/blogPost.js';
import { estimateReadingMinutes } from '../../blog.js';
import { resolveSlug } from '../slugs.js';
import { badRequest } from '../errors.js';

/**
 * Fields of the author that are safe to send to a client.
 *
 * Written as an explicit allowlist rather than `author: true`, because `include`
 * on a relation returns every column — and `AdminUser` has a `passwordHash`.
 * Adding a sensitive column to that model must not silently start echoing it
 * through the blog list endpoint.
 */
const authorSelect = { id: true, name: true, email: true, image: true };

const include = {
  coverMedia: true,
  ogMedia: true,
  author: { select: authorSelect },
  tags: { include: { tag: true } },
};

/**
 * Confirms every tag id exists before it reaches the join table.
 *
 * Without this the failure is a foreign-key error mapped to a generic 409, which
 * tells the user nothing about which field is wrong. A stale tag id is a normal
 * thing to hit — a tag deleted in another tab while the editor was open.
 */
async function assertTagsExist(tx, tagIds) {
  if (!tagIds?.length) return;

  const found = await tx.tag.findMany({ where: { id: { in: tagIds } }, select: { id: true } });

  if (found.length !== tagIds.length) {
    throw badRequest('Some of those tags no longer exist.', {
      tagIds: 'One or more tags were deleted — reselect them.',
    });
  }
}

/**
 * Decides the publication timestamp.
 *
 * An explicit value from the form always wins, which is what allows backdating
 * an imported post. Otherwise the stamp is applied the first time a post becomes
 * PUBLISHED and left alone after that, so editing a typo in a two-year-old post
 * does not move it to the top of the archive.
 *
 * Unpublishing deliberately keeps the date: republishing should restore the post
 * to where it was, not to the front.
 */
function resolvePublishedAt({ input, existing }) {
  if (input.publishedAt !== undefined && input.publishedAt !== null) return input.publishedAt;

  const status = input.status ?? existing?.status;
  const already = existing?.publishedAt ?? null;

  if (status === 'PUBLISHED' && !already) return new Date();
  return already;
}

export const blogPostResource = defineResource({
  entity: 'BlogPost',
  delegate: 'blogPost',
  schemas: { create: createBlogPostSchema, update: updateBlogPostSchema },
  searchFields: ['title', 'excerpt', 'slug'],
  // Drafts have no publishedAt, so createdAt is the tiebreaker that keeps them
  // in a stable order rather than whatever the database returns.
  orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
  include,
  publishable: true,

  prepareCreate: async ({ input, tx, req }) => {
    const { tagIds, ...fields } = input;
    await assertTagsExist(tx, tagIds);

    return {
      data: {
        ...fields,
        slug: await resolveSlug({
          tx,
          delegate: 'blogPost',
          requested: input.slug,
          source: input.title,
        }),
        readingMinutes: estimateReadingMinutes(input.contentMarkdown),
        publishedAt: resolvePublishedAt({ input, existing: null }),
        authorId: req.adminUser.id,
        ...(tagIds?.length ? { tags: { create: tagIds.map((tagId) => ({ tagId })) } } : {}),
      },
      auditExtra: { tagIds: tagIds ?? [] },
    };
  },

  prepareUpdate: async ({ input, existing, tx }) => {
    const { tagIds, ...fields } = input;
    const data = { ...fields };

    if (input.slug) {
      data.slug = await resolveSlug({
        tx,
        delegate: 'blogPost',
        requested: input.slug,
        source: input.title ?? existing.title,
        currentId: existing.id,
      });
    }

    // Recomputed on every content edit, so the displayed estimate can never
    // describe an older version of the post.
    if (input.contentMarkdown !== undefined) {
      data.readingMinutes = estimateReadingMinutes(input.contentMarkdown);
    }

    if (input.status !== undefined || input.publishedAt !== undefined) {
      data.publishedAt = resolvePublishedAt({ input, existing });
    }

    // Tags are replaced wholesale rather than diffed. The join table carries no
    // data of its own, so deleting and recreating the rows loses nothing, and a
    // diff would be more code for an identical result.
    if (tagIds !== undefined) {
      await assertTagsExist(tx, tagIds);
      data.tags = {
        deleteMany: {},
        ...(tagIds.length ? { create: tagIds.map((tagId) => ({ tagId })) } : {}),
      };
    }

    return {
      data,
      auditExtra: tagIds !== undefined ? { tagIds } : {},
    };
  },

  onPublish: async ({ existing, status }) => ({
    publishedAt: resolvePublishedAt({ input: { status }, existing }),
  }),
});
