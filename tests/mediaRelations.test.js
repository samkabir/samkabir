import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { MEDIA_RELATIONS } from '@/lib/mediaRelations';

/**
 * Keeps the prune script's notion of "in use" aligned with the schema.
 *
 * `npm run media:prune` decides a file is unreferenced by checking a hand-written
 * list of relations. If a relation is added to the `Media` model and not added to
 * that list, the script will report files reachable through it as orphans and —
 * with `--apply` — delete them. There is no error and no warning; the file is
 * simply gone, and the record pointing at it renders a broken image.
 *
 * So the list is checked against `schema.prisma` here rather than trusted. This
 * is the same technique as `tests/schemaAlignment.test.js`: read the schema, and
 * assert the property that would otherwise only fail in production.
 */
const SCHEMA = readFileSync(
  path.join(import.meta.dirname, '..', 'prisma', 'schema.prisma'),
  'utf8'
);

/** Reverse-relation fields on the `Media` model — the `Foo[]` lines. */
function mediaListRelations() {
  const block = SCHEMA.match(/^model Media \{([\s\S]*?)^\}/m);
  expect(block, 'no Media model found in schema.prisma').toBeTruthy();

  const relations = [];

  for (const line of block[1].split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) continue;

    // `blogCovers    BlogPost[]  @relation("BlogPostCover")`
    const match = trimmed.match(/^(\w+)\s+([A-Z]\w*)\[\]/);
    if (match) relations.push(match[1]);
  }

  return relations;
}

describe('media reference list', () => {
  it('reads the schema rather than silently matching nothing', () => {
    // Guards the parser: a regex that stopped matching would make the assertion
    // below vacuously true, which is the failure mode this whole file exists to
    // prevent.
    const found = mediaListRelations();
    expect(found.length).toBeGreaterThan(3);
    expect(found).toContain('resumes');
  });

  it('covers every relation that can hold a Media id', () => {
    const inSchema = mediaListRelations().sort();
    const inList = [...MEDIA_RELATIONS].sort();

    // Set equality both ways. A missing entry means the prune script deletes
    // files that are in use; an extra entry means it queries a relation Prisma
    // does not have, which throws at runtime.
    expect(inList).toEqual(inSchema);
  });

  it('includes the one whose loss would be worst', () => {
    // Deleting the file behind the active CV would break `/cv`, the link that
    // goes on an actual CV. Called out separately so that a future edit to this
    // list has to delete this assertion deliberately.
    expect(MEDIA_RELATIONS).toContain('resumes');
  });

  it('has no duplicates', () => {
    expect(new Set(MEDIA_RELATIONS).size).toBe(MEDIA_RELATIONS.length);
  });
});
