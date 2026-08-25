import { Box, Typography } from '@mui/material';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';

import ConfirmDialog from './ConfirmDialog';
import FormField from './FormField';
import ImageField from './ImageField';
import MarkdownEditor from './MarkdownEditor';
import StatusChip from './StatusChip';
import { PanelHeading } from './States';
import { useToast } from './Toast';
import useUnsavedChanges from './useUnsavedChanges';
import { api, ApiError } from '../../lib/adminClient';
import { changedFields, formValues, mergeFieldErrors, toPayload, validateWith } from '../../lib/adminForm';
import { formatDateTime } from '../../lib/adminFormat';
import {
  BANNER_ERROR,
  BUTTON,
  BUTTON_QUIET,
  HINT,
  LINK_DANGER,
  PANEL,
} from '../../lib/adminTheme';
import { createBlogPostSchema, updateBlogPostSchema } from '../../lib/validation/blogPost';

/**
 * The post editor, shared by `/admin/blogs/new` and `/admin/blogs/[id]`.
 *
 * One component for both, because "create" and "edit" differ in three places —
 * which schema validates, whether the body is a full object or a diff, and where
 * to go afterwards — and everything else is identical. Two screens would be two
 * places to add a field to.
 *
 * The Markdown body is deliberately **not** a `FormField`. It needs a preview, a
 * mode switch and a live reading-time estimate, none of which fit the shape
 * `FormField` exists to standardise, and forcing it in would make that component
 * worse for the eleven fields it does handle well.
 */
const META_FIELDS = [
  {
    name: 'title',
    label: 'Title',
    type: 'text',
    required: true,
    max: 200,
    fullWidth: true,
    placeholder: 'What the post is called',
  },
  {
    name: 'slug',
    label: 'Slug',
    type: 'slug',
    max: 120,
    fullWidth: true,
    hint: 'The URL segment. Derived from the title when left empty — and changing it later breaks any link already shared.',
  },
  {
    name: 'excerpt',
    label: 'Excerpt',
    type: 'textarea',
    rows: 3,
    max: 500,
    fullWidth: true,
    hint: 'Shown on the blog card, and used as the meta description when the SEO one is empty.',
  },
];

const SEO_FIELDS = [
  {
    name: 'seoTitle',
    label: 'SEO title',
    type: 'text',
    max: 200,
    fullWidth: true,
    hint: 'Overrides the browser-tab and search-result title. Left empty, the post title is used.',
  },
  {
    name: 'seoDescription',
    label: 'SEO description',
    type: 'textarea',
    rows: 2,
    max: 300,
    fullWidth: true,
    hint: 'Left empty, the excerpt is used — and failing that, the opening of the post.',
  },
];

/** Every field this screen can submit, for `formValues` and `toPayload`. */
const ALL_FIELDS = [
  ...META_FIELDS,
  ...SEO_FIELDS,
  { name: 'contentMarkdown', label: 'Content', type: 'markdown' },
  { name: 'coverMediaId', label: 'Cover image', type: 'image' },
  { name: 'coverAlt', label: 'Cover alt text', type: 'text', max: 300 },
  { name: 'ogMediaId', label: 'Share image', type: 'image' },
  { name: 'tagIds', label: 'Tags', type: 'list' },
];

