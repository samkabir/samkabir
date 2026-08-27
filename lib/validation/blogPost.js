import { z } from 'zod';
import {
  MAX,
  id,
  optionalText,
  publishStatus,
  requiredText,
  slug,
  textOrEmpty,
} from './primitives.js';
import { partialOf } from './common.js';

const base = z.strictObject({
  title: requiredText(200),
  slug: slug().optional(),
  excerpt: textOrEmpty(500),
  contentMarkdown: z
    .string()
    .min(1, 'A post needs some content.')
    .max(MAX.markdown, 'This post is too long to store.'),

  coverMediaId: id().nullish().transform((value) => value ?? null),
  coverAlt: optionalText(300),
  ogMediaId: id().nullish().transform((value) => value ?? null),

  seoTitle: optionalText(200),
  seoDescription: optionalText(300),

  status: publishStatus().default('DRAFT'),

  /**
   * Explicit publication date, for backdating an imported post or scheduling a
   * date the author wants shown. Left empty, the server stamps it the moment the
   * post first becomes PUBLISHED and preserves it through later edits — see
   * `lib/api/resources/blogPost.js`. `readingMinutes` is deliberately absent:
   * it is computed from the Markdown on every save so the two cannot disagree.
   */
  publishedAt: z
    .union([z.literal(''), z.null(), z.iso.datetime({ offset: true })])
    .nullish()
    .transform((value) => (value ? new Date(value) : null)),

  /**
   * Existing tags to attach. Tags are created through `/api/admin/tags`, not
   * inline here: a typo in a free-text tag field creates a near-duplicate tag
   * that then needs finding and merging, and the join table makes that
   * everybody's problem.
   */
  tagIds: z
    .array(id())
    .max(20, 'At most 20 tags.')
    .default([])
    .refine((ids) => new Set(ids).size === ids.length, { message: 'The same tag appears twice.' }),
});

/**
 * Alt text is required once a cover image is attached.
 *
 * This is an accessibility rule the database cannot hold: both columns are
 * independently nullable and only their combination is wrong. Checked on both
 * create and update, and only when a cover is actually in play.
 */
const coverRules = (value, ctx) => {
  if (value.coverMediaId && 'coverAlt' in value && !value.coverAlt) {
    ctx.addIssue({
      code: 'custom',
      path: ['coverAlt'],
      message: 'Describe the cover image for screen readers.',
    });
  }
};

export const createBlogPostSchema = base.superRefine(coverRules);
export const updateBlogPostSchema = partialOf(base).superRefine(coverRules);
