import { defineResource } from '../resource.js';
import { createSkillSchema, updateSkillSchema } from '../../validation/skill.js';

export const skillResource = defineResource({
  entity: 'Skill',
  delegate: 'skill',
  schemas: { create: createSkillSchema, update: updateSkillSchema },
  searchFields: ['name', 'category'],
  orderBy: [{ order: 'asc' }, { name: 'asc' }],
  orderable: true,
  publishable: true,
});