export default function PostEditor({ post, tags, mode }) {
  const router = useRouter();
  const { notifySaved, notifyError } = useToast();

  const isCreate = mode === 'create';

  /**
   * The form's starting point.
   *
   * `formValues` turns a row into form state — nulls to empty strings, a media
   * row kept whole so `ImageField` can show a preview. The tag join rows have to
   * be flattened to ids first, because that is what the endpoint takes.
   */
  const initial = useMemo(
    () =>
      formValues(ALL_FIELDS, {
        ...(post ?? {}),
        coverMediaId: post?.coverMedia ?? null,
        ogMediaId: post?.ogMedia ?? null,
        tagIds: post?.tags?.map((join) => join.tagId ?? join.tag?.id).filter(Boolean) ?? [],
      }),
    [post]
  );

  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Re-seed when the loaded post arrives or changes identity. Comparing the id
  // rather than the object avoids resetting the form on every re-render.
  const [seededId, setSeededId] = useState(post?.id ?? null);
  if ((post?.id ?? null) !== seededId) {
    setSeededId(post?.id ?? null);
    setValues(initial);
    setErrors({});
  }

  const dirty = useMemo(
    () => Object.keys(changedFields(initial, values)).length > 0,
    [initial, values]
  );

  useUnsavedChanges(dirty && !saving);

  function setField(name, value) {
    setValues((current) => ({ ...current, [name]: value }));
    // Clearing on edit rather than on submit: a message that survives the fix
    // that resolved it teaches the author to ignore messages.
    setErrors((current) => (current[name] ? { ...current, [name]: undefined } : current));
  }

  async function save(nextStatus) {
    setBanner(null);

    const payload = toPayload(ALL_FIELDS, values);
    const body = isCreate
      ? { ...payload, status: nextStatus ?? 'DRAFT' }
      : { ...changedFields(toPayload(ALL_FIELDS, initial), payload), ...(nextStatus ? { status: nextStatus } : {}) };

    if (!isCreate && Object.keys(body).length === 0) {
      setBanner('Nothing has changed.');
      return;
    }

    const schema = isCreate ? createBlogPostSchema : updateBlogPostSchema;
    const local = validateWith(schema, body);

    if (local) {
      setErrors(local);
      setBanner('Some fields need attention.');
      return;
    }

    setSaving(true);

    try {
      const result = isCreate
        ? await api.post('/api/admin/blog', body)
        : await api.patch(`/api/admin/blog/${post.id}`, body);

      notifySaved(isCreate ? 'Post created.' : 'Post saved.');

      if (isCreate) {
        // Replace rather than push: going back to a "new post" form that has
        // already been submitted invites a duplicate.
        await router.replace(`/admin/blogs/${result.item.id}`);
      } else {
        setValues(formValues(ALL_FIELDS, {
          ...result.item,
          coverMediaId: result.item.coverMedia ?? null,
          ogMediaId: result.item.ogMedia ?? null,
          tagIds: result.item.tags?.map((join) => join.tagId ?? join.tag?.id).filter(Boolean) ?? [],
        }));
        setSeededId(result.item.id);
      }
    } catch (problem) {
      if (problem instanceof ApiError && problem.hasFieldErrors) {
        setErrors((current) => mergeFieldErrors(current, problem.fields));
        setBanner(problem.message);
      } else {
        setBanner(problem?.message ?? 'Could not save this post.');
      }
    } finally {
      setSaving(false);
    }
  }

  const status = post?.status ?? 'DRAFT';
  const published = status === 'PUBLISHED';

  return (
    <>
      {banner ? (
        <Box className={`${BANNER_ERROR} mb-6`} role="alert">
          {banner}
        </Box>
      ) : null}

      <Box className={`${PANEL} px-5 py-5 mb-8`}>
        <PanelHeading
          title={isCreate ? 'New post' : 'Post'}
          hint={
            isCreate
              ? 'Saved as a draft first. Nothing is public until you publish it.'
              : undefined
          }
          action={
            post ? (
              <Box className="flex items-center gap-3">
                <StatusChip status={status} />
                {published ? (
                  <Link href={`/blog/${post.slug}`} target="_blank" className={HINT}>
                    view on the site ↗
                  </Link>
                ) : null}
              </Box>
            ) : null
          }
        />

        <Box className="grid gap-5">
          {META_FIELDS.map((field) => (
            <FormField
              key={field.name}
              field={field}
              value={values[field.name]}
              error={errors[field.name]}
              disabled={saving}
              onChange={(value) => setField(field.name, value)}
            />
          ))}
        </Box>
      </Box>

      <Box className={`${PANEL} px-5 py-5 mb-8`}>
        <MarkdownEditor
          value={values.contentMarkdown}
          onChange={(value) => setField('contentMarkdown', value)}
          error={errors.contentMarkdown}
          disabled={saving}
          required
        />
      </Box>

      <Box className={`${PANEL} px-5 py-5 mb-8`}>
        <PanelHeading
          title="Tags"
          hint={
            tags.length
              ? 'Created on the Blog screen, so a typo cannot make a near-duplicate.'
              : 'No tags exist yet — add some on the Blog screen first.'
          }
        />

        {tags.length ? (
          <Box className="flex flex-wrap gap-2 pt-1">
            {tags.map((tag) => {
              const selected = (values.tagIds ?? []).includes(tag.id);

              return (
                <button
                  key={tag.id}
                  type="button"
                  aria-pressed={selected}
                  disabled={saving}
                  className={`border-2 rounded px-3 py-1 text-sm transform transition duration-500 ${
                    selected
                      ? 'border-[#7a61ff] text-[#7a61ff]'
                      : 'border-[#d2d2d2]/40 text-[#d2d2d2]/70 hover:border-[#7a61ff] hover:text-[#7a61ff]'
                  }`}
                  onClick={() =>
                    setField(
                      'tagIds',
                      selected
                        ? (values.tagIds ?? []).filter((id) => id !== tag.id)
                        : [...(values.tagIds ?? []), tag.id]
                    )
                  }
                >
                  {tag.name}
                </button>
              );
            })}
          </Box>
        ) : null}

        {errors.tagIds ? (
          <Typography className="text-[#ff9b9b] text-xs pt-2">{errors.tagIds}</Typography>
        ) : null}
      </Box>

      <Box className={`${PANEL} px-5 py-5 mb-8`}>
        <PanelHeading
          title="Images"
          hint="The cover appears on the card and at the top of the post. The share image is what a link preview uses — it falls back to the cover."
        />

        <Box className="grid md:grid-cols-2 gap-6">
          <Box>
            <ImageField
              label="Cover image"
              value={values.coverMediaId}
              disabled={saving}
              error={errors.coverMediaId}
              onChange={(media) => setField('coverMediaId', media)}
            />

            <Box className="pt-3">
              <FormField
                field={{
                  name: 'coverAlt',
                  label: 'Cover alt text',
                  type: 'text',
                  max: 300,
                  fullWidth: true,
                  hint: 'Required once a cover is set — describe the image for someone who cannot see it.',
                }}
                value={values.coverAlt}
                error={errors.coverAlt}
                disabled={saving}
                onChange={(value) => setField('coverAlt', value)}
              />
            </Box>
          </Box>

          <ImageField
            label="Share image"
            value={values.ogMediaId}
            disabled={saving}
            error={errors.ogMediaId}
            onChange={(media) => setField('ogMediaId', media)}
          />
        </Box>
      </Box>

      <Box className={`${PANEL} px-5 py-5 mb-8`}>
        <PanelHeading title="Search and social" />

        <Box className="grid gap-5">
          {SEO_FIELDS.map((field) => (
            <FormField
              key={field.name}
              field={field}
              value={values[field.name]}
              error={errors[field.name]}
              disabled={saving}
              onChange={(value) => setField(field.name, value)}
            />
          ))}
        </Box>
      </Box>

      <Box className="flex flex-wrap items-center gap-4 pb-10">
        <button type="button" className={BUTTON} disabled={saving} onClick={() => save(null)}>
          {saving ? 'Saving…' : isCreate ? 'Save draft' : 'Save'}
        </button>

        {/*
          Publish and unpublish are on the same control as save, not a separate
          screen, because "save and publish" is one intention. The label says
          which direction it goes so nobody has to remember the current state.
        */}
        <button
          type="button"
          className={BUTTON_QUIET}
          disabled={saving}
          onClick={() => save(published ? 'DRAFT' : 'PUBLISHED')}
        >
          {published ? 'Save and unpublish' : 'Save and publish'}
        </button>

        <Link href="/admin/blogs" className={HINT}>
          back to all posts
        </Link>

        {post ? (
          <Box className="ml-auto flex items-center gap-4">
            <Typography className={HINT}>
              {post.publishedAt
                ? `Published ${formatDateTime(post.publishedAt)}`
                : 'Never published'}
            </Typography>

            <button
              type="button"
              className={LINK_DANGER}
              disabled={saving}
              onClick={() => setConfirmingDelete(true)}
            >
              delete
            </button>
          </Box>
        ) : null}
      </Box>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this post?"
        message={`“${post?.title}” will be removed, along with its tag assignments.`}
        consequence="Unpublishing instead keeps the post and takes it off the site — and republishing later restores its original date rather than moving it to the top."
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={async () => {
          setConfirmingDelete(false);

          try {
            await api.del(`/api/admin/blog/${post.id}`);
            notifySaved(`${post.title} deleted.`);
            await router.replace('/admin/blogs');
          } catch (problem) {
            notifyError(problem?.message ?? 'Could not delete this post.');
          }
        }}
      />
    </>
  );
}
