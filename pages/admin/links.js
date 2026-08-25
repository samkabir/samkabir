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
import {
  SOCIAL_ICON_KEYS,
  createSocialLinkSchema,
  updateSocialLinkSchema,
} from '@/lib/validation/socialLink';

/**
 * Social links.
 *
 * The site renders the same links in two places — the fixed sidebar rail and the
 * contact block — with different styling, and the two flags decide which. They
 * are toggles on the row rather than fields in the form because "show this one in
 * the rail but not under Contact" is a decision made while looking at the list.
 *
 * `iconKey` is a select over the keys the frontend has components for, not a free
 * string. Typing "twitter-x" into a text field would save cleanly, render nothing,
 * and give no clue why.
 */
const ICON_LABELS = {
  linkedin: 'LinkedIn',
  github: 'GitHub',
  facebook: 'Facebook',
  instagram: 'Instagram',
  twitter: 'Twitter / X',
  youtube: 'YouTube',
  mail: 'Email',
  link: 'Generic link',
};

const FIELDS = [
  {
    name: 'platform',
    label: 'Platform',
    type: 'text',
    required: true,
    max: 80,
    placeholder: 'LinkedIn',
    hint: 'The service’s name, used internally and as the accessible label’s prefix.',
  },
  {
    name: 'label',
    label: 'Label',
    type: 'text',
    required: true,
    max: 120,
    placeholder: 'Samiul Kabir on LinkedIn',
    hint: 'What a screen reader announces, and the tooltip text.',
  },
  {
    name: 'url',
    label: 'URL',
    type: 'text',
    inputType: 'url',
    required: true,
    fullWidth: true,
    placeholder: 'https://www.linkedin.com/in/…',
    hint: 'Must be http:// or https://. Other schemes are rejected — these values go straight into an href.',
  },
  {
    name: 'iconKey',
    label: 'Icon',
    type: 'select',
    required: true,
    options: SOCIAL_ICON_KEYS.map((key) => ({ value: key, label: ICON_LABELS[key] ?? key })),
    hint: 'Only icons the site has a component for. Adding to this list is a code change.',
  },
  {
    name: 'showInSidebar',
    label: 'Show in the sidebar rail',
    type: 'checkbox',
    fullWidth: true,
  },
  {
    name: 'showInContact',
    label: 'Show in the contact block',
    type: 'checkbox',
    fullWidth: true,
  },
];

