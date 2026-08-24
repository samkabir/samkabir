import { defineResource } from '../resource.js';
import { createResumeSchema, updateResumeSchema } from '../../validation/resume.js';
import { badRequest, conflict, notFound } from '../errors.js';
import { createHandler } from '../handler.js';
import { recordAudit } from '../audit.js';
import { requestIp } from '../../auth.js';
import { prisma } from '../../prisma.js';

export const resumeResource = defineResource({
  entity: 'Resume',
  delegate: 'resume',
  schemas: { create: createResumeSchema, update: updateResumeSchema },
  searchFields: ['label'],
  orderBy: [{ version: 'desc' }],
  include: { media: true },

  /**
   * Version is assigned here, as `max(version) + 1`, rather than accepted from
   * the form. Two uploads cannot then claim the same number, and the user never
   * has to know what the last version was.
   *
   * Read inside the transaction, so the read and the insert cannot interleave
   * with another upload.
   */
  prepareCreate: async ({ input, tx }) => {
    const media = await tx.media.findUnique({
      where: { id: input.mediaId },
      select: { id: true },
    });

    if (!media) {
      throw badRequest('That uploaded file no longer exists.', {
        mediaId: 'Upload the file again.',
      });
    }

    const latest = await tx.resume.findFirst({
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    return {
      data: {
        ...input,
        version: (latest?.version ?? 0) + 1,
        // A new upload is never live until explicitly activated. Replacing a CV
        // is a deliberate act, and a bad upload should not become the public
        // download the moment it finishes.
        isActive: false,
      },
    };
  },

  /**
   * The active CV cannot be deleted.
   *
   * Deleting it would leave the public download route with nothing to serve, and
   * the fix — activate another version first — is one click. Better to say so
   * than to let the site break and be told about it later.
   */
  beforeDelete: async ({ existing }) => {
    if (existing.isActive) {
      throw conflict(
        'This is the CV currently on the site. Activate a different version before deleting it.'
      );
    }
  },
});

/**
 * `POST /api/admin/resumes/[id]/activate` — makes one version the live CV.
 *
 * Activation is its own endpoint rather than a field on the update form because
 * it is not a property of one row: exactly one résumé is active, so activating
 * this one necessarily deactivates the others. Both writes happen in a single
 * transaction — a partial apply would leave either two active CVs or none, and
 * the public download route has to pick exactly one.
 */
export const activateResumeHandler = createHandler({
  POST: async (req, res) => {
    const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    if (!id) throw badRequest('Missing id.');

    const item = await prisma.$transaction(async (tx) => {
      const target = await tx.resume.findUnique({ where: { id } });
      if (!target) throw notFound('That CV version no longer exists.');

      await tx.resume.updateMany({
        where: { isActive: true, id: { not: id } },
        data: { isActive: false },
      });

      const activated = await tx.resume.update({
        where: { id },
        data: { isActive: true },
        include: { media: true },
      });

      await recordAudit(tx, {
        actorId: req.adminUser.id,
        action: 'publish',
        entity: 'Resume',
        entityId: id,
        diff: { isActive: { from: target.isActive, to: true } },
        ip: requestIp(req),
      });

      return activated;
    });

    res.status(200).json({ item });
  },
});
