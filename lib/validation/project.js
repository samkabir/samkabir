import { z } from 'zod';
import {
  MAX,
  flag,
  id,
  optionalHttpUrl,
  order,
  textOrEmpty,
  publishStatus,
  requiredText,
  slug,
  stringList,
} from './primitives.js';
import { partialOf } from './common.js';

/**
 * `slug` is optional on create and derived from the title when omitted — the
 * dashboard should not make you invent a URL for every project. It stays
 * editable, because a slug that is already public must be changeable
 * deliberately rather than silently rewritten every time the title is edited.
 */
export const createProjectSchema = z.strictObject({
  title: requiredText(200),
  slug: slug().optional(),
  description: textOrEmpty(MAX.prose),
  repoUrl: optionalHttpUrl(),
  liveUrl: optionalHttpUrl(),
  stacks: stringList({ max: 30, itemMax: 80 }),
  isNda: flag(false),
  isFeatured: flag(false),
  coverMediaId: id().nullish().transform((value) => value ?? null),
  order: order().default(0),
  status: publishStatus().default('PUBLISHED'),
});

export const updateProjectSchema = partialOf(createProjectSchema);
