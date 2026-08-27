import { z } from 'zod';
import { prisma } from '../../prisma.js';
import { createHandler, parseQuery } from '../handler.js';

/**
 * `GET /api/admin/audit` — the recent activity feed for the Overview screen.
 *
 * Read-only, and there is no write, update or delete endpoint anywhere: the log
 * is append-only, and an audit trail an admin can edit is not an audit trail.
 * Rows are written only by `recordAudit`, inside the transaction that made the
 * change being described.
 */
const auditQuery = z.object({
  entity: z.string().trim().max(60).optional(),
  entityId: z.string().trim().max(60).optional(),
  action: z.string().trim().max(40).optional(),
  take: z.coerce.number().int().min(1).max(200).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

export const auditHandler = createHandler({
  GET: async (req, res) => {
    const query = parseQuery(auditQuery, req);

    const where = {
      ...(query.entity ? { entity: query.entity } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.action ? { action: query.action } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.take,
        skip: query.skip,
        // Explicit select: the actor relation would otherwise carry
        // passwordHash into a response the dashboard renders as a list.
        include: { actor: { select: { id: true, name: true, email: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.status(200).json({ items, total, take: query.take, skip: query.skip });
  },
});
