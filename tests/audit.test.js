import { describe, expect, it } from 'vitest';
import { computeDiff } from '@/lib/api/audit';

describe('computeDiff', () => {
  it('records only the fields that changed', () => {
    const diff = computeDiff(
      { name: 'Go', category: 'Backend', order: 0 },
      { name: 'Golang', category: 'Backend' }
    );

    expect(diff).toEqual({ name: { from: 'Go', to: 'Golang' } });
  });

  it('returns null when nothing changed', () => {
    expect(computeDiff({ name: 'Go' }, { name: 'Go' })).toBe(null);
  });

  it('treats a create as every field being new', () => {
    expect(computeDiff(null, { name: 'Go', order: 0 })).toEqual({
      name: { from: null, to: 'Go' },
      order: { from: null, to: 0 },
    });
  });

  it('ignores the timestamp columns', () => {
    const diff = computeDiff(
      { name: 'Go', updatedAt: new Date('2024-01-01') },
      { name: 'Go', updatedAt: new Date('2025-01-01') }
    );

    // updatedAt changes on every single write and says nothing about what the
    // user did, so recording it would bury the useful line in every entry.
    expect(diff).toBe(null);
  });

  it('compares dates by value, not by identity', () => {
    const before = { startDate: new Date('2025-07-01T12:00:00.000Z') };
    const after = { startDate: new Date('2025-07-01T12:00:00.000Z') };

    expect(computeDiff(before, after)).toBe(null);
  });

  it('serialises dates as ISO strings', () => {
    const diff = computeDiff(
      { startDate: new Date('2024-01-01T12:00:00.000Z') },
      { startDate: new Date('2025-07-01T12:00:00.000Z') }
    );

    expect(diff.startDate.to).toBe('2025-07-01T12:00:00.000Z');
  });

  it('compares string arrays element by element', () => {
    expect(computeDiff({ stacks: ['a', 'b'] }, { stacks: ['a', 'b'] })).toBe(null);
    expect(computeDiff({ stacks: ['a'] }, { stacks: ['a', 'b'] })).not.toBe(null);
  });

  it('distinguishes null from an empty string', () => {
    expect(computeDiff({ location: null }, { location: '' })).toEqual({
      location: { from: null, to: '' },
    });
  });

  it('truncates a long value rather than storing the whole thing', () => {
    const diff = computeDiff({ contentMarkdown: 'old' }, { contentMarkdown: 'x'.repeat(5000) });

    expect(diff.contentMarkdown.to.length).toBeLessThan(600);
    expect(diff.contentMarkdown.to).toContain('5000 characters');
  });
});

/**
 * The audit table is the thing you read when something is broken, so it is
 * exactly the wrong place for a credential to be sitting in plain sight.
 */
describe('computeDiff redaction', () => {
  it('never stores a password hash, in any casing or spelling', () => {
    for (const field of ['passwordHash', 'password_hash', 'PasswordHash', 'password']) {
      const diff = computeDiff({ [field]: 'old-secret' }, { [field]: 'new-secret' });

      expect(JSON.stringify(diff)).not.toContain('secret');
      expect(diff[field]).toEqual({ from: '[redacted]', to: '[redacted]' });
    }
  });

  it('still records that a secret changed', () => {
    // "The password was changed at 14:03" is precisely the kind of thing the log
    // exists to tell you. Omitting the field entirely would lose that.
    const diff = computeDiff({ passwordHash: 'a' }, { passwordHash: 'b' });
    expect(diff).toHaveProperty('passwordHash');
  });

  it('redacts tokens and api keys too', () => {
    for (const field of ['accessToken', 'refreshToken', 'apiKey', 'secret']) {
      const diff = computeDiff({ [field]: 'aaa' }, { [field]: 'bbb' });
      expect(JSON.stringify(diff)).not.toContain('bbb');
    }
  });
});
