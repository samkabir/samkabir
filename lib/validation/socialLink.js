import { z } from 'zod';
import { flag, httpUrl, order, publishStatus, requiredText } from './primitives.js';
import { partialOf } from './common.js';

/**
 * `iconKey` is constrained to the icons the frontend actually has components
 * for. An open string would let the dashboard save "twitter", render nothing,
 * and give no clue why. Extending the list is a deliberate two-line change in
 * step with adding the icon.
 */
export const SOCIAL_ICON_KEYS = [
  'linkedin',
  'github',
  'facebook',
  'instagram',
  'twitter',
  'youtube',
  'mail',
  'link',
];

export const createSocialLinkSchema = z.strictObject({
  platform: requiredText(80),
  label: requiredText(120),
  url: httpUrl(),
  iconKey: z.enum(SOCIAL_ICON_KEYS, 'Not an icon this site has a component for.'),
  showInSidebar: flag(true),
  showInContact: flag(true),
  order: order().default(0),
  status: publishStatus().default('PUBLISHED'),
});

export const updateSocialLinkSchema = partialOf(createSocialLinkSchema);
