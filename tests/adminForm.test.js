import { describe, expect, it } from 'vitest';

import {
  changedFields,
  formValues,
  hasChanges,
  mergeFieldErrors,
  toPayload,
  validateWith,
} from '@/lib/adminForm';
import { createExperienceSchema, updateExperienceSchema } from '@/lib/validation/experience';
import { createProjectSchema, updateProjectSchema } from '@/lib/validation/project';
import { createSkillSchema, updateSkillSchema } from '@/lib/validation/skill';

/**
 * The four operations a form performs, tested away from the form.
 *
 * These are where a dashboard is most likely to be subtly wrong — a cleared field
 * that silently keeps its old value, a PATCH that sends every field and so
 * overwrites a change made in another tab, a validator running on the wrong shape
 * — and none of it is visible in a screenshot. Inside a component they would only
 * ever be exercised by clicking.
 *
 * The schemas imported here are the real ones the endpoints use. That is the
 * point of several assertions below: they prove the shape the form produces is
 * the shape the server accepts, which is the disagreement that otherwise presents
 * as "the form accepted it and saving failed".
 */

const FIELDS = [
  { name: 'title', label: 'Title', type: 'text' },
  { name: 'description', label: 'Description', type: 'textarea' },
  { name: 'stacks', label: 'Stack', type: 'list' },
  { name: 'isFeatured', label: 'Featured', type: 'checkbox' },
  { name: 'coverMediaId', mediaKey: 'coverMedia', label: 'Cover', type: 'image' },
  { name: 'startYear', label: 'Start year', type: 'year' },
  { name: 'startDate', label: 'Start', type: 'date' },
];

describe('formValues', () => {
  it('turns a null column into an empty string', () => {
    // `null` in a controlled input makes React treat it as uncontrolled and
    // warn — and then the field silently stops updating.
    const values = formValues({ title: null, description: null }, FIELDS);

    expect(values.title).toBe('');
    expect(values.description).toBe('');
  });

  it('handles a record that does not exist yet', () => {
    const values = formValues(null, FIELDS);

    expect(values.title).toBe('');
    expect(values.stacks).toEqual([]);
    expect(values.isFeatured).toBe(false);
    expect(values.coverMediaId).toBe(null);
  });

  it('copies arrays rather than sharing them', () => {
    // The record is also the rollback snapshot. Editing the form must not edit
    // the list the screen would restore on failure.
    const record = { stacks: ['Next.js'] };
    const values = formValues(record, FIELDS);

    values.stacks.push('Prisma');

    expect(record.stacks).toEqual(['Next.js']);
  });

  it('reduces a timestamp to a calendar day', () => {
    // `@db.Date` columns come back as a full ISO string; the input wants a day.
    const values = formValues({ startDate: '2025-07-14T12:00:00.000Z' }, FIELDS);

    expect(values.startDate).toBe('2025-07-14');
  });

  it('takes the whole media row, not the id', () => {
    // The preview needs the url and the alt text; `toPayload` reduces it later.
    const cover = { id: 'clx1', url: 'https://blob.example/a.png', alt: 'A screenshot' };
    const values = formValues({ coverMediaId: 'clx1', coverMedia: cover }, FIELDS);

    expect(values.coverMediaId).toBe(cover);
  });

  it('keeps numbers as strings so typing is not fought', () => {
    expect(formValues({ startYear: 2021 }, FIELDS).startYear).toBe('2021');
  });
});

describe('toPayload', () => {
  it('turns an empty number field into null, not zero', () => {
    // `Number('')` is 0. A cleared "end year" posting a plausible zero is the
    // kind of wrong value nothing downstream questions.
    const payload = toPayload({ startYear: '' }, FIELDS);

    expect(payload.startYear).toBe(null);
  });

  it('converts a filled number field', () => {
    expect(toPayload({ startYear: '2021' }, FIELDS).startYear).toBe(2021);
  });

  it('reduces a media row to its id', () => {
    const payload = toPayload({ coverMediaId: { id: 'clx1', url: 'x' } }, FIELDS);

    expect(payload.coverMediaId).toBe('clx1');
  });

  it('sends null for a removed image', () => {
    expect(toPayload({ coverMediaId: null }, FIELDS).coverMediaId).toBe(null);
  });

  it('omits an empty slug rather than posting an empty string', () => {
    // The endpoint derives one from the title when the field is absent — but
    // `slug()` requires a character, so `''` is rejected as "Required." on a
    // field the user deliberately left blank.
    const fields = [
      { name: 'title', label: '', type: 'text' },
      { name: 'slug', label: '', type: 'slug' },
    ];

    const payload = toPayload({ title: 'A project', slug: '' }, fields);

    expect(payload).toEqual({ title: 'A project' });
    expect('slug' in payload).toBe(false);
  });

  it('sends a slug the user actually typed', () => {
    const fields = [{ name: 'slug', label: '', type: 'slug' }];

    expect(toPayload({ slug: 'chosen-by-hand' }, fields)).toEqual({ slug: 'chosen-by-hand' });
  });

  it('only carries the declared fields', () => {
    // Every schema is strict, so a stray key is a 400 rather than a dropped
    // field — which is the right behaviour, and this is what stops the form from
    // producing one.
    const payload = toPayload({ title: 'A', role: 'ADMIN', id: 'clx1' }, [FIELDS[0]]);

    expect(Object.keys(payload)).toEqual(['title']);
  });
});

