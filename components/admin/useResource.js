import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { api, queryString } from '@/lib/adminClient';
import { addItem, orderBy, removeItem, replaceItem } from '@/lib/adminList';

import { useToast } from './Toast';

/**
 * One collection of records, fetched and mutated.
 *
 * Every list screen uses this, so list, create, update, delete, reorder and
 * publish behave identically everywhere — including the parts that are easy to
 * get subtly wrong in the tenth copy of the same code: aborting a request whose
 * screen has moved on, rolling back an optimistic change, and keeping a stale
 * response from overwriting a newer one.
 *
 * ## Where errors are reported, and why it differs
 *
 * The two kinds of mutation report failure in different places, deliberately:
 *
 *   * **`create` and `update` throw.** They come from a form, and the useful part
 *     of the failure is the `fields` map — "Already taken." belongs against the
 *     slug input, not in a toast at the bottom of the screen. The form catches
 *     and renders it.
 *
 *   * **`patchRow`, `remove`, `publish`, `reorder` and `run` return a boolean and
 *     toast.** They come from a row, and there is no form to render into. They
 *     also roll the list back first, so the screen matches the database again
 *     before the message appears.
 *
 * ## What is optimistic and what is not
 *
 * Deleting, publishing, toggling and reordering are applied locally first: they
 * are single predictable changes, the round trip is visible on a slow connection,
 * and dragging a row that springs back after 200 ms feels broken.
 *
 * Creating is **not**. The server derives fields the client cannot guess — a
 * slug, a résumé version, a reading time — so an optimistic row would appear with
 * the wrong values and then visibly correct itself, and it would need a fake id
 * that could end up in a request. The form shows its own progress instead, which
 * is where the user is already looking.
 */
