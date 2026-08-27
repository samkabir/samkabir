import { z } from 'zod';
import {
  MAX,
  email,
  flag,
  id,
  optionalEmail,
  optionalHttpUrl,
  optionalText,
  requiredText,
} from './primitives.js';
import { partialOf } from './common.js';

/**
 * The identity block currently hardcoded across MainComponent, AboutMe, Contact,
 * SocialMediaLinks and Footer.
 *
 * `publicEmail` is what visitors see and what the mailto: links use;
 * `contactEmail` is where a form would deliver if that differs. Phase 1 fixed a
 * live bug where the site displayed one address and linked another — two fields
 * make that divergence something you choose rather than something that happens.
 */
export const profileSchema = z.strictObject({
  greeting: requiredText(80),
  fullName: requiredText(120),
  headline: requiredText(200),
  bio: z.string().trim().min(1, 'Required.').max(MAX.prose),

  publicEmail: email(),
  contactEmail: optionalEmail(),

  leetcodeUsername: optionalText(80),
  showLeetcode: flag(true),

  footerCredit: requiredText(200),
  attributionLabel: optionalText(120),
  attributionUrl: optionalHttpUrl(),

  avatarMediaId: id().nullish().transform((value) => value ?? null),
});

export const updateProfileSchema = partialOf(profileSchema);
