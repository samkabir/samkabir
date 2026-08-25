import { useMemo, useState } from 'react';
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
import { formatTimeline } from '@/lib/adminFormat';
import { createExperienceSchema, updateExperienceSchema } from '@/lib/validation/experience';

/**
 * Experience — permanent roles and contractual engagements.
 *
 * Two tabs over one table, which is the shape the schema chose: the two static
 * files this replaces were structurally identical, so they became one model with
 * a `kind` discriminator. The tabs are a filter, not two screens, and `kind` stays
 * an editable field — reclassifying a role is a dropdown rather than a migration.
 *
 * **Reordering applies within the visible tab.** The endpoint assigns positions
 * `0, 1, 2 …` to the ids it receives, so sending one tab's ids renumbers that tab
 * alone. Both tabs then use the same range, which is correct: every public query
 * filters by `kind` first, and `@@index([kind, status, order])` is built for
 * exactly that.
 */
const KIND_TABS = [
  { value: 'FULL_TIME', label: 'Full-time', empty: 'No full-time roles yet' },
  { value: 'CONTRACT', label: 'Contractual', empty: 'No contractual engagements yet' },
];

function fieldsFor(kind) {
  return [
    {
      name: 'kind',
      label: 'Kind',
      type: 'select',
      required: true,
      default: kind,
      options: KIND_TABS.map(({ value, label }) => ({ value, label })),
      hint: 'Moves the role to the other tab, and to the other section of the site.',
    },
    { name: 'jobPosition', label: 'Job title', type: 'text', required: true, max: 200, fullWidth: true },
    { name: 'companyName', label: 'Company or client', type: 'text', required: true, max: 200 },
    { name: 'location', label: 'Location', type: 'text', max: 200, placeholder: 'Dhaka, Bangladesh — or Remote' },
    { name: 'startDate', label: 'Start date', type: 'date', required: true },
    {
      name: 'endDate',
      label: 'End date',
      type: 'date',
      hint: 'Leave empty and tick “current role” below for an ongoing position.',
    },
    {
      name: 'isCurrent',
      label: 'This is a current role',
      type: 'checkbox',
      hint: 'Shown as “– Present”. The end date must be empty.',
      fullWidth: true,
    },
    {
      name: 'isNda',
      label: 'The client cannot be named',
      type: 'checkbox',
      hint: 'Kept as a flag rather than written into the company name, so the public view can render one consistent disclaimer.',
      fullWidth: true,
    },
    {
      name: 'timelineOverride',
      label: 'Timeline label override',
      type: 'text',
      max: 200,
      fullWidth: true,
      hint: 'Replaces the generated “July 2025 – Present”. Display only — ordering always uses the real dates.',
    },
    {
      name: 'responsibilities',
      label: 'Responsibilities',
      type: 'list',
      itemLabel: 'bullet',
      max: 30,
      fullWidth: true,
      placeholder: 'Built and shipped the reporting dashboard',
      hint: 'One bullet per line, in the order they should read. Empty lines are dropped on save.',
    },
  ];
}

