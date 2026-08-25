import { prisma } from '../prisma.js';
import { requestIp } from '../auth.js';
import { revalidatePublicPages } from '../revalidate.js';
import { listQuery, publishBody, reorderBody } from '../validation/common.js';
import { badRequest, conflict, notFound } from './errors.js';
import { computeDiff, recordAudit } from './audit.js';
import { createHandler, parseBody, parseQuery } from './handler.js';

/**
 * Builds the CRUD surface for one entity.
 *
 * Every entity gets the same five behaviours from the same code, which is the
 * point: list, read, create, update and delete cannot drift apart between
 * entities, and a fix to any of them is a fix everywhere. Entity-specific work —
 * deriving a slug, replacing tag joins, computing a résumé version — goes in a
 * hook rather than a parallel implementation.
 *
 * Each mutation and its audit entry run inside one transaction, so the log
 * cannot claim a change the database did not keep.
 */

/**
 * Fields safe to diff into the audit log.
 *
 * Plain objects are dropped because they are Prisma nested writes
 * (`{ tags: { deleteMany, create } }`) rather than values — recording the
 * instruction instead of the outcome would make the log unreadable. Dates and
 * arrays are values and are kept. A hook that needs a relation change recorded
 * returns it explicitly as `auditExtra`.
 */
function auditableFields(data) {
  const fields = {};

  for (const [key, value] of Object.entries(data)) {
    const isNestedWrite =
      value !== null &&
      typeof value === 'object' &&
      !(value instanceof Date) &&
      !Array.isArray(value);

    if (!isNestedWrite) fields[key] = value;
  }

  return fields;
}

/**
 * Rebuilds the public pages after a mutation that changed published content.
 *
 * Awaited rather than fired and forgotten. On Vercel a serverless function can be
 * frozen the moment it responds, so work started after `res.json()` may simply
 * never run — a fire-and-forget call would work locally and silently do nothing
 * in production, which is the worst of the available failure modes. The cost is
 * one static regeneration's latency on a save, a few hundred milliseconds for a
 * page that is one database transaction.
 *
 * `revalidatePublicPages` never throws, so a revalidation failure cannot turn a
 * committed save into an error response.
 */
async function refreshPublicPages(res) {
  await revalidatePublicPages(res);
}

