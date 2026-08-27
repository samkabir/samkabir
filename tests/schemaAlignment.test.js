import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { createBlogPostSchema } from '@/lib/validation/blogPost';
import { createEducationSchema } from '@/lib/validation/education';
import { createExperienceSchema } from '@/lib/validation/experience';
import { createProjectSchema } from '@/lib/validation/project';
import { createResumeSchema } from '@/lib/validation/resume';
import { createSectionCopySchema } from '@/lib/validation/sectionCopy';
import { createSkillSchema } from '@/lib/validation/skill';
import { createSocialLinkSchema } from '@/lib/validation/socialLink';
import { createTagSchema } from '@/lib/validation/tag';
import { profileSchema } from '@/lib/validation/profile';
import { seoSettingsSchema } from '@/lib/validation/seo';

/**
 * Cross-checks the Zod layer against the actual database columns.
 *
 * This exists because of a specific bug, and the bug is worth stating: the
 * optional-text primitive normalised every empty value to `null`, which is right
 * for a nullable column and wrong for `Project.description` and
 * `BlogPost.excerpt`, both `String @default("")` and therefore NOT NULL. A
 * perfectly valid create request produced `Argument 'description' must not be
 * null` — a 500 with no field to attach it to.
 *
 * Nothing in the unit suite could see that: the schema parsed fine, and only
 * Postgres disagreed. So rather than assert the two known cases, this reads
 * `schema.prisma` and checks the rule that was broken — a required column never
 * receives null — across every entity. A new NOT NULL column wired to an
 * optional validator fails here instead of in production.
 */

const SCHEMA = readFileSync(path.join(import.meta.dirname, '..', 'prisma', 'schema.prisma'), 'utf8');

/**
 * The non-nullable scalar fields of one Prisma model.
 *
 * Relation fields, block attributes and comments are skipped. A field is
 * nullable exactly when its type ends in `?`, which is the only thing this needs
 * to determine.
 */
function requiredFieldsOf(modelName) {
  const block = SCHEMA.match(new RegExp(`^model ${modelName} \\{([\\s\\S]*?)^\\}`, 'm'));
  if (!block) throw new Error(`No model ${modelName} in schema.prisma`);

  const required = new Set();

  for (const line of block[1].split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@') || trimmed.startsWith('///')) {
      continue;
    }

    const match = trimmed.match(/^(\w+)\s+(\w+)(\[\])?(\?)?/);
    if (!match) continue;

    const [, field, type, isList, isOptional] = match;

    // A relation field names another model, which is always capitalised; those
    // are written through nested writes, not as scalar values.
    const isRelation = /^[A-Z]/.test(type) && !['String', 'Int', 'Boolean', 'DateTime', 'Json', 'Float', 'BigInt', 'Decimal', 'Bytes'].includes(type);

    if (!isOptional && !isList && !isRelation) required.add(field);
  }

  return required;
}

/**
 * One minimal-but-valid payload per entity, with every optional field either
 * omitted or explicitly blanked.
 *
 * Blanking is the point: it is what a user does by clearing an input, and it is
 * what triggered the bug. A fixture that filled everything in would pass while
 * the real form failed.
 */
const CASES = [
  { model: 'Skill', schema: createSkillSchema, payload: { name: 'Go', category: '' } },
  {
    model: 'Education',
    schema: createEducationSchema,
    payload: { institution: 'BRAC University', degree: '', field: '', note: '' },
  },
  {
    model: 'Experience',
    schema: createExperienceSchema,
    payload: {
      jobPosition: 'Engineer',
      companyName: 'Zavisoft',
      startDate: '2025-07-01',
      isCurrent: true,
      location: '',
      timelineOverride: '',
    },
  },
  {
    model: 'Project',
    schema: createProjectSchema,
    payload: { title: 'A Project', description: '', repoUrl: '', liveUrl: '' },
  },
  {
    model: 'SocialLink',
    schema: createSocialLinkSchema,
    payload: {
      platform: 'GitHub',
      label: 'github.com/samkabir',
      url: 'https://github.com/samkabir',
      iconKey: 'github',
    },
  },
  {
    model: 'SectionCopy',
    schema: createSectionCopySchema,
    payload: { key: 'about', numberLabel: '00.', heading: 'About Me', subheading: '', navLabel: '', anchor: '' },
  },
  {
    model: 'BlogPost',
    schema: createBlogPostSchema,
    payload: {
      title: 'A Post',
      contentMarkdown: 'Body.',
      excerpt: '',
      coverAlt: '',
      seoTitle: '',
      seoDescription: '',
    },
  },
  { model: 'Tag', schema: createTagSchema, payload: { name: 'Testing' } },
  {
    model: 'Resume',
    schema: createResumeSchema,
    payload: { label: 'CV 2026', mediaId: 'clx0000000000000000000000' },
  },
  {
    model: 'Profile',
    schema: profileSchema,
    payload: {
      greeting: 'Hi, This is',
      fullName: 'Samiul Kabir',
      headline: 'A headline.',
      bio: 'Some prose.',
      publicEmail: 'samkabir26@gmail.com',
      footerCredit: 'Designed & Built By Samiul Kabir',
      contactEmail: '',
      leetcodeUsername: '',
      attributionLabel: '',
      attributionUrl: '',
    },
  },
  {
    model: 'SeoSettings',
    schema: seoSettingsSchema,
    payload: {
      siteTitle: 'Samiul Kabir',
      defaultDescription: 'Portfolio.',
      canonicalUrl: '',
      twitterHandle: '',
    },
  },
];

describe('validation output matches column nullability', () => {
  for (const { model, schema, payload } of CASES) {
    it(`${model}: never sends null to a NOT NULL column`, () => {
      const result = schema.safeParse(payload);

      expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);

      const required = requiredFieldsOf(model);
      const offenders = Object.entries(result.data)
        .filter(([field, value]) => value === null && required.has(field))
        .map(([field]) => field);

      expect(offenders).toEqual([]);
    });
  }

  it('reads the real schema rather than silently matching nothing', () => {
    // Guards the parser itself: a regex that stopped matching would make every
    // assertion above vacuously true.
    expect(requiredFieldsOf('Project').has('title')).toBe(true);
    expect(requiredFieldsOf('Project').has('description')).toBe(true);
    expect(requiredFieldsOf('Project').has('repoUrl')).toBe(false);
    expect(requiredFieldsOf('BlogPost').has('excerpt')).toBe(true);
    expect(requiredFieldsOf('BlogPost').has('coverAlt')).toBe(false);
  });

  it('keeps the two columns that caused the bug as empty strings', () => {
    expect(createProjectSchema.safeParse({ title: 'X', description: '' }).data.description).toBe('');
    expect(
      createBlogPostSchema.safeParse({ title: 'X', contentMarkdown: 'y', excerpt: '' }).data.excerpt
    ).toBe('');
  });
});
