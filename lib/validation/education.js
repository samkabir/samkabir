import { z } from 'zod';
import { optionalText, order, publishStatus, requiredText, year } from './primitives.js';
import { partialOf } from './common.js';

const base = z.strictObject({
  institution: requiredText(200),
  degree: optionalText(200),
  field: optionalText(200),
  note: optionalText(500),
  startYear: year(),
  endYear: year(),
  order: order().default(0),
  status: publishStatus().default('PUBLISHED'),
});

/**
 * A graduation year before the start year is the one mistake worth catching
 * here: both fields are optional and independently valid, so nothing else in the
 * stack would notice.
 */
const chronology = (value, ctx) => {
  if (value.startYear != null && value.endYear != null && value.endYear < value.startYear) {
    ctx.addIssue({
      code: 'custom',
      path: ['endYear'],
      message: 'Cannot be earlier than the start year.',
    });
  }
};

export const createEducationSchema = base.superRefine(chronology);
export const updateEducationSchema = partialOf(base).superRefine(chronology);
