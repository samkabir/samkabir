import { defineResource } from '../resource.js';
import { updateMediaSchema } from '../../validation/media.js';
import { deleteObject } from '../../storage.js';

/**
 * Media rows are listed, described and deleted here — never created.
 *
 * A row exists because a file was uploaded, so
 * `POST /api/admin/media/upload` is its only writer. Passing no create schema
 * means POST is not even registered on this collection and returns 405.
 */
export const mediaResource = defineResource({
  entity: 'Media',
  delegate: 'media',
  schemas: { update: updateMediaSchema },
  searchFields: ['alt', 'pathname', 'mimeType'],
  orderBy: [{ createdAt: 'desc' }],
  include: { uploadedBy: { select: { id: true, name: true, email: true } } },

  /**
   * Removes the stored file **after** the row is gone, not before.
   *
   * The first version of this did it the other way round, reasoning that a row
   * pointing at a missing file is worse than a file with no row — which is true,
   * and led to the wrong conclusion. The protection against deleting the file
   * behind a live CV is `Resume.mediaId`'s `ON DELETE RESTRICT`, and Postgres
   * only evaluates that when the **row** is deleted. Deleting the file first
   * meant: file gone, then the row delete rejected with 409, transaction rolled
   * back, row still present and now referring to nothing. The ordering
   * guaranteed the exact failure it was meant to prevent. A test caught it.
   *
   * With `afterDelete` the database has already agreed the row could go, so the
   * RESTRICT case never reaches this code — it surfaces as a 409 with the file
   * untouched. If this step then fails, the leftover is an unreferenced file,
   * which `npm run media:prune` lists and removes.
   */
  afterDelete: async ({ existing }) => {
    await deleteObject({ pathname: existing.pathname });
  },
});
