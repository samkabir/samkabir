import { defineSingleton } from '../resource.js';
import { seoSettingsSchema } from '../../validation/seo.js';

export const seoResource = defineSingleton({
  entity: 'SeoSettings',
  delegate: 'seoSettings',
  schema: seoSettingsSchema,
  include: { ogImageMedia: true },
});