export function useResource(basePath, { query = {}, position = 'end' } = {}) {
  const { notifyError } = useToast();

  const [reloadToken, setReloadToken] = useState(0);
  const [busyIds, setBusyIds] = useState(() => new Set());

  // Serialised, so an inline object literal in the caller does not retrigger the
  // effect on every render. The reload counter is part of the key so that asking
  // for the same query again is a different request.
  const queryKey = queryString(query);
  const dataKey = `${basePath}${queryKey}#${reloadToken}`;

  // Read out separately because `publish` has to know whether the row it just
  // changed still matches the list it is in.
  const statusFilter = query.status ?? null;

  /**
   * Everything the fetch owns, in one piece of state, stamped with the request it
   * came from.
   *
   * **`loading` is derived from that stamp rather than stored.** The obvious
   * version — `setLoading(true)` at the top of the effect — has a window one
   * render wide where the query has changed and the screen still says it is
   * showing current data, and it makes the effect cascade a render before it does
   * any work. Comparing the stamp to the current key means "is this list for the
   * question being asked" is answered by construction, and the only writes happen
   * when a response arrives.
   */
  const [loaded, setLoaded] = useState({ key: null, items: [], total: 0, error: null });

  const loading = loaded.key !== dataKey;

  /**
   * The list, kept in a ref as well as in state.
   *
   * Not a duplicate for convenience — it is what makes rollback correct. React
   * batches state updates, so inside an async mutation the captured `items` is
   * whatever it was when the callback was created, and a functional updater does
   * not run until render. The ref is written synchronously, so the snapshot taken
   * just before an optimistic change is the real previous list even when two
   * mutations overlap.
   */
  const itemsRef = useRef(loaded.items);

  const commit = useCallback((next) => {
    itemsRef.current = typeof next === 'function' ? next(itemsRef.current) : next;
    const items = itemsRef.current;
    setLoaded((current) => ({ ...current, items }));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    api
      .get(`${basePath}${queryKey}`, { signal: controller.signal })
      .then((body) => {
        if (cancelled) return;
        itemsRef.current = body?.items ?? [];
        setLoaded({ key: dataKey, items: itemsRef.current, total: body?.total ?? 0, error: null });
      })
      .catch((problem) => {
        // An abort is this effect being replaced by a newer one — a keystroke in
        // the search box. Reporting it would flash an error for a request nobody
        // is waiting for any more.
        if (cancelled || problem?.name === 'AbortError') return;
        itemsRef.current = [];
        setLoaded({
          key: dataKey,
          items: [],
          total: 0,
          error: problem.message ?? 'Could not load this list.',
        });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [basePath, queryKey, dataKey]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  const markBusy = useCallback((id, busy) => {
    setBusyIds((current) => {
      const next = new Set(current);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  /**
   * Applies a change locally, sends it, and undoes it if the request fails.
   *
   * Exposed as `run` so a screen can build its own action on the same guarantees
   * — activating a CV version, for instance, which is neither CRUD nor publish
   * but wants the identical optimistic behaviour.
   */
  const optimistic = useCallback(
    async (applyLocally, send, { id = null } = {}) => {
      const snapshot = itemsRef.current;

      commit(applyLocally(snapshot));
      if (id) markBusy(id, true);

      try {
        const result = await send();
        // The server's version of the row wins: it carries the derived fields —
        // `updatedAt`, a recomputed reading time, a re-slugged title.
        if (result?.item) commit((current) => replaceItem(current, result.item));
        return true;
      } catch (problem) {
        commit(snapshot);
        notifyError(problem.message ?? 'That change could not be saved.');
        return false;
      } finally {
        if (id) markBusy(id, false);
      }
    },
    [commit, markBusy, notifyError]
  );

  const create = useCallback(
    async (body) => {
      const result = await api.post(basePath, body);
      itemsRef.current = addItem(itemsRef.current, result.item, { position });
      const items = itemsRef.current;
      setLoaded((current) => ({ ...current, items, total: current.total + 1 }));
      return result.item;
    },
    [basePath, position]
  );

  const update = useCallback(
    async (id, body) => {
      const result = await api.patch(`${basePath}/${id}`, body);
      commit((current) => replaceItem(current, result.item));
      return result.item;
    },
    [basePath, commit]
  );

  /**
   * An optimistic PATCH of a few fields, for a toggle on a row.
   *
   * Distinct from `update`, which is the form's path and throws so field errors
   * can be rendered beside their inputs. A row toggle has no form to render into:
   * it applies immediately, rolls back on failure, and reports through the toast.
   * The local merge is `{ ...item, ...body }` rather than a replacement, because
   * the row on screen carries relations the PATCH body does not mention.
   */
  const patchRow = useCallback(
    (id, body) =>
      optimistic(
        (current) => current.map((item) => (item.id === id ? { ...item, ...body } : item)),
        () => api.patch(`${basePath}/${id}`, body),
        { id }
      ),
    [basePath, optimistic]
  );

  const remove = useCallback(
    (id) =>
      optimistic(
        (current) => removeItem(current, id),
        async () => {
          await api.del(`${basePath}/${id}`);
          setLoaded((current) => ({ ...current, total: Math.max(0, current.total - 1) }));
          // Nothing to merge back: a 204 has no body, and the row is gone.
          return null;
        },
        { id }
      ),
    [basePath, optimistic]
  );

  /**
   * Flips publication state.
   *
   * The reload at the end is not redundant. When the list is filtered to one
   * status, publishing a row means it no longer belongs in the list it is sitting
   * in — leaving it visible shows a draft inside a "Live only" view, which is
   * exactly the kind of quiet inconsistency that makes an admin stop trusting the
   * filter. Refetching is one request and it is correct.
   */
  const publish = useCallback(
    async (id, status) => {
      const ok = await optimistic(
        (current) => current.map((item) => (item.id === id ? { ...item, status } : item)),
        () => api.post(`${basePath}/${id}/publish`, { status }),
        { id }
      );

      if (ok && statusFilter && statusFilter !== status) reload();
      return ok;
    },
    [basePath, optimistic, statusFilter, reload]
  );

  /**
   * Sends the whole list in its new order.
   *
   * One request rather than one per moved row: the endpoint assigns positions
   * `0, 1, 2 …` in a single transaction, so a failure leaves the order exactly as
   * it was instead of half-applied. The rollback then has something consistent to
   * return to.
   */
  const reorder = useCallback(
    (ids) =>
      optimistic(
        (current) => orderBy(current, ids),
        () => api.post(`${basePath}/reorder`, { ids })
      ),
    [basePath, optimistic]
  );

  const isBusy = useCallback((id) => busyIds.has(id), [busyIds]);

  return useMemo(
    () => ({
      items: loaded.items,
      total: loaded.total,
      loading,
      error: loaded.error,
      reload,
      create,
      update,
      patchRow,
      remove,
      publish,
      reorder,
      /** The optimistic wrapper, for actions this hook does not model. */
      run: optimistic,
      /** Replaces one row from outside — after an upload, or a sibling action. */
      applyItem: (item) => commit((current) => replaceItem(current, item)),
      isBusy,
      busy: busyIds.size > 0,
    }),
    [loaded, loading, reload, create, update, patchRow, remove, publish, reorder, optimistic, commit, isBusy, busyIds]
  );
}

/**
 * A single-row table — `/profile` and `/seo`.
 *
 * Deliberately not `useResource` with a list of one. The endpoints are a
 * different shape (`GET` and `PUT`, no collection, no create), the response is
 * `{ item }` rather than `{ items, total }`, and `item: null` is a *normal* state
 * rather than an error: a fresh install has no profile row until the form is
 * saved for the first time. Modelling that as an empty list would make the screen
 * render "nothing here yet" where it should render an empty form.
 *
 * `save` throws rather than toasting, for the same reason `create` does — the
 * caller is a form, and the useful part of a failure is the `fields` map.
 */
export function useSingleton(path) {
  const [reloadToken, setReloadToken] = useState(0);
  const dataKey = `${path}#${reloadToken}`;

  // Same derived-loading arrangement as above, for the same reason.
  const [loaded, setLoaded] = useState({ key: null, item: null, error: null });

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    api
      .get(path, { signal: controller.signal })
      .then((body) => {
        if (!cancelled) setLoaded({ key: dataKey, item: body?.item ?? null, error: null });
      })
      .catch((problem) => {
        if (cancelled || problem?.name === 'AbortError') return;
        setLoaded({ key: dataKey, item: null, error: problem.message ?? 'Could not load this.' });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [path, dataKey]);

  const save = useCallback(
    async (body) => {
      const result = await api.put(path, body);
      setLoaded((current) => ({ ...current, item: result.item, error: null }));
      return result.item;
    },
    [path]
  );

  return {
    item: loaded.item,
    loading: loaded.key !== dataKey,
    error: loaded.error,
    save,
    reload: () => setReloadToken((token) => token + 1),
  };
}

/**
 * A value that lags behind by `delay`, for search boxes.
 *
 * Without it every keystroke is a request: eight for "portfoli" plus the one that
 * matters, each one aborting the last. The abort makes that harmless but not
 * free, and the flicker of the loading state on every letter is worse than the
 * 250 ms wait.
 */
export function useDebouncedValue(value, delay = 250) {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return settled;
}

export default useResource;