export function defineResource(config) {
  const {
    entity,
    delegate,
    schemas,
    searchFields = [],
    orderBy = [{ createdAt: 'desc' }],
    include,
    orderable = false,
    publishable = false,
    prepareCreate,
    prepareUpdate,
    beforeDelete,
    afterDelete,
    onPublish,
  } = config;

  const model = () => {
    const client = prisma[delegate];
    if (!client) throw new Error(`No Prisma delegate named "${delegate}".`);
    return client;
  };

  /** Loads a row by id or throws 404 — never returns null to a caller. */
  async function loadOr404(id, client = prisma) {
    const record = await client[delegate].findUnique({ where: { id }, include });
    if (!record) throw notFound(`That ${entity.toLowerCase()} no longer exists.`);
    return record;
  }

  function idFromRequest(req) {
    const raw = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    if (!raw || typeof raw !== 'string') throw badRequest('Missing id.');
    return raw;
  }

  async function list(req, res) {
    const query = parseQuery(listQuery, req);

    const where = {
      // Only entities that actually carry a `status` column accept the filter.
      // Tag and Media have no publication state, and passing `status` to them
      // would be a Prisma error rather than an ignored parameter.
      ...(publishable && query.status ? { status: query.status } : {}),
      ...(query.q && searchFields.length
        ? {
            OR: searchFields.map((field) => ({
              [field]: { contains: query.q, mode: 'insensitive' },
            })),
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      model().findMany({ where, orderBy, include, take: query.take, skip: query.skip }),
      model().count({ where }),
    ]);

    res.status(200).json({ items, total, take: query.take, skip: query.skip });
  }

  async function read(req, res) {
    res.status(200).json({ item: await loadOr404(idFromRequest(req)) });
  }

  async function create(req, res) {
    const input = parseBody(schemas.create, req);

    const created = await prisma.$transaction(async (tx) => {
      const prepared = prepareCreate
        ? await prepareCreate({ input, tx, req })
        : { data: input };

      const record = await tx[delegate].create({ data: prepared.data, include });

      await recordAudit(tx, {
        actorId: req.adminUser.id,
        action: 'create',
        entity,
        entityId: record.id,
        diff: computeDiff(null, { ...auditableFields(prepared.data), ...prepared.auditExtra }),
        ip: requestIp(req),
      });

      return record;
    });

    await refreshPublicPages(res);

    res.status(201).json({ item: created });
  }

  async function update(req, res) {
    const id = idFromRequest(req);
    const input = parseBody(schemas.update, req);

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await loadOr404(id, tx);

      const prepared = prepareUpdate
        ? await prepareUpdate({ input, existing, tx, req })
        : { data: input };

      const record = await tx[delegate].update({ where: { id }, data: prepared.data, include });

      await recordAudit(tx, {
        actorId: req.adminUser.id,
        action: 'update',
        entity,
        entityId: id,
        diff: computeDiff(existing, { ...auditableFields(prepared.data), ...prepared.auditExtra }),
        ip: requestIp(req),
      });

      return record;
    });

    await refreshPublicPages(res);

    res.status(200).json({ item: updated });
  }

  async function remove(req, res) {
    const id = idFromRequest(req);

    const deleted = await prisma.$transaction(async (tx) => {
      const existing = await loadOr404(id, tx);

      if (beforeDelete) await beforeDelete({ existing, tx, req });

      await tx[delegate].delete({ where: { id } });

      await recordAudit(tx, {
        actorId: req.adminUser.id,
        action: 'delete',
        entity,
        entityId: id,
        // The whole row, because after this there is nowhere else to read it.
        diff: computeDiff(null, auditableFields(existing)),
        ip: requestIp(req),
      });

      return existing;
    });

    /**
     * Side effects that destroy something outside the database go here, not in
     * `beforeDelete`.
     *
     * The distinction is not stylistic. `beforeDelete` runs while the row still
     * exists, so a foreign key with `ON DELETE RESTRICT` has not been evaluated
     * yet — the database rejects the delete on the next line, the transaction
     * rolls back, and anything `beforeDelete` already destroyed is gone anyway.
     * That is how deleting the file behind a live CV removed the file and kept
     * the row: a reference to nothing, which is exactly the state the ordering
     * was chosen to avoid.
     *
     * Running after the commit means the destructive step only happens once the
     * database has agreed the row could go. A failure here leaves an unreferenced
     * file, which `npm run media:prune` finds and removes.
     *
     * The failure is logged rather than raised: the delete has already succeeded
     * and reporting it as an error would invite a retry against a row that is no
     * longer there.
     */
    if (afterDelete) {
      try {
        await afterDelete({ existing: deleted, req });
      } catch (error) {
        console.error('[api] %s %s deleted, but cleanup failed:', entity, id, error);
      }
    }

    await refreshPublicPages(res);

    res.status(204).end();
  }

  /**
   * Applies a new order to a list of ids in one transaction.
   *
   * Every id is verified to exist first. Without that check a stale id — a row
   * deleted in another tab — would make one `update` throw partway through,
   * rolling back the transaction and leaving the user looking at a list that
   * silently refused to save.
   */
  async function reorder(req, res) {
    const { ids } = parseBody(reorderBody, req);

    const found = await model().findMany({ where: { id: { in: ids } }, select: { id: true } });

    if (found.length !== ids.length) {
      const missing = new Set(ids);
      for (const row of found) missing.delete(row.id);
      throw conflict(
        `${missing.size} of these items no longer exist — refresh and try again.`
      );
    }

    await prisma.$transaction(async (tx) => {
      await Promise.all(
        ids.map((id, index) =>
          tx[delegate].update({ where: { id }, data: { order: index } })
        )
      );

      await recordAudit(tx, {
        actorId: req.adminUser.id,
        action: 'reorder',
        entity,
        entityId: null,
        diff: { order: { from: null, to: ids } },
        ip: requestIp(req),
      });
    });

    await refreshPublicPages(res);

    res.status(200).json({ ok: true, count: ids.length });
  }

  /** Flips publication state. Separate from update so the audit action is honest. */
  async function publish(req, res) {
    const id = idFromRequest(req);
    const { status } = parseBody(publishBody, req);

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await loadOr404(id, tx);
      const extra = onPublish ? await onPublish({ existing, status, tx, req }) : {};
      const data = { status, ...extra };

      const record = await tx[delegate].update({ where: { id }, data, include });

      await recordAudit(tx, {
        actorId: req.adminUser.id,
        action: status === 'PUBLISHED' ? 'publish' : 'unpublish',
        entity,
        entityId: id,
        diff: computeDiff(existing, auditableFields(data)),
        ip: requestIp(req),
      });

      return record;
    });

    await refreshPublicPages(res);

    res.status(200).json({ item: updated });
  }

  return {
    entity,
    /**
     * GET list, POST create — mount at `index.js`.
     *
     * POST is omitted entirely when the entity has no create schema. Media is
     * the case: its rows describe files that already exist at the storage
     * provider, so they are only ever created by the upload route in Phase 5.
     * Leaving POST off means a create attempt gets 405 from the method
     * allowlist, rather than reaching a handler with no schema to validate
     * against.
     */
    collection: createHandler(
      schemas.create ? { GET: list, POST: create } : { GET: list }
    ),
    /** GET, PATCH, DELETE one — mount at `[id].js`. */
    item: createHandler(
      schemas.update
        ? { GET: read, PATCH: update, DELETE: remove }
        : { GET: read, DELETE: remove }
    ),
    /** POST — mount at `reorder.js`. Absent unless the entity is orderable. */
    reorder: orderable ? createHandler({ POST: reorder }) : null,
    /** POST — mount at `[id]/publish.js`. Absent unless the entity is publishable. */
    publish: publishable ? createHandler({ POST: publish }) : null,
  };
}

