import { describe, expect, it } from 'vitest';

import {
  describeAuditEntry,
  formatBytes,
  formatDateTime,
  formatDay,
  formatMonth,
  formatTimeline,
  formatYearRange,
} from '@/lib/adminFormat';

/**
 * Display formatting.
 *
 * Fixed formats rather than `toLocaleString`, and these tests are part of why:
 * a locale-dependent format renders differently on the server and in the
 * browser — a different default locale, or a different timezone — and Next then
 * reports a hydration mismatch on a date that was only ever decoration. A test
 * that asserted "whatever this machine renders" would pass everywhere and prove
 * nothing.
 */
describe('dates', () => {
  it('reads a month in UTC', () => {
    // `@db.Date` values are stored at UTC noon precisely so that a client in any
    // timezone reads back the same calendar day. Formatting in local time would
    // undo that for anyone west of UTC.
    expect(formatMonth('2025-07-14T12:00:00.000Z')).toBe('July 2025');
  });

  it('renders a calendar day', () => {
    expect(formatDay('2025-07-14T12:00:00.000Z')).toBe('2025-07-14');
  });

  it('renders a timestamp to the minute', () => {
    expect(formatDateTime('2026-08-25T09:30:45.000Z')).toBe('2026-08-25 09:30');
  });

  it('renders nothing for nothing, rather than "Invalid Date"', () => {
    expect(formatMonth(null)).toBe('');
    expect(formatDay(undefined)).toBe('');
    expect(formatDateTime('not a date')).toBe('');
  });

  it('accepts a Date as readily as a string', () => {
    expect(formatMonth(new Date('2025-07-14T12:00:00.000Z'))).toBe('July 2025');
  });
});

describe('formatTimeline', () => {
  it('renders a closed range', () => {
    expect(
      formatTimeline({ startDate: '2023-01-10T12:00:00Z', endDate: '2024-06-02T12:00:00Z' })
    ).toBe('January 2023 – June 2024');
  });

  it('renders a current role as ending in Present', () => {
    expect(formatTimeline({ startDate: '2025-07-14T12:00:00Z', isCurrent: true })).toBe(
      'July 2025 – Present'
    );
  });

  it('lets the override win', () => {
    // Which is the entire reason the column exists.
    expect(
      formatTimeline({ startDate: '2025-07-14T12:00:00Z', isCurrent: true, timelineOverride: '2025 – now' })
    ).toBe('2025 – now');
  });

  it('shows the start alone when there is no end and no current flag', () => {
    expect(formatTimeline({ startDate: '2025-07-14T12:00:00Z' })).toBe('July 2025');
  });
});

describe('formatYearRange', () => {
  it('joins two years', () => {
    expect(formatYearRange(2018, 2022)).toBe('2018 – 2022');
  });

  it('shows whichever one exists', () => {
    expect(formatYearRange(2018, null)).toBe('2018');
    expect(formatYearRange(null, 2022)).toBe('2022');
  });

  it('shows nothing when neither does', () => {
    expect(formatYearRange(null, null)).toBe('');
  });
});

describe('formatBytes', () => {
  it('uses the units the upload limit is expressed in', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(4 * 1024 * 1024)).toBe('4.0 MB');
  });

  it('renders nothing for a missing size', () => {
    expect(formatBytes(undefined)).toBe('');
  });
});

describe('describeAuditEntry', () => {
  it('names the fields an edit touched', () => {
    expect(
      describeAuditEntry({ action: 'update', entity: 'Project', diff: { title: {}, slug: {} } })
    ).toBe('edited Project — title, slug');
  });

  it('summarises a wide edit rather than listing everything', () => {
    // A Markdown body change would otherwise fill the Overview feed.
    const diff = Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map((key) => [key, {}]));

    expect(describeAuditEntry({ action: 'update', entity: 'BlogPost', diff })).toBe(
      'edited BlogPost — a, b, c and 2 more'
    );
  });

  it('reads a publish as a publish', () => {
    expect(describeAuditEntry({ action: 'publish', entity: 'Skill' })).toBe('published Skill');
    expect(describeAuditEntry({ action: 'unpublish', entity: 'Skill' })).toBe('unpublished Skill');
  });

  it('does not try to name fields for a reorder', () => {
    // Its diff is the whole id list, which is not readable as a field name.
    expect(
      describeAuditEntry({ action: 'reorder', entity: 'Skill', diff: { order: { to: ['a', 'b'] } } })
    ).toBe('reordered Skill');
  });

  it('reads a sign-in without an entity', () => {
    expect(describeAuditEntry({ action: 'login', entity: 'AdminUser' })).toBe('signed in');
    expect(describeAuditEntry({ action: 'login_failed', entity: 'AdminUser' })).toBe(
      'failed to sign in'
    );
  });

  it('falls back rather than rendering "undefined"', () => {
    expect(describeAuditEntry({})).toBe('changed record');
    expect(describeAuditEntry(null)).toBe('changed record');
  });
});
