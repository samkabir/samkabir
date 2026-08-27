import { z } from 'zod';
import { requiredText, slug } from './primitives.js';
import { partialOf } from './common.js';

export const createTagSchema = z.strictObject({
  name: requiredText(60),
  slug: slug().optional(),
});

export const updateTagSchema = partialOf(createTagSchema);
