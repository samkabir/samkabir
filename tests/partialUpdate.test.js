import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { partialOf } from '../lib/validation/common.js';
import { updateBlogPostSchema } from '../lib/validation/blogPost.js';
import { updateExperienceSchema } from '../lib/validation/experience.js';
import { updateProjectSchema } from '../lib/validation/project.js';
import { updateSectionCopySchema } from '../lib/validation/sectionCopy.js';
import { updateSocialLinkSchema } from '../lib/validation/socialLink.js';

/**
 * A PATCH must write exactly what it was given, and nothing else.
 *
 * This suite exists because it did not. `.partial()` makes a field optional but
 * keeps its `.default()`, so every defaulted column reappeared in the parsed
 * output of a request that never mentioned it — and the resource layer wrote it.
 *
 * The bug was found by accident while testing something else: a PATCH sending
 * only a blog post's title came back with the post set to DRAFT. The same
 * mechanism was resetting a project's `order` to 0 and clearing `isFeatured`, and
 * flipping a contract role to FULL_TIME. Every case is silent — the request
 * succeeds, the response echoes the row just written so it looks correct, and the
 * audit entry records the damage as a deliberate change.
 *
 * The tests below are written as "renaming X must not do Y", because that is the
 * shape of the failure a reader needs to recognise.
 */
describe('a PATCH carries only the fields it sent', () => {
  it('renaming a post does not unpublish it or strip its tags', () => {
    const parsed = updateBlogPostSchema.parse({ title: 'A better title' });

    expect(parsed).toEqual({ title: 'A better title' });
    expect(parsed).not.toHaveProperty('status');
    expect(parsed).not.toHaveProperty('tagIds');
  });

  it('renaming a project does not reset its order or clear its flags', () => {
    const parsed = updateProjectSchema.parse({ title: 'A better title' });

    expect(parsed).toEqual({ title: 'A better title' });
    // `order: 0` would move it to the top of the list; `isFeatured: false` would
    // drop it off the home page. Both from an edit that only touched the title.
    expect(parsed).not.toHaveProperty('order');
    expect(parsed).not.toHaveProperty('isFeatured');
    expect(parsed).not.toHaveProperty('status');
  });

  it('renaming an experience does not move it between tabs', () => {
    const parsed = updateExperienceSchema.parse({ jobPosition: 'Staff Engineer' });

    expect(parsed).toEqual({ jobPosition: 'Staff Engineer' });
    // `kind` defaults to FULL_TIME, so this would silently reclassify a contract
    // role — the two tabs on the dashboard read from the same table.
    expect(parsed).not.toHaveProperty('kind');
    expect(parsed).not.toHaveProperty('isCurrent');
  });

  it('editing a section heading does not force it back into the nav', () => {
    const parsed = updateSectionCopySchema.parse({ heading: 'About Me' });

    expect(parsed).toEqual({ heading: 'About Me' });
    // `showInNav` defaults to true, so a heading edit would re-add a section
    // deliberately hidden from the nav.
    expect(parsed).not.toHaveProperty('showInNav');
  });

  it('editing a social link does not make it visible in both places again', () => {
    const parsed = updateSocialLinkSchema.parse({ label: 'GitHub' });

    expect(parsed).toEqual({ label: 'GitHub' });
    expect(parsed).not.toHaveProperty('showInSidebar');
    expect(parsed).not.toHaveProperty('showInContact');
  });
});

describe('values that mean "unset this" still get through', () => {
  it.each([
    ['false', { isFeatured: false }],
    ['zero', { order: 0 }],
    ['an empty array', { stacks: [] }],
  ])('keeps %s', (_label, body) => {
    // The filter is by key presence, not truthiness. A truthiness check would
    // drop exactly the values an "unset this" edit is made of.
    expect(updateProjectSchema.parse(body)).toEqual(body);
  });

  it('keeps an explicit null that clears a nullable column', () => {
    expect(updateProjectSchema.parse({ coverMediaId: null })).toEqual({ coverMediaId: null });
  });

  it('keeps a status the caller actually sent', () => {
    // The fix must not overcorrect: DRAFT is also the default, so a real
    // `status: 'DRAFT'` has to survive a filter aimed at defaults.
    expect(updateBlogPostSchema.parse({ status: 'DRAFT' })).toEqual({ status: 'DRAFT' });
  });

  it('keeps an empty tag list, which is how the last tag is removed', () => {
    expect(updateBlogPostSchema.parse({ tagIds: [] })).toEqual({ tagIds: [] });
  });
});

describe('everything partialOf guaranteed before still holds', () => {
  const schema = partialOf(
    z.strictObject({
      name: z.string().min(1),
      count: z.number().default(7),
      flag: z.boolean().default(true),
    })
  );

  it('rejects an empty body', () => {
    expect(() => schema.parse({})).toThrow(/No fields to update/);
  });

  it('rejects an unknown key', () => {
    // `strictObject` is preserved through the transform — a typo in a field name
    // must not be silently discarded.
    expect(() => schema.parse({ nope: 1 })).toThrow();
  });

  it('reports a field error at its own path, so a form can attach it', () => {
    const result = schema.safeParse({ name: '' });

    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toEqual(['name']);
  });

  it('reports every issue rather than only the first', () => {
    const result = schema.safeParse({ name: '', count: 'not a number' });

    expect(result.success).toBe(false);
    expect(result.error.issues.length).toBeGreaterThanOrEqual(2);
  });

  it('still applies transforms to the fields that were sent', () => {
    // Filtering happens after parsing, so a field that normalises — trimming,
    // coercing, mapping '' to null — keeps its parsed value rather than the raw
    // one.
    const trimming = partialOf(z.strictObject({ name: z.string().trim(), other: z.number().default(1) }));

    expect(trimming.parse({ name: '  spaced  ' })).toEqual({ name: 'spaced' });
  });
});

describe('cross-field rules still see the filtered body', () => {
  it('still requires alt text when a cover is attached', () => {
    // `superRefine` runs after the transform, so it must still receive a shape it
    // can reason about — the rule only fires when a cover is actually in play.
    const result = updateBlogPostSchema.safeParse({
      coverMediaId: 'clx0000000000000000000000',
      coverAlt: '',
    });

    expect(result.success).toBe(false);
    expect(result.error.issues.some((issue) => issue.path.includes('coverAlt'))).toBe(true);
  });

  it('does not fire that rule when no cover is being set', () => {
    expect(updateBlogPostSchema.safeParse({ title: 'x' }).success).toBe(true);
  });
});
