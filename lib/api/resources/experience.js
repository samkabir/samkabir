import { defineResource } from '../resource.js';
import { createExperienceSchema, updateExperienceSchema } from '../../validation/experience.js';

/**
 * `startDate desc` is the secondary sort, so a newly added role lands in a
 * sensible place before anyone drags anything. The old static file kept its own
 * order by hand-editing ids, which is what made two entries share `id: 1`.
 */
export const experienceResource = defineResource({
  entity: 'Experience',
  delegate: 'experience',
  schemas: { create: createExperienceSchema, update: updateExperienceSchema },
  searchFields: ['jobPosition', 'companyName', 'location'],
  orderBy: [{ order: 'asc' }, { startDate: 'desc' }],
  orderable: true,
  publishable: true,
});
