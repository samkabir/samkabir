import { z } from 'zod';
import { id, requiredText } from './primitives.js';
import { partialOf } from './common.js';

/**
 * `version` and `isActive` are absent by design. Version is assigned by the
 * server as `max(version) + 1`, so two uploads cannot claim the same number, and
 * activation goes through `POST /api/admin/resumes/[id]/activate`, which
 * deactivates the others in the same transaction. Letting a form post
 * `isActive: true` would allow two active CVs, and the public download route has
 * to pick exactly one.
 */
export const createResumeSchema = z.strictObject({
  label: requiredText(120),
  mediaId: id(),
});

export const updateResumeSchema = partialOf(createResumeSchema.omit({ mediaId: true }));
