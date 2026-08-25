import { useState } from 'react';
import { Box, Typography } from '@mui/material';

import AdminLayout, { adminScreen } from '@/components/admin/AdminLayout';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import SortableList from '@/components/admin/SortableList';
import StatusChip, { Flag } from '@/components/admin/StatusChip';
import { EntityFormDialog } from '@/components/admin/EntityForm';
import { ListToolbar } from '@/components/admin/DataTable';
import { EmptyState, ErrorState, LoadingRows } from '@/components/admin/States';
import { useDebouncedValue, useResource } from '@/components/admin/useResource';
import { useToast } from '@/components/admin/Toast';
import { withAdminPage } from '@/lib/adminPage';
import { BUTTON_SM, HINT, LINK_ACTION, LINK_DANGER, PANEL } from '@/lib/adminTheme';
import { nextOrder } from '@/lib/adminList';
import { createProjectSchema, updateProjectSchema } from '@/lib/validation/project';

/**
 * Projects.
 *
 * The one list where the row order is not the only ordering that matters:
 * `isFeatured` picks the three shown on the homepage, independently of position.
 * So featured is a toggle on the row rather than a field buried in the form —
 * it is the thing most likely to be changed on its own.
 */
const FIELDS = [
  { name: 'title', label: 'Title', type: 'text', required: true, max: 200, fullWidth: true },
  {
    name: 'slug',
    label: 'Slug',
    type: 'slug',
    max: 120,
    fullWidth: true,
    hint: 'The public URL. Left empty on a new project it is derived from the title; on an existing one it is left alone, because a slug that is already linked should only change deliberately.',
  },
  {
    name: 'description',
    label: 'Description',
    type: 'textarea',
    rows: 5,
    max: 5000,
    fullWidth: true,
  },
  { name: 'repoUrl', label: 'Repository URL', type: 'text', inputType: 'url', placeholder: 'https://github.com/…' },
  { name: 'liveUrl', label: 'Live URL', type: 'text', inputType: 'url', placeholder: 'https://…' },
  {
    name: 'stacks',
    label: 'Stack',
    type: 'list',
    itemLabel: 'technology',
    max: 30,
    fullWidth: true,
    placeholder: 'Next.js',
  },
  {
    name: 'coverMediaId',
    mediaKey: 'coverMedia',
    label: 'Cover image',
    type: 'image',
    fullWidth: true,
    hint: 'Shown on the project card. JPEG, PNG, WebP, GIF or AVIF, up to 4 MB.',
  },
  {
    name: 'isFeatured',
    label: 'Feature on the homepage',
    type: 'checkbox',
    hint: 'The homepage shows the first three featured projects, in this list’s order.',
    fullWidth: true,
  },
  {
    name: 'isNda',
    label: 'Under NDA',
    type: 'checkbox',
    hint: 'Renders the site’s standard disclaimer instead of naming the client.',
    fullWidth: true,
  },
];