describe('changedFields', () => {
  it('returns only what differs', () => {
    const before = { title: 'A', description: 'x' };
    const after = { title: 'B', description: 'x' };

    expect(changedFields(before, after)).toEqual({ title: 'B' });
  });

  it('treats null and empty string as the same absence', () => {
    // A nullable column renders as '' and posts as ''. Without this, opening a
    // form and saving it would report every empty field as changed.
    expect(changedFields({ note: null }, { note: '' })).toEqual({});
  });

  it('compares arrays by content', () => {
    expect(changedFields({ stacks: ['a', 'b'] }, { stacks: ['a', 'b'] })).toEqual({});
    expect(changedFields({ stacks: ['a'] }, { stacks: ['a', 'b'] })).toEqual({ stacks: ['a', 'b'] });
  });

  it('notices a reordered array', () => {
    // Order is content for a `String[]` column — the bullets read in sequence.
    expect(changedFields({ stacks: ['a', 'b'] }, { stacks: ['b', 'a'] })).toEqual({
      stacks: ['b', 'a'],
    });
  });

  it('notices a cleared field', () => {
    expect(changedFields({ title: 'A' }, { title: '' })).toEqual({ title: '' });
  });

  it('notices a toggled checkbox in both directions', () => {
    expect(changedFields({ isFeatured: false }, { isFeatured: true })).toEqual({ isFeatured: true });
    expect(changedFields({ isFeatured: true }, { isFeatured: false })).toEqual({ isFeatured: false });
  });

  it('backs hasChanges', () => {
    expect(hasChanges({ a: 1 }, { a: 1 })).toBe(false);
    expect(hasChanges({ a: 1 }, { a: 2 })).toBe(true);
  });
});

describe('validateWith', () => {
  it('accepts a valid body and returns the parsed data', () => {
    const result = validateWith(createSkillSchema, { name: 'TypeScript', category: null });

    expect(result.ok).toBe(true);
    expect(result.data.name).toBe('TypeScript');
  });

  it('maps a rejection onto the field that caused it', () => {
    const result = validateWith(createSkillSchema, { name: '' });

    expect(result.ok).toBe(false);
    expect(result.fields.name).toBeTruthy();
  });

  it('files a cross-field rule under the field it names', () => {
    const result = validateWith(createExperienceSchema, {
      jobPosition: 'Engineer',
      companyName: 'Example',
      startDate: '2025-01-01',
      endDate: '2024-01-01',
      isCurrent: false,
    });

    expect(result.ok).toBe(false);
    expect(result.fields.endDate).toMatch(/earlier/i);
  });

  it('rejects a field the form does not own', () => {
    // Every schema is strict, so smuggling `id` or `status` through a form is an
    // error rather than a silently dropped key.
    const result = validateWith(createSkillSchema, { name: 'Go', id: 'clx1' });

    expect(result.ok).toBe(false);
    expect(result.fields.id).toBeTruthy();
  });
});

