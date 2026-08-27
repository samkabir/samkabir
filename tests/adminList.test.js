import { describe, expect, it } from 'vitest';

import { addItem, idsOf, moveItem, nextOrder, orderBy, removeItem, replaceItem } from '@/lib/adminList';

/**
 * List surgery for optimistic updates.
 *
 * The property every one of these has to hold is **no mutation**. The screen
 * applies a change locally, sends the request, and restores the previous array if
 * it fails — so the "previous array" is the same object these functions are
 * handed. A splice in place would corrupt the snapshot being kept for exactly
 * that purpose, and the corruption is invisible until a request fails, which is
 * the moment the user most needs the screen to be right.
 */
const ITEMS = [
  { id: 'a', order: 0 },
  { id: 'b', order: 1 },
  { id: 'c', order: 2 },
];

describe('moveItem', () => {
  it('moves an entry down', () => {
    expect(idsOf(moveItem(ITEMS, 0, 2))).toEqual(['b', 'c', 'a']);
  });

  it('moves an entry up', () => {
    expect(idsOf(moveItem(ITEMS, 2, 0))).toEqual(['c', 'a', 'b']);
  });

  it('swaps neighbours', () => {
    expect(idsOf(moveItem(ITEMS, 0, 1))).toEqual(['b', 'a', 'c']);
  });

  it('does nothing when the target is the current position', () => {
    expect(moveItem(ITEMS, 1, 1)).toBe(ITEMS);
  });

  it('refuses an out-of-range move rather than producing holes', () => {
    // Reachable from the keyboard: pressing ↑ on the first row. Returning the
    // list unchanged is what makes the button a no-op instead of a corruption.
    expect(moveItem(ITEMS, 0, -1)).toBe(ITEMS);
    expect(moveItem(ITEMS, 2, 3)).toBe(ITEMS);
    expect(moveItem(ITEMS, 9, 0)).toBe(ITEMS);
  });

  it('does not mutate the array it was given', () => {
    const original = [...ITEMS];
    moveItem(ITEMS, 0, 2);

    expect(ITEMS).toEqual(original);
  });
});

describe('orderBy', () => {
  it('reorders to match a sequence of ids', () => {
    expect(idsOf(orderBy(ITEMS, ['c', 'a', 'b']))).toEqual(['c', 'a', 'b']);
  });

  it('drops an id the list does not hold', () => {
    // A row deleted in another tab. The reorder endpoint rejects the whole batch
    // in that case, so the local list must not invent an entry for it.
    expect(idsOf(orderBy(ITEMS, ['a', 'gone', 'b']))).toEqual(['a', 'b']);
  });

  it('does not mutate', () => {
    const original = [...ITEMS];
    orderBy(ITEMS, ['c', 'b', 'a']);

    expect(ITEMS).toEqual(original);
  });
});

describe('replaceItem', () => {
  it('swaps the entry with the same id', () => {
    const next = replaceItem(ITEMS, { id: 'b', order: 99 });

    expect(next[1]).toEqual({ id: 'b', order: 99 });
    expect(next).toHaveLength(3);
  });

  it('keeps the position rather than moving the row to the end', () => {
    // The server's response replaces the local row after every mutation. If that
    // moved the row, every save would visibly reshuffle the list.
    expect(idsOf(replaceItem(ITEMS, { id: 'a', order: 5 }))).toEqual(['a', 'b', 'c']);
  });

  it('leaves the list alone when the id is unknown', () => {
    expect(replaceItem(ITEMS, { id: 'zzz' })).toEqual(ITEMS);
  });
});

describe('removeItem', () => {
  it('drops the entry', () => {
    expect(idsOf(removeItem(ITEMS, 'b'))).toEqual(['a', 'c']);
  });

  it('does not mutate', () => {
    const original = [...ITEMS];
    removeItem(ITEMS, 'b');

    expect(ITEMS).toEqual(original);
  });
});

describe('addItem', () => {
  it('appends by default, where an ordered list expects a new row', () => {
    expect(idsOf(addItem(ITEMS, { id: 'd' }))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('prepends for a newest-first list', () => {
    // Blog posts and résumé versions, which are ordered by date and version.
    expect(idsOf(addItem(ITEMS, { id: 'd' }, { position: 'start' }))).toEqual([
      'd', 'a', 'b', 'c',
    ]);
  });
});

describe('nextOrder', () => {
  it('is one past the highest in use', () => {
    expect(nextOrder(ITEMS)).toBe(3);
  });

  it('is not the length', () => {
    // A list with a deleted row in the middle has fewer items than its highest
    // order. Using the length would reuse a number already taken and drop the
    // new row into an arbitrary place among the ties.
    expect(nextOrder([{ id: 'a', order: 0 }, { id: 'c', order: 7 }])).toBe(8);
  });

  it('starts at zero for an empty list', () => {
    expect(nextOrder([])).toBe(0);
  });

  it('ignores rows with no order at all', () => {
    expect(nextOrder([{ id: 'a' }, { id: 'b', order: 2 }])).toBe(3);
  });
});
