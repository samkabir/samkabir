import { describe, expect, it } from 'vitest';

import { MAX, httpUrl, optionalText, requiredText, slug, stringList } from '@/lib/validation/primitives';
import { partialOf, reorderBody } from '@/lib/validation/common';
import { createSkillSchema, updateSkillSchema } from '@/lib/validation/skill';
import { createEducationSchema } from '@/lib/validation/education';
import { createExperienceSchema, updateExperienceSchema } from '@/lib/validation/experience';
import { createProjectSchema } from '@/lib/validation/project';
import { createSocialLinkSchema } from '@/lib/validation/socialLink';
import { createSectionCopySchema } from '@/lib/validation/sectionCopy';
import { createBlogPostSchema, updateBlogPostSchema } from '@/lib/validation/blogPost';
import { profileSchema } from '@/lib/validation/profile';
import { seoSettingsSchema } from '@/lib/validation/seo';
import { createResumeSchema } from '@/lib/validation/resume';

const VALID_ID = 'clx0000000000000000000000';

/** The first issue for a given field, or undefined. */
const issueFor = (result, field) =>
  result.error?.issues.find((issue) => issue.path.join('.') === field);

describe('primitives', () => {
  it('trims before checking emptiness', () => {
    expect(requiredText().safeParse('  hello  ').data).toBe('hello');
    expect(requiredText().safeParse('   ').success).toBe(false);
  });

  it('normalises every empty representation to null', () => {
    for (const input of ['', '   ', null, undefined]) {
      expect(optionalText().safeParse(input).data).toBe(null);
    }
  });

  it('accepts a value exactly at the length limit and rejects one over', () => {
    expect(requiredText(10).safeParse('a'.repeat(10)).success).toBe(true);
    expect(requiredText(10).safeParse('a'.repeat(11)).success).toBe(false);
  });

  it('drops blank list entries but enforces the count and item limits', () => {
    expect(stringList().safeParse(['a', '', '  ', 'b']).data).toEqual(['a', 'b']);
    expect(stringList({ max: 2 }).safeParse(['a', 'b', 'c']).success).toBe(false);
    expect(stringList({ itemMax: 3 }).safeParse(['abcd']).success).toBe(false);
  });

  it('rejects duplicate ids in a reorder', () => {
    expect(reorderBody.safeParse({ ids: [VALID_ID, VALID_ID] }).success).toBe(false);
    expect(reorderBody.safeParse({ ids: [] }).success).toBe(false);
  });
});

/**
 * These are the cases that matter most, because the values end up in `href`
 * attributes and public URLs where the render side trusts them.
 */
