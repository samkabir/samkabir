import { describe, expect, it } from 'vitest';
import { slugify, uniqueSlug } from '@/lib/slug';
import { estimateReadingMinutes } from '@/lib/blog';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('My First Post')).toBe('my-first-post');
  });

  it('transliterates accents rather than dropping them', () => {
    // "caf" would be a worse URL than "cafe" and a silently different one.
    expect(slugify('Café Culture')).toBe('cafe-culture');
  });

  it('removes apostrophes without leaving a hyphen', () => {
    expect(slugify("It ain't much")).toBe('it-aint-much');
  });

  it('collapses runs of punctuation into a single hyphen', () => {
    expect(slugify('Hello --- World!!! (2024)')).toBe('hello-world-2024');
  });

  it('does not leave a leading or trailing hyphen', () => {
    expect(slugify('  ...Hello...  ')).toBe('hello');
  });

  it('returns an empty string when there is nothing usable', () => {
    // The caller turns this into a 400 pointing at the slug field, rather than
    // storing an empty public URL.
    expect(slugify('!!!???')).toBe('');
  });
});

describe('uniqueSlug', () => {
  it('returns the base when it is free', async () => {
    expect(await uniqueSlug('post', async () => false)).toBe('post');
  });

  it('appends the first free numeric suffix', async () => {
    const taken = new Set(['post', 'post-2', 'post-3']);
    expect(await uniqueSlug('post', async (candidate) => taken.has(candidate))).toBe('post-4');
  });

  it('gives up rather than looping forever', async () => {
    // Reaching the cap means `isTaken` is broken, not that 50 posts share a
    // title. Throwing surfaces the bug; spinning would hang the request.
    await expect(uniqueSlug('post', async () => true, { limit: 3 })).rejects.toThrow(/could not find/i);
  });
});

describe('estimateReadingMinutes', () => {
  it('is never zero', () => {
    expect(estimateReadingMinutes('')).toBe(1);
    expect(estimateReadingMinutes('one word')).toBe(1);
  });

  it('scales with word count', () => {
    expect(estimateReadingMinutes('word '.repeat(1000))).toBe(5);
  });

  it('does not count fenced code as prose', () => {
    const withCode = '```js\n' + 'const x = 1;\n'.repeat(400) + '```\n\nShort intro.';
    expect(estimateReadingMinutes(withCode)).toBe(1);
  });

  it('counts link text but not the URL', () => {
    const words = '[the linked words](https://example.com/a/very/long/path/that/is/not/read) '.repeat(50);
    expect(estimateReadingMinutes(words)).toBe(1);
  });
});
