import { z } from 'zod';
import { id, optionalHttpUrl, optionalText, requiredText } from './primitives.js';
import { partialOf } from './common.js';

export const seoSettingsSchema = z.strictObject({
  siteTitle: requiredText(120),
  defaultDescription: requiredText(300),
  canonicalUrl: optionalHttpUrl(),

  /**
   * Stored without the leading "@" so every consumer can add it back once,
   * rather than each render site guessing whether it is already there.
   */
  twitterHandle: optionalText(40).transform((value) =>
    value ? value.replace(/^@+/, '') : value
  ),

  ogImageMediaId: id().nullish().transform((value) => value ?? null),
});

export const updateSeoSettingsSchema = partialOf(seoSettingsSchema);
