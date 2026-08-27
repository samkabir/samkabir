import { defineResource } from '../resource.js';
import { createTagSchema, updateTagSchema } from '../../validation/tag.js';
import { resolveSlug } from '../slugs.js';

export const tagResource = defineResource({
  entity: 'Tag',
  delegate: 'tag',
  schemas: { create: createTagSchema, update: updateTagSchema },
  searchFields: ['name', 'slug'],
  orderBy: [{ name: 'asc' }],
  include: { _count: { select: { posts: true } } },

  prepareCreate: async ({ input, tx }) => ({
    data: {
      ...input,
      slug: await resolveSlug({ tx, delegate: 'tag', requested: input.slug, source: input.name }),
    },
  }),

  prepareUpdate: async ({ input, existing, tx }) => {
    if (!input.slug) return { data: input };

    return {
      data: {
        ...input,
        slug: await resolveSlug({
          tx,
          delegate: 'tag',
          requested: input.slug,
          source: input.name ?? existing.name,
          currentId: existing.id,
        }),
      },
    };
  },
});
