import { z } from 'zod';
import { optionalText, order, publishStatus, requiredText } from './primitives.js';
import { partialOf } from './common.js';

export const createSkillSchema = z.strictObject({
  name: requiredText(80),
  category: optionalText(80),
  order: order().default(0),
  status: publishStatus().default('PUBLISHED'),
});

export const updateSkillSchema = partialOf(createSkillSchema);