describe('injection-shaped input', () => {
  it('rejects non-http URL schemes', () => {
    const dataUri = 'data:text/html;base64,' + Buffer.from('<script>alert(1)</script>').toString('base64');

    for (const url of [
      'javascript:alert(document.cookie)',
      'JavaScript:alert(1)',
      dataUri,
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      ' javascript:alert(1)',
    ]) {
      expect(httpUrl().safeParse(url).success, url).toBe(false);
    }
  });

  it('rejects markup and path traversal in a slug', () => {
    for (const value of [
      '<script>alert(1)</script>',
      '../../etc/passwd',
      'a/b',
      'a b',
      'a_b',
      'a--b',
      '-leading',
      'trailing-',
      'CAPS AND SPACES',
    ]) {
      expect(slug().safeParse(value).success, value).toBe(false);
    }
  });

  it('refuses to accept fields the form does not own', () => {
    // Strict objects are the defence: without them a request could set `id`,
    // `status` on an entity that has no publish flow, or — on the account
    // schemas Phase 4 adds — `role`.
    const result = createSkillSchema.safeParse({ name: 'Go', id: VALID_ID, createdAt: 'now' });

    expect(result.success).toBe(false);
    expect(result.error.issues.some((issue) => issue.code === 'unrecognized_keys')).toBe(true);
  });

  it('strips a prototype-polluting key without polluting anything', () => {
    // `JSON.parse` makes `__proto__` a real own property, so it reaches the
    // schema. Zod drops it rather than reporting it as an unrecognized key — so
    // the assertion is about the guarantee that matters, not the mechanism: the
    // key does not survive into the parsed data, and Object.prototype is
    // untouched. If a future Zod starts rejecting it outright, that is stricter
    // and this test still passes on the parts it checks.
    const body = JSON.parse('{"name":"Go","__proto__":{"admin":true}}');
    const result = createSkillSchema.safeParse(body);

    expect(Object.prototype.hasOwnProperty.call(body, '__proto__')).toBe(true);
    expect({}.admin).toBeUndefined();

    if (result.success) {
      expect(Object.prototype.hasOwnProperty.call(result.data, '__proto__')).toBe(false);
      expect(Object.getPrototypeOf(result.data)).toBe(Object.prototype);
    }
  });

  it('treats SQL-shaped text as ordinary text', () => {
    // Prisma parameterises every query, so this string is data, not a threat.
    // Rejecting it would be security theatre that breaks a legitimate post about
    // SQL. The assertion pins that intent so nobody "fixes" it with a blocklist.
    const result = createSkillSchema.safeParse({ name: "'; DROP TABLE skills; --" });
    expect(result.success).toBe(true);
  });

  it('rejects a body that is not an object', () => {
    for (const body of ['string', 42, null, []]) {
      expect(createSkillSchema.safeParse(body).success).toBe(false);
    }
  });
});

