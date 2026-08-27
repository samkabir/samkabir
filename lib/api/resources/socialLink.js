import { defineResource } from '../resource.js';
import { createSocialLinkSchema, updateSocialLinkSchema } from '../../validation/socialLink.js';

export const socialLinkResource = defineResource({
  entity: 'SocialLink',
  delegate: 'socialLink',
  schemas: { create: createSocialLinkSchema, update: updateSocialLinkSchema },
  searchFields: ['platform', 'label'],
  orderBy: [{ order: 'asc' }, { platform: 'asc' }],
  orderable: true,
  publishable: true,
});
