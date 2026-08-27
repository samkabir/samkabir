import { defineResource } from '../resource.js';
import { createProjectSchema, updateProjectSchema } from '../../validation/project.js';
import { resolveSlug } from '../slugs.js';

export const projectResource = defineResource({
  entity: 'Project',
  delegate: 'project',
  schemas: { create: createProjectSchema, update: updateProjectSchema },
  searchFields: ['title', 'description', 'slug'],
  orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
  include: { coverMedia: true },
  orderable: true,
  publishable: true,

  prepareCreate: async ({ input, tx }) => ({
    data: {
      ...input,
      slug: await resolveSlug({
        tx,
        delegate: 'project',
        requested: input.slug,
        source: input.title,
      }),
    },
  }),

  /**
   * A slug is only recomputed when the request actually sends one. Renaming a
   * project must not silently change a URL that is already public and possibly
   * linked from elsewhere.
   */
  prepareUpdate: async ({ input, existing, tx }) => {
    if (!input.slug) return { data: input };

    return {
      data: {
        ...input,
        slug: await resolveSlug({
          tx,
          delegate: 'project',
          requested: input.slug,
          source: input.title ?? existing.title,
          currentId: existing.id,
        }),
      },
    };
  },
});