describe('partialOf', () => {
  it('makes fields optional but rejects an empty body', () => {
    expect(updateSkillSchema.safeParse({ name: 'Rust' }).success).toBe(true);
    expect(updateSkillSchema.safeParse({}).success).toBe(false);
  });

  it('still enforces the underlying rules on the fields present', () => {
    expect(updateSkillSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('still rejects unknown keys', () => {
    expect(partialOf(createSkillSchema).safeParse({ nope: 1 }).success).toBe(false);
  });
});

describe('skill', () => {
  it('applies defaults', () => {
    const { data } = createSkillSchema.safeParse({ name: 'TypeScript' });
    expect(data).toEqual({ name: 'TypeScript', category: null, order: 0, status: 'PUBLISHED' });
  });

  it('rejects a status outside the enum', () => {
    expect(createSkillSchema.safeParse({ name: 'Go', status: 'ARCHIVED' }).success).toBe(false);
  });

  it('rejects a negative order', () => {
    expect(createSkillSchema.safeParse({ name: 'Go', order: -1 }).success).toBe(false);
  });
});

describe('education', () => {
  it('rejects an end year before the start year', () => {
    const result = createEducationSchema.safeParse({
      institution: 'BRAC University',
      startYear: 2021,
      endYear: 2019,
    });

    expect(result.success).toBe(false);
    expect(issueFor(result, 'endYear')).toBeTruthy();
  });

  it('accepts a single year with no end', () => {
    expect(
      createEducationSchema.safeParse({ institution: 'BRAC University', startYear: 2021 }).success
    ).toBe(true);
  });

  it('rejects an implausible year', () => {
    expect(createEducationSchema.safeParse({ institution: 'X', startYear: 1500 }).success).toBe(false);
  });
});

describe('experience', () => {
  const base = {
    jobPosition: 'Software Engineer',
    companyName: 'Zavisoft',
    startDate: '2025-07-01',
  };

  it('parses a calendar date into a Date at UTC noon', () => {
    const { data } = createExperienceSchema.safeParse({ ...base, isCurrent: true });
    // Noon UTC so that no timezone shifts the stored day to its neighbour.
    expect(data.startDate.toISOString()).toBe('2025-07-01T12:00:00.000Z');
  });

  it('rejects a date that does not exist', () => {
    expect(createExperienceSchema.safeParse({ ...base, startDate: '2025-02-30' }).success).toBe(false);
  });

  it('rejects an end date before the start date', () => {
    const result = createExperienceSchema.safeParse({
      ...base,
      endDate: '2024-01-01',
      isCurrent: false,
    });

    expect(result.success).toBe(false);
    expect(issueFor(result, 'endDate')).toBeTruthy();
  });

  it('rejects a current role that also has an end date', () => {
    const result = createExperienceSchema.safeParse({
      ...base,
      endDate: '2026-01-01',
      isCurrent: true,
    });

    expect(result.success).toBe(false);
    expect(issueFor(result, 'endDate').message).toMatch(/current/i);
  });

  it('requires an end date when the role is not current', () => {
    const result = createExperienceSchema.safeParse({ ...base, isCurrent: false });
    expect(result.success).toBe(false);
  });

  it('applies the same cross-field rules to a partial update', () => {
    const result = updateExperienceSchema.safeParse({ isCurrent: true, endDate: '2026-01-01' });
    expect(result.success).toBe(false);
  });

  it('does not invent a rule when only one of the pair is sent', () => {
    expect(updateExperienceSchema.safeParse({ jobPosition: 'Senior Engineer' }).success).toBe(true);
  });
});

describe('project', () => {
  it('leaves the slug undefined so the server can derive it', () => {
    const { data } = createProjectSchema.safeParse({ title: 'Shades Sunglases' });
    expect(data.slug).toBeUndefined();
  });

  it('lowercases an explicit slug', () => {
    const { data } = createProjectSchema.safeParse({ title: 'X', slug: 'My-Project' });
    expect(data.slug).toBe('my-project');
  });

  it('rejects a cover media id that is not a cuid', () => {
    expect(createProjectSchema.safeParse({ title: 'X', coverMediaId: 'nope' }).success).toBe(false);
  });

  it('accepts an empty repo url as null', () => {
    const { data } = createProjectSchema.safeParse({ title: 'X', repoUrl: '' });
    expect(data.repoUrl).toBe(null);
  });
});

describe('social link', () => {
  const base = {
    platform: 'GitHub',
    label: 'github.com/samkabir',
    url: 'https://github.com/samkabir',
  };

  it('accepts a known icon key', () => {
    expect(createSocialLinkSchema.safeParse({ ...base, iconKey: 'github' }).success).toBe(true);
  });

  it('rejects an icon the frontend has no component for', () => {
    const result = createSocialLinkSchema.safeParse({ ...base, iconKey: 'mastodon' });
    expect(result.success).toBe(false);
  });

  it('requires an absolute url', () => {
    expect(
      createSocialLinkSchema.safeParse({ ...base, iconKey: 'github', url: '/relative' }).success
    ).toBe(false);
  });
});

describe('section copy', () => {
  it('rejects a key the site does not render', () => {
    expect(
      createSectionCopySchema.safeParse({ key: 'testimonials', numberLabel: '00.', heading: 'X' })
        .success
    ).toBe(false);
  });

  it('accepts the binary number label verbatim', () => {
    const { data } = createSectionCopySchema.safeParse({
      key: 'about',
      numberLabel: '00.',
      heading: 'About Me',
    });
    expect(data.numberLabel).toBe('00.');
  });
});

describe('blog post', () => {
  const base = { title: 'Hello', contentMarkdown: '# Hi\n\nSome words.' };

  it('defaults to a draft', () => {
    const { data } = createBlogPostSchema.safeParse(base);
    expect(data.status).toBe('DRAFT');
    expect(data.publishedAt).toBe(null);
  });

  it('rejects an empty body', () => {
    expect(createBlogPostSchema.safeParse({ ...base, contentMarkdown: '' }).success).toBe(false);
  });

  it('rejects content past the storage limit', () => {
    expect(
      createBlogPostSchema.safeParse({ ...base, contentMarkdown: 'x'.repeat(MAX.markdown + 1) }).success
    ).toBe(false);
  });

  it('requires alt text once a cover image is attached', () => {
    const result = createBlogPostSchema.safeParse({ ...base, coverMediaId: VALID_ID, coverAlt: '' });
    expect(result.success).toBe(false);
    expect(issueFor(result, 'coverAlt')).toBeTruthy();
  });

  it('accepts a cover image with alt text', () => {
    expect(
      createBlogPostSchema.safeParse({
        ...base,
        coverMediaId: VALID_ID,
        coverAlt: 'A laptop on a desk',
      }).success
    ).toBe(true);
  });

  it('rejects duplicate tags', () => {
    expect(createBlogPostSchema.safeParse({ ...base, tagIds: [VALID_ID, VALID_ID] }).success).toBe(
      false
    );
  });

  it('does not accept readingMinutes from the client', () => {
    expect(createBlogPostSchema.safeParse({ ...base, readingMinutes: 99 }).success).toBe(false);
  });

  it('does not accept authorId from the client', () => {
    // The author is the signed-in user, not a form field — otherwise a post
    // could be attributed to someone else.
    expect(createBlogPostSchema.safeParse({ ...base, authorId: VALID_ID }).success).toBe(false);
  });

  it('accepts an explicit publication date for backdating', () => {
    const { data } = createBlogPostSchema.safeParse({
      ...base,
      status: 'PUBLISHED',
      publishedAt: '2024-03-01T09:00:00.000Z',
    });
    expect(data.publishedAt.toISOString()).toBe('2024-03-01T09:00:00.000Z');
  });

  it('rejects a publication date without a timezone offset', () => {
    expect(updateBlogPostSchema.safeParse({ publishedAt: '2024-03-01 09:00' }).success).toBe(false);
  });
});

describe('profile', () => {
  const base = {
    greeting: 'Hi, This is',
    fullName: 'Samiul Kabir',
    headline: 'I Forge Web Designs for the Digital space.',
    bio: 'Some prose.',
    publicEmail: 'samkabir26@gmail.com',
    footerCredit: 'Designed & Built By Samiul Kabir',
  };

  it('accepts the current site content', () => {
    expect(profileSchema.safeParse(base).success).toBe(true);
  });

  it('lowercases and trims the email', () => {
    const { data } = profileSchema.safeParse({ ...base, publicEmail: '  SamKabir26@Gmail.com ' });
    expect(data.publicEmail).toBe('samkabir26@gmail.com');
  });

  it('rejects a malformed email', () => {
    expect(profileSchema.safeParse({ ...base, publicEmail: 'not-an-email' }).success).toBe(false);
  });

  it('treats a blank contact email as absent', () => {
    const { data } = profileSchema.safeParse({ ...base, contactEmail: '' });
    expect(data.contactEmail).toBe(null);
  });
});

describe('seo settings', () => {
  const base = { siteTitle: 'Samiul Kabir', defaultDescription: 'Portfolio.' };

  it('strips a leading @ from the twitter handle', () => {
    expect(
      seoSettingsSchema.safeParse({ ...base, twitterHandle: '@samkabir' }).data.twitterHandle
    ).toBe('samkabir');
    expect(
      seoSettingsSchema.safeParse({ ...base, twitterHandle: 'samkabir' }).data.twitterHandle
    ).toBe('samkabir');
  });
});

describe('resume', () => {
  it('does not accept a version or an active flag from the client', () => {
    expect(
      createResumeSchema.safeParse({ label: 'CV 2026', mediaId: VALID_ID, version: 7 }).success
    ).toBe(false);
    expect(
      createResumeSchema.safeParse({ label: 'CV 2026', mediaId: VALID_ID, isActive: true }).success
    ).toBe(false);
  });

  it('requires a media id', () => {
    expect(createResumeSchema.safeParse({ label: 'CV 2026' }).success).toBe(false);
  });
});
