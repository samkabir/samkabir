import { useState } from 'react';
import Link from 'next/link';
import { Box, Typography } from '@mui/material';

import AdminLayout, { adminScreen } from '@/components/admin/AdminLayout';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import DataTable, { ListToolbar } from '@/components/admin/DataTable';
import StatusChip from '@/components/admin/StatusChip';
import { EntityFormDialog } from '@/components/admin/EntityForm';
import { EmptyState, PanelHeading } from '@/components/admin/States';
import { useDebouncedValue, useResource } from '@/components/admin/useResource';
import { useToast } from '@/components/admin/Toast';
import { withAdminPage } from '@/lib/adminPage';
import { BUTTON_SM, HINT, LINK_ACTION, LINK_DANGER, PANEL } from '@/lib/adminTheme';
import { formatDateTime } from '@/lib/adminFormat';
import { createTagSchema, updateTagSchema } from '@/lib/validation/tag';

/**
 * Blog — posts and tags.
 *
 * The posts panel lists, filters, publishes and deletes; writing and editing a
 * post happen on `/admin/blogs/new` and `/admin/blogs/[id]`, which host the
 * Markdown editor with its live preview. This screen deliberately does not embed
 * that editor: a full post is too much to edit inside a row, and the list is the
 * right place to *find* a post, not to write one.
 *
 * Tags are managed here in full, because the editor needs them to exist. They are
 * created deliberately rather than typed into a post: a free-text tag field
 * produces near-duplicates — "nextjs", "Next.js", "next-js" — and the join table
 * makes cleaning that up everyone's problem.
 */
const TAG_FIELDS = [
  { name: 'name', label: 'Name', type: 'text', required: true, max: 60, placeholder: 'Next.js' },
  {
    name: 'slug',
    label: 'Slug',
    type: 'slug',
    max: 120,
    hint: 'The URL segment for the tag archive. Derived from the name when left empty.',
  },
];

