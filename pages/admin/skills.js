import { useState } from 'react';
import { Box, Typography } from '@mui/material';

import AdminLayout from '@/components/admin/AdminLayout';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import SortableList from '@/components/admin/SortableList';
import StatusChip from '@/components/admin/StatusChip';
import { EntityFormDialog } from '@/components/admin/EntityForm';
import { ListToolbar } from '@/components/admin/DataTable';
import { EmptyState, ErrorState, LoadingRows } from '@/components/admin/States';
import { useDebouncedValue, useResource } from '@/components/admin/useResource';
import { useToast } from '@/components/admin/Toast';
import { withAdminPage } from '@/lib/adminPage';
import { BUTTON_SM, HINT, LINK_ACTION, LINK_DANGER, PANEL } from '@/lib/adminTheme';
import { nextOrder } from '@/lib/adminList';
import { createSkillSchema, updateSkillSchema } from '@/lib/validation/skill';

/**
 * Skills.
 *
 * The simplest of the list screens, and the one the others follow: a toolbar, a
 * reorderable list, a dialog form, a confirmation before deleting. Anything that
 * looks like boilerplate here is in a shared component rather than repeated —
 * what remains is the part that is actually specific to skills.
 */
const FIELDS = [
  { name: 'name', label: 'Name', type: 'text', required: true, max: 80, placeholder: 'TypeScript' },
  {
    name: 'category',
    label: 'Category',
    type: 'text',
    max: 80,
    hint: 'Optional grouping — Frontend, Backend, Tooling. The site shows one flat list today; a category costs nothing until it starts using them.',
  },
];

export default function SkillsScreen({ adminUser }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const skills = useResource('/api/admin/skills', {
    query: { q: debouncedSearch, status, take: 200 },
  });

  const { notifySaved } = useToast();

  const [editing, setEditing] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [formOpen, setFormOpen] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (skill) => {
    setEditing(skill);
    setFormOpen(true);
  };

  const closeForm = () => setFormOpen(false);

  async function submit(body) {
    if (editing) {
      await skills.update(editing.id, body);
      notifySaved(`${editing.name} updated.`);
    } else {
      const created = await skills.create(body);
      notifySaved(`${created.name} added.`);
    }

    closeForm();
  }

  const filtered = Boolean(debouncedSearch || status);

  return (
    <AdminLayout
      title="Skills"
      number="03."
      user={adminUser}
      hint="Shown in the Skills section, in this order. Unpublished skills stay in the database and disappear from the site."
      actions={
        <button type="button" className={BUTTON_SM} onClick={openCreate}>
          Add a skill
        </button>
      }
    >
      <ListToolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Name or category"
        status={status}
        onStatus={setStatus}
        count={skills.total}
        countLabel="skills"
      />

      {skills.error ? (
        <ErrorState message={skills.error} onRetry={skills.reload} />
      ) : skills.loading ? (
        <LoadingRows rows={5} label="Loading skills…" />
      ) : skills.items.length === 0 ? (
        <EmptyState
          title={filtered ? 'No skills match that' : 'No skills yet'}
          message={
            filtered
              ? 'Try a different search, or clear the status filter.'
              : 'Add the first one — name is the only required field.'
          }
          filtered={filtered}
          action={
            <button type="button" className={BUTTON_SM} onClick={openCreate}>
              Add a skill
            </button>
          }
        />
      ) : (
        <>
          {filtered ? (
            <Box className={`${PANEL} px-4 py-3 mb-4`}>
              <Typography className={HINT}>
                Reordering is disabled while the list is filtered — dragging a row
                would rewrite the positions of everything hidden by the filter.
                Clear the search and status to reorder.
              </Typography>
            </Box>
          ) : null}

          <SortableList
            items={skills.items}
            getId={(skill) => skill.id}
            itemLabel="skill"
            disabled={filtered}
            onReorder={(ids) => skills.reorder(ids)}
            renderRow={(skill) => (
              <Box className="flex flex-wrap items-center justify-between gap-3">
                <Box className="min-w-0">
                  <Typography className="text-[#d2d2d2] text-sm">
                    {skill.name}
                    {skill.category ? (
                      <span className="text-[#d2d2d2]/50"> · {skill.category}</span>
                    ) : null}
                  </Typography>
                </Box>

                <Box className="flex items-center gap-4 shrink-0">
                  <StatusChip status={skill.status} />

                  <button
                    type="button"
                    className={LINK_ACTION}
                    disabled={skills.isBusy(skill.id)}
                    onClick={() =>
                      skills.publish(
                        skill.id,
                        skill.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED'
                      )
                    }
                  >
                    {skill.status === 'PUBLISHED' ? 'hide' : 'publish'}
                  </button>

                  <button type="button" className={LINK_ACTION} onClick={() => openEdit(skill)}>
                    edit
                  </button>

                  <button
                    type="button"
                    className={LINK_DANGER}
                    disabled={skills.isBusy(skill.id)}
                    onClick={() => setConfirming(skill)}
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
        title={editing ? `Edit ${editing.name}` : 'Add a skill'}
        onClose={closeForm}
        fields={FIELDS}
        item={editing}
        schema={editing ? updateSkillSchema : createSkillSchema}
        mode={editing ? 'update' : 'create'}
        createDefaults={{ order: nextOrder(skills.items) }}
        onSubmit={submit}
      />

      <ConfirmDialog
        open={Boolean(confirming)}
        title="Delete this skill?"
        message={`“${confirming?.name}” will be removed from the database.`}
        consequence="Hiding it instead keeps the row and takes it off the site — use that if you might want it back."
        confirmLabel="Delete"
        onCancel={() => setConfirming(null)}
        onConfirm={async () => {
          const skill = confirming;
          setConfirming(null);
          if (await skills.remove(skill.id)) notifySaved(`${skill.name} deleted.`);
        }}
      />
    </AdminLayout>
  );
}

export const getServerSideProps = withAdminPage();