describe('what the form produces is what the endpoint accepts', () => {
  /**
   * The integration that matters, and the one mistake it was written to catch.
   *
   * `EntityForm` submits the **raw** body, not Zod's parsed output. The schemas
   * transform on the way in — `calendarDate()` turns `"2025-07-14"` into a `Date`
   * — so posting the parsed value would send an ISO timestamp to an endpoint
   * whose schema wants a calendar day, and be rejected by the same validator that
   * had just passed it.
   */
  it('a new experience built from empty form state validates once filled in', () => {
    const fields = [
      { name: 'jobPosition', label: '', type: 'text' },
      { name: 'companyName', label: '', type: 'text' },
      { name: 'startDate', label: '', type: 'date' },
      { name: 'endDate', label: '', type: 'date' },
      { name: 'isCurrent', label: '', type: 'checkbox' },
      { name: 'responsibilities', label: '', type: 'list' },
    ];

    const values = {
      ...formValues(null, fields),
      jobPosition: 'Software Engineer',
      companyName: 'Example Ltd',
      startDate: '2025-07-14',
      isCurrent: true,
    };

    const result = validateWith(createExperienceSchema, toPayload(values, fields));

    expect(result.fields).toBe(null);
    expect(result.ok).toBe(true);
    // And the transform still happened server-side, on the raw day string.
    expect(result.data.startDate).toBeInstanceOf(Date);
  });

  it('a cross-field rule still applies to a partial update', () => {
    // The same `superRefine` runs against PATCH bodies carrying one field and not
    // the other, so an edit that sets an end date on a role still marked current
    // is caught — by the form, before the request, and by the endpoint after it.
    const result = validateWith(updateExperienceSchema, {
      endDate: '2024-01-01',
      isCurrent: true,
    });

    expect(result.ok).toBe(false);
    expect(result.fields.endDate).toMatch(/current/i);
  });

  it('an unedited record produces an empty PATCH, which the form must not send', () => {
    const fields = [
      { name: 'title', label: '', type: 'text' },
      { name: 'description', label: '', type: 'textarea' },
      { name: 'stacks', label: '', type: 'list' },
      { name: 'repoUrl', label: '', type: 'text' },
    ];

    const record = {
      title: 'Portfolio',
      description: '',
      stacks: ['Next.js'],
      repoUrl: null,
    };

    const values = formValues(record, fields);
    const body = changedFields(toPayload(values, fields), toPayload(values, fields));

    expect(body).toEqual({});
    // An empty PATCH is a 400 by design — it would otherwise write an audit
    // entry claiming an update that did not happen.
    expect(validateWith(updateProjectSchema, body).ok).toBe(false);
  });

  it('a one-field edit produces a one-field PATCH', () => {
    const fields = [
      { name: 'title', label: '', type: 'text' },
      { name: 'description', label: '', type: 'textarea' },
    ];

    const record = { title: 'Portfolio', description: 'Old' };
    const before = toPayload(formValues(record, fields), fields);
    const after = toPayload({ ...formValues(record, fields), description: 'New' }, fields);

    const body = changedFields(before, after);

    expect(body).toEqual({ description: 'New' });
    expect(validateWith(updateProjectSchema, body).ok).toBe(true);
  });

  it('clearing an optional field sends the clearing value, not nothing', () => {
    // The distinction the API cares about: `undefined` means "leave unchanged",
    // so a cleared field that is simply omitted would silently not clear.
    const fields = [{ name: 'category', label: '', type: 'text' }];

    const before = toPayload(formValues({ category: 'Frontend' }, fields), fields);
    const after = toPayload({ category: '' }, fields);

    const body = changedFields(before, after);

    expect(body).toEqual({ category: '' });
    expect(validateWith(updateSkillSchema, body).ok).toBe(true);
    // '' normalises to null on the way to a nullable column.
    expect(validateWith(updateSkillSchema, body).data.category).toBe(null);
  });

  it('a project with an untouched slug field is accepted', () => {
    // The regression: this posted `slug: ''` and was rejected by the same schema
    // that had just validated it in the form.
    const fields = [
      { name: 'title', label: '', type: 'text' },
      { name: 'slug', label: '', type: 'slug' },
      { name: 'description', label: '', type: 'textarea' },
      { name: 'stacks', label: '', type: 'list' },
    ];

    const values = { ...formValues(null, fields), title: 'Verification Project' };
    const result = validateWith(createProjectSchema, toPayload(values, fields));

    expect(result.fields).toBe(null);
    expect(result.ok).toBe(true);
    expect(result.data.slug).toBeUndefined();
  });

  it('an image chosen in the form arrives as an id', () => {
    const fields = [
      { name: 'title', label: '', type: 'text' },
      { name: 'coverMediaId', mediaKey: 'coverMedia', label: '', type: 'image' },
    ];

    const values = {
      title: 'Portfolio',
      coverMediaId: { id: 'ckvj0000000000000000000a', url: 'https://blob.example/a.png' },
    };

    const result = validateWith(createProjectSchema, toPayload(values, fields));

    expect(result.ok).toBe(true);
    expect(result.data.coverMediaId).toBe('ckvj0000000000000000000a');
  });
});

describe('mergeFieldErrors', () => {
  it('lets the server win', () => {
    // Only the server knows about uniqueness and foreign keys, so when both have
    // an opinion, its is the one still true after a retry.
    const merged = mergeFieldErrors({ slug: 'Looks fine' }, { slug: 'Already taken.' });

    expect(merged.slug).toBe('Already taken.');
  });

  it('keeps client errors the server did not mention', () => {
    expect(mergeFieldErrors({ name: 'Required.' }, { slug: 'Taken.' })).toEqual({
      name: 'Required.',
      slug: 'Taken.',
    });
  });

  it('tolerates either side being absent', () => {
    expect(mergeFieldErrors(null, null)).toEqual({});
  });
});
