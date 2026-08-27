import { defineSingleton } from '../resource.js';
import { profileSchema } from '../../validation/profile.js';

export const profileResource = defineSingleton({
  entity: 'Profile',
  delegate: 'profile',
  schema: profileSchema,
  include: { avatarMedia: true },
});
