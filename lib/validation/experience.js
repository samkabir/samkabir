import { z } from 'zod';
import {
  calendarDate,
  experienceKind,
  flag,
  optionalCalendarDate,
  optionalText,
  order,
  publishStatus,
  requiredText,
  stringList,
} from './primitives.js';
import { partialOf } from './common.js';

const base = z.strictObject({
  kind: experienceKind().default('FULL_TIME'),
  jobPosition: requiredText(200),
  companyName: requiredText(200),
  isNda: flag(false),
  location: optionalText(200),
  startDate: calendarDate(),
  endDate: optionalCalendarDate(),
  isCurrent: flag(false),
  timelineOverride: optionalText(200),
  responsibilities: stringList({ max: 30 }),
  order: order().default(0),
  status: publishStatus().default('PUBLISHED'),
});

/**
 * Two cross-field rules the column types cannot express.
 *
 * Both are checked only when the fields involved are actually present, because
 * the same function runs against PATCH bodies that carry one field and not the
 * other. A PATCH that sets `endDate` on a role still marked current is caught;
 * a PATCH that touches neither is not second-guessed.
 */
const dateRules = (value, ctx) => {
  const { startDate, endDate, isCurrent } = value;

  if (startDate && endDate && endDate < startDate) {
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: 'Cannot be earlier than the start date.',
    });
  }

  if (isCurrent === true && endDate) {
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: 'Leave the end date empty for a current role, or untick "current".',
    });
  }

  if (isCurrent === false && endDate === null && 'endDate' in value) {
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: 'Give an end date, or tick "current".',
    });
  }
};

export const createExperienceSchema = base.superRefine(dateRules);
export const updateExperienceSchema = partialOf(base).superRefine(dateRules);
