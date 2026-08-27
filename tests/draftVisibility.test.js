import { describe, expect, it } from 'vitest';

import {
  getPostBySlug,
  getPostNeighbours,
  getPublishedPostSlugs,
  getPublishedPosts,
} from '@/lib/content';

/**
 * Drafts must be unreachable from the public site — by slug, in the listing, in
 * the sitemap, and as a neighbour link.
 *
 * The rule lives in the `where` clause of every public query (`livePosts()` in
 * lib/content.js), never in a check on the result, precisely so an early return
 * cannot be added above it. This test proves the clause does the filtering by
 * running the real content functions against a **faithful** in-memory Prisma
 * stand-in: a generic `where` evaluator, not one hard-coded to know about
 * `status`. If a function stopped passing a draft-excluding `where`, the draft
 * would come back and the assertion would fail.
 *
 * The dataset is chosen to catch the two ways this goes wrong:
 *
 *   * a `DRAFT` that still carries a `publishedAt` — a post published once and
 *     then unpublished keeps its date, so filtering on `publishedAt != null`
 *     alone would leak it. The clause must also require `status = PUBLISHED`.
 *   * a `PUBLISHED` post dated in the future — scheduled, not yet live. The clause
 *     must require `publishedAt <= now`.
 */

const OPERATORS = new Set(['not', 'equals', 'lte', 'gte', 'lt', 'gt', 'in', 'some']);

const time = (value) => (value instanceof Date ? value.getTime() : value);

function isOperatorObject(cond) {
  return (
    cond !== null &&
    typeof cond === 'object' &&
    !(cond instanceof Date) &&
    !Array.isArray(cond) &&
    Object.keys(cond).length > 0 &&
    Object.keys(cond).every((key) => OPERATORS.has(key))
  );
}

/** Evaluates one field's condition the way Prisma would. */
function matchesCondition(value, cond) {
  if (isOperatorObject(cond)) {
    return Object.entries(cond).every(([op, operand]) => {
      switch (op) {
        case 'not':
          return !matchesCondition(value, operand);
        case 'equals':
          return matchesCondition(value, operand);
        case 'lte':
          return value != null && time(value) <= time(operand);
        case 'gte':
          return value != null && time(value) >= time(operand);
        case 'lt':
          return value != null && time(value) < time(operand);
        case 'gt':
          return value != null && time(value) > time(operand);
        case 'in':
          return Array.isArray(operand) && operand.includes(value);
        case 'some':
          return Array.isArray(value) && value.some((item) => matchesWhere(item, operand));
        default:
          return false;
      }
    });
  }

  // A nested relation object — `{ tag: { slug: 'x' } }` — recurses; a scalar is a
  // plain equality; a Date compares by instant.
  if (cond !== null && typeof cond === 'object' && !(cond instanceof Date) && !Array.isArray(cond)) {
    return matchesWhere(value ?? {}, cond);
  }

  if (cond instanceof Date || value instanceof Date) return time(value) === time(cond);
  return value === cond;
}

function matchesWhere(row, where) {
  return Object.entries(where ?? {}).every(([field, cond]) => matchesCondition(row?.[field], cond));
}

/**
 * A Prisma stand-in whose only cleverness is filtering by `where`. Ordering,
 * `select` and `take`/`skip` are honoured just enough for the functions under
 * test; the point of interest is which rows survive the filter.
 */
function fakeClient(rows) {
  const survivors = (where) => rows.filter((row) => matchesWhere(row, where));

  return {
    blogPost: {
      findFirst: async ({ where }) => survivors(where)[0] ?? null,
      findMany: async ({ where, take, skip = 0 }) => {
        let out = survivors(where);
        if (skip) out = out.slice(skip);
        if (take) out = out.slice(0, take);
        return out;
      },
      count: async ({ where }) => survivors(where).length,
    },
  };
}

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

const makePost = (overrides) => ({
  id: overrides.slug,
  slug: overrides.slug,
  title: overrides.slug,
  excerpt: 'x',
  readingMinutes: 1,
  status: 'PUBLISHED',
  publishedAt: new Date(now - DAY),
  createdAt: new Date(now - DAY),
  updatedAt: new Date(now - DAY),
  contentMarkdown: '# body',
  seoTitle: null,
  seoDescription: null,
  coverMedia: null,
  coverAlt: null,
  ogMedia: null,
  tags: [],
  author: { name: 'A' },
  ...overrides,
});

const rows = [
  makePost({ slug: 'live', publishedAt: new Date(now - DAY) }),
  makePost({ slug: 'plain-draft', status: 'DRAFT', publishedAt: null }),
  // The dangerous one: a draft that kept its old publication date.
  makePost({ slug: 'unpublished-again', status: 'DRAFT', publishedAt: new Date(now - DAY) }),
  // Scheduled: published, but dated in the future.
  makePost({ slug: 'scheduled', status: 'PUBLISHED', publishedAt: new Date(now + DAY) }),
];

const client = fakeClient(rows);

describe('a draft is not reachable by slug', () => {
  it('returns the live post', async () => {
    const post = await getPostBySlug('live', client);
    expect(post?.slug).toBe('live');
  });

  it('returns null for a plain draft', async () => {
    expect(await getPostBySlug('plain-draft', client)).toBeNull();
  });

  it('returns null for a draft that still carries a publication date', async () => {
    // The status check, not the date check, is what catches this one.
    expect(await getPostBySlug('unpublished-again', client)).toBeNull();
  });

  it('returns null for a post scheduled in the future', async () => {
    expect(await getPostBySlug('scheduled', client)).toBeNull();
  });
});

describe('drafts are absent from the public collections', () => {
  it('lists only the live post', async () => {
    const { posts, total } = await getPublishedPosts({}, client);
    expect(posts.map((p) => p.slug)).toEqual(['live']);
    expect(total).toBe(1);
  });

  it('sitemaps only the live post', async () => {
    const slugs = await getPublishedPostSlugs(client);
    expect(slugs.map((s) => s.slug)).toEqual(['live']);
  });

  it('never offers a draft or a scheduled post as a neighbour', async () => {
    // Neighbours of the live post: nothing older or newer is live, so both ends
    // are empty even though a draft and a scheduled post exist on either side.
    const { previous, next } = await getPostNeighbours(new Date(now - DAY), client);
    expect(previous).toBeNull();
    expect(next).toBeNull();
  });
});

describe('the where-evaluator itself is faithful', () => {
  // A stand-in that silently matched everything would make every test above pass
  // vacuously. These pin its two load-bearing behaviours.
  it('treats `not: null` as "must have a value"', () => {
    expect(matchesWhere({ publishedAt: new Date() }, { publishedAt: { not: null } })).toBe(true);
    expect(matchesWhere({ publishedAt: null }, { publishedAt: { not: null } })).toBe(false);
  });

  it('enforces `status` equality alongside a date range', () => {
    const where = { status: 'PUBLISHED', publishedAt: { not: null, lte: new Date(now) } };
    expect(matchesWhere({ status: 'PUBLISHED', publishedAt: new Date(now - DAY) }, where)).toBe(true);
    expect(matchesWhere({ status: 'DRAFT', publishedAt: new Date(now - DAY) }, where)).toBe(false);
  });
});