/**
 * Builds the GET/PUT pair for a single-row table.
 *
 * Profile and SeoSettings hold one row each, identified by the literal id
 * `"singleton"`. Both routes upsert on that id, which is what keeps a second row
 * unreachable through the application — the schema cannot express a CHECK
 * constraint, so this is where the invariant lives.
 */
export function defineSingleton({ entity, delegate, schema, defaults = {}, include }) {
  const SINGLETON_ID = 'singleton';

  async function read(req, res) {
    const item = await prisma[delegate].findUnique({ where: { id: SINGLETON_ID }, include });
    // Null rather than 404: "not configured yet" is a normal state for a fresh
    // install, and the dashboard renders an empty form for it.
    res.status(200).json({ item: item ?? null });
  }

  async function write(req, res) {
    const input = parseBody(schema, req);

    const saved = await prisma.$transaction(async (tx) => {
      const existing = await tx[delegate].findUnique({ where: { id: SINGLETON_ID } });

      const record = await tx[delegate].upsert({
        where: { id: SINGLETON_ID },
        create: { id: SINGLETON_ID, ...defaults, ...input },
        update: input,
        include,
      });

      await recordAudit(tx, {
        actorId: req.adminUser.id,
        action: existing ? 'update' : 'create',
        entity,
        entityId: SINGLETON_ID,
        diff: computeDiff(existing, auditableFields(input)),
        ip: requestIp(req),
      });

      return record;
    });

    await refreshPublicPages(res);

    res.status(200).json({ item: saved });
  }

  return { entity, handler: createHandler({ GET: read, PUT: write }) };
}