function LinksScreen({ adminUser }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const links = useResource('/api/admin/social-links', {
    query: { q: debouncedSearch, status, take: 200 },
  });

  const { notifySaved } = useToast();

  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirming, setConfirming] = useState(null);

  const filtered = Boolean(debouncedSearch || status);

  async function submit(body) {
    if (editing) {
      await links.update(editing.id, body);
      notifySaved(`${editing.platform} updated.`);
    } else {
      const created = await links.create(body);
      notifySaved(`${created.platform} added.`);
    }

    setFormOpen(false);
  }

  return (
    <AdminLayout
      title="Links"
      number="11."
      user={adminUser}
      hint="Shown in the sidebar rail and the contact block. Hiding a link keeps the row; deleting it does not."
      actions={
        <button type="button" className={BUTTON_SM} onClick={() => { setEditing(null); setFormOpen(true); }}>
          Add a link
        </button>
      }
    >
      <ListToolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Platform or label"
        status={status}
        onStatus={setStatus}
        count={links.total}
        countLabel="links"
      />

      {links.error ? (
        <ErrorState message={links.error} onRetry={links.reload} />
      ) : links.loading ? (
        <LoadingRows rows={4} label="Loading links…" />
      ) : links.items.length === 0 ? (
        <EmptyState
          title={filtered ? 'No links match that' : 'No links yet'}
          message={
            filtered
              ? 'Try a different search, or clear the status filter.'
              : 'Add the first one — platform, label, URL and an icon.'
          }
          filtered={filtered}
          action={
            <button type="button" className={BUTTON_SM} onClick={() => { setEditing(null); setFormOpen(true); }}>
              Add a link
            </button>
          }
        />
      ) : (
        <>
          {filtered ? (
            <Box className={`${PANEL} px-4 py-3 mb-4`}>
              <Typography className={HINT}>
                Reordering is off while a search or status filter is applied.
              </Typography>
            </Box>
          ) : null}

          <SortableList
            items={links.items}
            getId={(item) => item.id}
            itemLabel="link"
            disabled={filtered}
            onReorder={(ids) => links.reorder(ids)}
            renderRow={(item) => (
              <Box className="flex flex-wrap items-start justify-between gap-4">
                <Box className="min-w-0">
                  <Typography className="text-[#d2d2d2] text-sm font-semibold">
                    {item.platform}
                    <span className="text-[#d2d2d2]/50 font-normal"> · {ICON_LABELS[item.iconKey] ?? item.iconKey}</span>
                  </Typography>

                  {/* The URL is shown in full and is not a link: a dashboard that
                      navigates away when you meant to read the address is a small
                      but constant annoyance, and these open off-site. */}
                  <Typography className={`${HINT} pt-1 break-all font-mono`}>{item.url}</Typography>

                  <Box className="flex flex-wrap items-center gap-2 pt-2">
                    <StatusChip status={item.status} />
                    {item.showInSidebar ? (
                      <Flag label="Rail" tone="accent" title="Appears in the fixed sidebar" />
                    ) : null}
                    {item.showInContact ? (
                      <Flag label="Contact" tone="accent" title="Appears in the contact block" />
                    ) : null}
                    {!item.showInSidebar && !item.showInContact ? (
                      <Flag
                        label="Nowhere"
                        tone="warning"
                        title="Published, but not shown in either place — nothing renders it"
                      />
                    ) : null}
                  </Box>
                </Box>

                <Box className="flex flex-wrap items-center gap-4 shrink-0">
                  <button
                    type="button"
                    className={LINK_ACTION}
                    disabled={links.isBusy(item.id)}
                    onClick={() => links.patchRow(item.id, { showInSidebar: !item.showInSidebar })}
                  >
                    {item.showInSidebar ? 'hide from rail' : 'show in rail'}
                  </button>

                  <button
                    type="button"
                    className={LINK_ACTION}
                    disabled={links.isBusy(item.id)}
                    onClick={() => links.patchRow(item.id, { showInContact: !item.showInContact })}
                  >
                    {item.showInContact ? 'hide from contact' : 'show in contact'}
                  </button>

                  <button
                    type="button"
                    className={LINK_ACTION}
                    disabled={links.isBusy(item.id)}
                    onClick={() =>
                      links.publish(item.id, item.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED')
                    }
                  >
                    {item.status === 'PUBLISHED' ? 'unpublish' : 'publish'}
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
                    disabled={links.isBusy(item.id)}
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
        title={editing ? `Edit ${editing.platform}` : 'Add a link'}
        onClose={() => setFormOpen(false)}
        fields={FIELDS}
        item={editing}
        schema={editing ? updateSocialLinkSchema : createSocialLinkSchema}
        mode={editing ? 'update' : 'create'}
        createDefaults={{ order: nextOrder(links.items) }}
        columns={2}
        onSubmit={submit}
      />

      <ConfirmDialog
        open={Boolean(confirming)}
        title="Delete this link?"
        message={`The ${confirming?.platform} link will be removed from the database.`}
        consequence="Unpublishing it instead keeps the row and takes it off the site."
        onCancel={() => setConfirming(null)}
        onConfirm={async () => {
          const item = confirming;
          setConfirming(null);
          if (await links.remove(item.id)) notifySaved(`${item.platform} deleted.`);
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
export default adminScreen(LinksScreen);

export const getServerSideProps = withAdminPage();