function BlogsScreen({ adminUser }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const posts = useResource('/api/admin/blog', {
    query: { q: debouncedSearch, status, take: 100 },
    position: 'start',
  });

  const tags = useResource('/api/admin/tags', { query: { take: 200 } });
  const { notifySaved } = useToast();

  const [editingTag, setEditingTag] = useState(null);
  const [tagFormOpen, setTagFormOpen] = useState(false);
  const [confirmingPost, setConfirmingPost] = useState(null);
  const [confirmingTag, setConfirmingTag] = useState(null);

  const filtered = Boolean(debouncedSearch || status);

  async function submitTag(body) {
    if (editingTag) {
      await tags.update(editingTag.id, body);
      notifySaved(`${editingTag.name} updated.`);
    } else {
      const created = await tags.create(body);
      notifySaved(`${created.name} added.`);
    }

    setTagFormOpen(false);
  }

  return (
    <AdminLayout
      title="Blog"
      number="20."
      user={adminUser}
      hint="Posts and the tags they can be filed under."
    >
      <Box className={`${PANEL} px-5 py-5 mb-10`}>
        <PanelHeading
          title="Posts"
          hint="Ordered by publication date, newest first. Drafts sit at the top until they are published."
          action={
            <Link href="/admin/blogs/new" className={BUTTON_SM}>
              Write a post
            </Link>
          }
        />

        <ListToolbar
          search={search}
          onSearch={setSearch}
          searchPlaceholder="Title, excerpt or slug"
          status={status}
          onStatus={setStatus}
          count={posts.total}
          countLabel="posts"
        />

        <DataTable
          caption="Blog posts"
          loading={posts.loading}
          error={posts.error}
          onRetry={posts.reload}
          rows={posts.items}
          empty={
            <EmptyState
              title={filtered ? 'No posts match that' : 'No posts yet'}
              message={
                filtered
                  ? 'Try a different search, or clear the status filter.'
                  : 'Write the first one — it saves as a draft, so nothing is public until you publish it.'
              }
              filtered={filtered}
              action={
                <Link href="/admin/blogs/new" className={BUTTON_SM}>
                  Write a post
                </Link>
              }
            />
          }
          columns={[
            {
              key: 'title',
              header: 'Title',
              render: (row) => (
                <Box className="min-w-0">
                  <Link
                    href={`/admin/blogs/${row.id}`}
                    className="text-[#d2d2d2] text-sm font-semibold hover:text-[#7a61ff]"
                  >
                    {row.title}
                  </Link>
                  <Typography className={`${HINT} font-mono`}>/{row.slug}</Typography>
                  {row.excerpt ? (
                    <Typography className={`${HINT} pt-1`}>{row.excerpt}</Typography>
                  ) : null}
                </Box>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              render: (row) => (
                <Box className="flex flex-col items-start gap-2">
                  <StatusChip status={row.status} />
                  <Typography className={HINT}>{row.readingMinutes} min read</Typography>
                </Box>
              ),
            },
            {
              key: 'tags',
              header: 'Tags',
              hideOnNarrow: true,
              render: (row) => (
                <Typography className={HINT}>
                  {row.tags?.length
                    ? row.tags.map((join) => join.tag?.name).filter(Boolean).join(', ')
                    : '—'}
                </Typography>
              ),
            },
            {
              key: 'publishedAt',
              header: 'Published',
              hideOnNarrow: true,
              render: (row) => (
                <Typography className={HINT}>
                  {row.publishedAt ? formatDateTime(row.publishedAt) : 'not yet'}
                </Typography>
              ),
            },
          ]}
          actions={(row) => (
            <Box className="flex items-center justify-end gap-4">
              <Link href={`/admin/blogs/${row.id}`} className={LINK_ACTION}>
                edit
              </Link>

              <button
                type="button"
                className={LINK_ACTION}
                disabled={posts.isBusy(row.id)}
                onClick={() =>
                  posts.publish(row.id, row.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED')
                }
              >
                {row.status === 'PUBLISHED' ? 'unpublish' : 'publish'}
              </button>

              <button
                type="button"
                className={LINK_DANGER}
                disabled={posts.isBusy(row.id)}
                onClick={() => setConfirmingPost(row)}
              >
                delete
              </button>
            </Box>
          )}
        />
      </Box>

      <Box className={`${PANEL} px-5 py-5`}>
        <PanelHeading
          title="Tags"
          hint="Created here rather than typed into a post, so near-duplicates cannot appear."
          action={
            <button
              type="button"
              className={BUTTON_SM}
              onClick={() => {
                setEditingTag(null);
                setTagFormOpen(true);
              }}
            >
              Add a tag
            </button>
          }
        />

        <DataTable
          caption="Tags"
          loading={tags.loading}
          error={tags.error}
          onRetry={tags.reload}
          rows={tags.items}
          empty={
            <EmptyState
              title="No tags yet"
              message="Add the ones you expect to use. A post can be filed under up to twenty."
              action={
                <button
                  type="button"
                  className={BUTTON_SM}
                  onClick={() => {
                    setEditingTag(null);
                    setTagFormOpen(true);
                  }}
                >
                  Add a tag
                </button>
              }
            />
          }
          columns={[
            { key: 'name', header: 'Name', render: (row) => row.name },
            {
              key: 'slug',
              header: 'Slug',
              render: (row) => <span className="font-mono text-xs">{row.slug}</span>,
            },
            {
              key: 'posts',
              header: 'Posts',
              render: (row) => (
                <Typography className={HINT}>{row._count?.posts ?? 0}</Typography>
              ),
            },
          ]}
          actions={(row) => (
            <Box className="flex items-center justify-end gap-4">
              <button
                type="button"
                className={LINK_ACTION}
                onClick={() => {
                  setEditingTag(row);
                  setTagFormOpen(true);
                }}
              >
                edit
              </button>

              <button
                type="button"
                className={LINK_DANGER}
                disabled={tags.isBusy(row.id)}
                onClick={() => setConfirmingTag(row)}
              >
                delete
              </button>
            </Box>
          )}
        />
      </Box>

      <EntityFormDialog
        open={tagFormOpen}
        title={editingTag ? `Edit ${editingTag.name}` : 'Add a tag'}
        onClose={() => setTagFormOpen(false)}
        fields={TAG_FIELDS}
        item={editingTag}
        schema={editingTag ? updateTagSchema : createTagSchema}
        mode={editingTag ? 'update' : 'create'}
        onSubmit={submitTag}
      />

      <ConfirmDialog
        open={Boolean(confirmingPost)}
        title="Delete this post?"
        message={`“${confirmingPost?.title}” will be removed, along with its tag assignments.`}
        consequence="Unpublishing instead keeps the post and takes it off the site — and republishing later restores its original date rather than moving it to the top."
        onCancel={() => setConfirmingPost(null)}
        onConfirm={async () => {
          const item = confirmingPost;
          setConfirmingPost(null);
          if (await posts.remove(item.id)) notifySaved(`${item.title} deleted.`);
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmingTag)}
        title="Delete this tag?"
        message={
          confirmingTag?._count?.posts
            ? `“${confirmingTag?.name}” is used by ${confirmingTag._count.posts} post${
                confirmingTag._count.posts === 1 ? '' : 's'
              }.`
            : `“${confirmingTag?.name}” is not used by any post.`
        }
        consequence="The posts themselves are not affected — only the filing. Removing a tag from every post it is on cannot be undone from here."
        onCancel={() => setConfirmingTag(null)}
        onConfirm={async () => {
          const item = confirmingTag;
          setConfirmingTag(null);
          if (await tags.remove(item.id)) notifySaved(`${item.name} deleted.`);
        }}
      />
    </AdminLayout>
  );
}

/**
 * Wrapped so the theme and the toast provider sit *above* this component.
 * Rendering them from inside it would put them below every hook it calls —
 * see the note on `adminScreen`.
 */
export default adminScreen(BlogsScreen);

export const getServerSideProps = withAdminPage();
