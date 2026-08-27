import { z } from 'zod';
import { flag, optionalText, order, publishStatus, requiredText } from './primitives.js';
import { partialOf } from './common.js';

/**
 * The `key` is what components look themselves up by, so it is a closed set
 * rather than free text: a typo would make a section silently fall back to
 * nothing. Adding a section is a code change anyway — the component has to
 * exist — so the enum is not a limitation in practice.
 */
export const SECTION_KEYS = ['about', 'skills', 'experience', 'contractual', 'projects', 'contact'];

export const createSectionCopySchema = z.strictObject({
  key: z.enum(SECTION_KEYS, 'Not a section this site renders.'),
  numberLabel: requiredText(10),
  heading: requiredText(200),
  subheading: optionalText(500),
  navLabel: optionalText(80),
  anchor: optionalText(80),
  showInNav: flag(true),
  order: order().default(0),
  status: publishStatus().default('PUBLISHED'),
});

/** `key` is immutable: it is a join point for code, not content. */
export const updateSectionCopySchema = partialOf(createSectionCopySchema.omit({ key: true }));