function ExperiencesScreen({ adminUser }) {
  const [kind, setKind] = useState('FULL_TIME');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  /**
   * `kind` is filtered client-side, on purpose.
   *
   * The collection endpoint's query parameters are `q`, `status`, `take` and
   * `skip` — there is no `kind`, and adding one would mean editing the shared
   * `listQuery` schema that all nine entities use, for one screen. A CV has tens
   * of roles, not thousands, so one request holds all of them and switching tabs
   * costs nothing.
   */
  const experiences = useResource('/api/admin/experiences', {
    query: { q: debouncedSearch, status, take: 200 },
  });

  const { notifySaved } = useToast();

  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirming, setConfirming] = useState(null);

  const visible = useMemo(
    () => experiences.items.filter((item) => item.kind === kind),
    [experiences.items, kind]
  );

  const fields = useMemo(() => fieldsFor(kind), [kind]);
  const tab = KIND_TABS.find((entry) => entry.value === kind);
  const filtered = Boolean(debouncedSearch || status);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  async function submit(body) {
    if (editing) {
      await experiences.update(editing.id, body);
      notifySaved(`${editing.jobPosition} updated.`);
    } else {
      const created = await experiences.create(body);
      notifySaved(`${created.jobPosition} added.`);
    }

    setFormOpen(false);
  }

  return (
    <AdminLayout
      title="Experience"
      number="02."
      user={adminUser}
      hint="Both sections of the site read from this one list. The tabs are a filter on the same records."
      actions={
        <button type="button" className={BUTTON_SM} onClick={openCreate}>
          Add a role
        </button>
      }
    >
      {/* A tab list rather than a select: two options, both worth showing, and
          the count beside each answers "did I put it in the right one". */}
      <Box role="tablist" aria-label="Kind of experience" className="flex gap-2 pb-4">
        {KIND_TABS.map((entry) => {
          const active = entry.value === kind;
          const count = experiences.items.filter((item) => item.kind === entry.value).length;

          return (
            <button
              key={entry.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setKind(entry.value)}
              className={`border-2 px-4 py-2 text-sm font-semibold transition duration-300 outline-none focus-visible:ring-2 focus-visible:ring-[#7a61ff] ${
                active
                  ? 'border-[#7a61ff] text-[#7a61ff]'
                  : 'border-[#d2d2d2]/25 text-[#d2d2d2]/60 hover:text-[#d2d2d2]'
              }`}
            >
              {entry.label}
              {experiences.loading ? '' : ` (${count})`}
            </button>
          );
        })}
      </Box>

      <ListToolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Title, company or location"
        status={status}
        onStatus={setStatus}
        count={visible.length}
        countLabel={`${tab.label.toLowerCase()} roles`}
      />

      {experiences.error ? (
        <ErrorState message={experiences.error} onRetry={experiences.reload} />
      ) : experiences.loading ? (
        <LoadingRows rows={3} label="Loading experience…" />
      ) : visible.length === 0 ? (
        <EmptyState
          title={filtered ? 'Nothing matches that' : tab.empty}
          message={
            filtered
              ? 'Try a different search, or clear the status filter.'
              : 'Add the first one. A title, a company and a start date are all that is required.'
          }
          filtered={filtered}
          action={
            <button type="button" className={BUTTON_SM} onClick={openCreate}>
              Add a role
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
            items={visible}
            getId={(item) => item.id}
            itemLabel="role"
            disabled={filtered}
            onReorder={(ids) => experiences.reorder(ids)}
            renderRow={(item) => (
              <Box>
                <Box className="flex flex-wrap items-start justify-between gap-3">
                  <Box className="min-w-0">
                    <Typography className="text-[#d2d2d2] text-sm font-semibold">
                      {item.jobPosition}
                    </Typography>

                    <Typography className={`${HINT} pt-1`}>
                      {item.companyName}
                      {item.location ? ` · ${item.location}` : ''}
                      {' · '}
                      {formatTimeline(item)}
                    </Typography>

                    <Box className="flex flex-wrap items-center gap-2 pt-2">
                      <StatusChip status={item.status} />
                      {item.isNda ? (
                        <Flag label="NDA" tone="warning" title="The client cannot be named publicly" />
                      ) : null}
                      {item.isCurrent ? (
                        <Flag label="Current" tone="accent" title="Shown as ending in “Present”" />
                      ) : null}
                      <Typography className={HINT}>
                        {item.responsibilities?.length ?? 0} bullet
                        {item.responsibilities?.length === 1 ? '' : 's'}
                      </Typography>
                    </Box>
                  </Box>

                  <Box className="flex items-center gap-4 shrink-0">
                    <button
                      type="button"
                      className={LINK_ACTION}
                      disabled={experiences.isBusy(item.id)}
                      onClick={() =>
                        experiences.publish(
                          item.id,
                          item.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED'
                        )
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
                      disabled={experiences.isBusy(item.id)}
                      onClick={() => setConfirming(item)}
                    >
                      delete
                    </button>
                  </Box>
                </Box>
              </Box>
            )}
          />
        </>
      )}

      <EntityFormDialog
        open={formOpen}
        title={editing ? `Edit ${editing.jobPosition}` : `Add a ${tab.label.toLowerCase()} role`}
        onClose={() => setFormOpen(false)}
        fields={fields}
        item={editing}
        schema={editing ? updateExperienceSchema : createExperienceSchema}
        mode={editing ? 'update' : 'create'}
        createDefaults={{ order: nextOrder(visible) }}
        columns={2}
        onSubmit={submit}
      />

      <ConfirmDialog
        open={Boolean(confirming)}
        title="Delete this role?"
        message={`“${confirming?.jobPosition}” at ${confirming?.companyName} will be removed, along with its bullet points.`}
        consequence="Hiding it instead keeps the record and takes it off the site."
        onCancel={() => setConfirming(null)}
        onConfirm={async () => {
          const item = confirming;
          setConfirming(null);
          if (await experiences.remove(item.id)) notifySaved(`${item.jobPosition} deleted.`);
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
export default adminScreen(ExperiencesScreen);

export const getServerSideProps = withAdminPage();
