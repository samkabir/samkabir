/**
 * List surgery, as pure functions.
 *
 * Every one of these is used by an optimistic update: the screen applies the
 * change locally, sends the request, and puts the old array back if it fails. So
 * these functions must never mutate their input — the "old array" the rollback
 * restores *is* the input, and a splice in place would corrupt the copy being
 * held for exactly that purpose.
 *
 * That is the reason they live here rather than inline in the components. An
 * accidental mutation is invisible until a request fails, which is the moment the
 * user most needs the screen to be right.
 */

/** Moves one entry to a new index, returning a new array. */
export function moveItem(items, from, to) {
  if (from === to) return items;
  if (from < 0 || from >= items.length) return items;
  if (to < 0 || to >= items.length) return items;

  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Reorders `items` to match a sequence of ids, dropping ids it does not hold. */
export function orderBy(items, ids, getId = (item) => item.id) {
  const byId = new Map(items.map((item) => [getId(item), item]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

/** Replaces the entry with the same id, or returns the list unchanged. */
export function replaceItem(items, updated, getId = (item) => item.id) {
  const id = getId(updated);
  return items.map((item) => (getId(item) === id ? updated : item));
}

export function removeItem(items, id, getId = (item) => item.id) {
  return items.filter((item) => getId(item) !== id);
}

/**
 * Adds a new entry.
 *
 * At the end for an ordered list — a new row belongs where the user can see it
 * was added, and the `order` column decides the real position anyway. At the
 * front for a list sorted newest-first, so the same call site reads correctly for
 * both.
 */
export function addItem(items, created, { position = 'end' } = {}) {
  return position === 'start' ? [created, ...items] : [...items, created];
}

export const idsOf = (items, getId = (item) => item.id) => items.map(getId);

/**
 * The `order` value a new row should get.
 *
 * One past the highest in use, rather than `items.length`: a list with a deleted
 * row in the middle has fewer items than its highest order, and reusing an
 * existing number puts the new row in an arbitrary place among its ties.
 */
export function nextOrder(items) {
  const highest = items.reduce(
    (max, item) => (typeof item.order === 'number' && item.order > max ? item.order : max),
    -1
  );
  return highest + 1;
}
