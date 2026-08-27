import { defineResource } from '../resource.js';
import { createEducationSchema, updateEducationSchema } from '../../validation/education.js';

export const educationResource = defineResource({
  entity: 'Education',
  delegate: 'education',
  schemas: { create: createEducationSchema, update: updateEducationSchema },
  searchFields: ['institution', 'degree', 'field'],
  // Most recent first within the manual order, which is how a CV reads.
  orderBy: [{ order: 'asc' }, { endYear: 'desc' }],
  orderable: true,
  publishable: true,
});