function ProjectsScreen({ adminUser }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const projects = useResource('/api/admin/projects', {
    query: { q: debouncedSearch, status, take: 200 },
  });

  const { notifySaved } = useToast();

  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirming, setConfirming] = useState(null);

  const filtered = Boolean(debouncedSearch || status);
  const featuredCount = projects.items.filter((item) => item.isFeatured).length;

  async function submit(body) {
    if (editing) {
      await projects.update(editing.id, body);
      notifySaved(`${editing.title} updated.`);
    } else {
      const created = await projects.create(body);
      notifySaved(`${created.title} added.`);
    }

    setFormOpen(false);
  }

  return (
    <AdminLayout
      title="Projects"
      number="10."
      user={adminUser}
      hint={`Everything in the Projects section. ${featuredCount} featured — the homepage shows the first three of those.`}
      actions={
        <button type="button" className={BUTTON_SM} onClick={() => { setEditing(null); setFormOpen(true); }}>
          Add a project
        </button>
      }
    >
      <ListToolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Title, description or slug"
        status={status}
        onStatus={setStatus}
        count={projects.total}
        countLabel="projects"
      />

      {projects.error ? (
        <ErrorState message={projects.error} onRetry={projects.reload} />
      ) : projects.loading ? (
        <LoadingRows rows={4} label="Loading projects…" />
      ) : projects.items.length === 0 ? (
        <EmptyState
          title={filtered ? 'No projects match that' : 'No projects yet'}
          message={
            filtered
              ? 'Try a different search, or clear the status filter.'
              : 'Add the first one. Only a title is required — the slug is derived from it.'
          }
          filtered={filtered}
          action={
            <button type="button" className={BUTTON_SM} onClick={() => { setEditing(null); setFormOpen(true); }}>
              Add a project
            </button>
          }
        />
      ) : (
        <>
          {filtered ? (
            <Box className={`${PANEL} px-4 py-3 mb-4`}>
              <Typography className={HINT}>
                Reordering is off while a search or status filter is applied —
                dragging would renumber rows the filter is hiding.
              </Typography>
            </Box>
          ) : null}

          <SortableList
            items={projects.items}
            getId={(item) => item.id}
            itemLabel="project"
            disabled={filtered}
            onReorder={(ids) => projects.reorder(ids)}
            renderRow={(item) => (
              <Box className="flex flex-wrap items-start justify-between gap-4">
                <Box className="flex items-start gap-4 min-w-0">
                  {item.coverMedia?.url ? (
                    // A plain <img>: this is a private dashboard thumbnail of an
                    // image whose dimensions vary, and next/image would run every
                    // one through the optimiser for no benefit. The public site
                    // is where that migration pays off — Phase 7.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.coverMedia.url}
                      alt={item.coverMedia.alt || ''}
                      className="w-20 h-14 object-cover border border-[#d2d2d2]/20 shrink-0"
                    />
                  ) : (
                    <Box className="w-20 h-14 border border-dashed border-[#d2d2d2]/20 shrink-0" />
                  )}

                  <Box className="min-w-0">
                    <Typography className="text-[#d2d2d2] text-sm font-semibold">
                      {item.title}
                    </Typography>

                    <Typography className={`${HINT} pt-1 font-mono`}>/{item.slug}</Typography>

                    <Box className="flex flex-wrap items-center gap-2 pt-2">
                      <StatusChip status={item.status} />
                      {item.isFeatured ? (
                        <Flag label="Featured" tone="accent" title="Shown on the homepage" />
                      ) : null}
                      {item.isNda ? (
                        <Flag label="NDA" tone="warning" title="The client cannot be named publicly" />
                      ) : null}
                      {item.stacks?.length ? (
                        <Typography className={HINT}>{item.stacks.join(' · ')}</Typography>
                      ) : null}
                    </Box>
                  </Box>
                </Box>

                <Box className="flex items-center gap-4 shrink-0">
                  <button
                    type="button"
                    className={LINK_ACTION}
                    disabled={projects.isBusy(item.id)}
                    onClick={() => projects.patchRow(item.id, { isFeatured: !item.isFeatured })}
                  >
                    {item.isFeatured ? 'unfeature' : 'feature'}
                  </button>

                  <button
                    type="button"
                    className={LINK_ACTION}
                    disabled={projects.isBusy(item.id)}
                    onClick={() =>
                      projects.publish(item.id, item.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED')
                    }
                  >
                    {item.status === 'PUBLISHED' ? 'hide' : 'publish'}
                  </button>

                  <button
                    type="button"
                    className={LINK_ACTION}
                    onClick={() => {
                      setEditing(item);
                      setFormOpen(true);
                    }}
                  >
                    edit
                  </button>

                  <button
                    type="button"
                    className={LINK_DANGER}
                    disabled={projects.isBusy(item.id)}
                    onClick={() => setConfirming(item)}
                  >
                    delete
                  </button>
                </Box>
              </Box>
            )}
          />
        </>
      )}

      <EntityFormDialog
        open={formOpen}
        title={editing ? `Edit ${editing.title}` : 'Add a project'}
        onClose={() => setFormOpen(false)}
        fields={FIELDS}
        item={editing}
        schema={editing ? updateProjectSchema : createProjectSchema}
        mode={editing ? 'update' : 'create'}
        createDefaults={{ order: nextOrder(projects.items) }}
        columns={2}
        onSubmit={submit}
      />

      <ConfirmDialog
        open={Boolean(confirming)}
        title="Delete this project?"
        message={`“${confirming?.title}” will be removed from the database.`}
        consequence="Its cover image stays in the media library — deleting the project does not delete the file."
        onCancel={() => setConfirming(null)}
        onConfirm={async () => {
          const item = confirming;
          setConfirming(null);
          if (await projects.remove(item.id)) notifySaved(`${item.title} deleted.`);
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
export default adminScreen(ProjectsScreen);

export const getServerSideProps = withAdminPage();
