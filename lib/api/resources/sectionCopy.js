import { defineResource } from '../resource.js';
import {
  createSectionCopySchema,
  updateSectionCopySchema,
} from '../../validation/sectionCopy.js';

export const sectionCopyResource = defineResource({
  entity: 'SectionCopy',
  delegate: 'sectionCopy',
  schemas: { create: createSectionCopySchema, update: updateSectionCopySchema },
  searchFields: ['heading', 'navLabel'],
  orderBy: [{ order: 'asc' }],
  orderable: true,
  publishable: true,
});
