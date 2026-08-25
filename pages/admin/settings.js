import { useMemo, useState } from 'react';
import { Box, Typography } from '@mui/material';

import AdminLayout, { adminScreen } from '@/components/admin/AdminLayout';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import EntityForm, { EntityFormDialog } from '@/components/admin/EntityForm';
import SortableList from '@/components/admin/SortableList';
import StatusChip, { Flag } from '@/components/admin/StatusChip';
import { EmptyState, ErrorState, LoadingRows, PanelHeading } from '@/components/admin/States';
import { useResource, useSingleton } from '@/components/admin/useResource';
import { useToast } from '@/components/admin/Toast';
import { withAdminPage } from '@/lib/adminPage';
import { BUTTON_SM, HINT, LINK_ACTION, LINK_DANGER, PANEL } from '@/lib/adminTheme';
import { nextOrder } from '@/lib/adminList';
import { seoSettingsSchema } from '@/lib/validation/seo';
import {
  SECTION_KEYS,
  createSectionCopySchema,
  updateSectionCopySchema,
} from '@/lib/validation/sectionCopy';

/**
 * Settings — SEO defaults and section headings.
 *
 * Both are site-wide configuration rather than content, which is why they share a
 * screen. Section copy is the more interesting of the two: those headings and the
 * binary `00. / 01. / 10.` numbering are currently duplicated between each section
 * component and the header nav, so renumbering means editing two files and hoping
 * they agree. As rows they are written once and read by both.
 */
const SEO_FIELDS = [
  {
    name: 'siteTitle',
    label: 'Site title',
    type: 'text',
    required: true,
    max: 120,
    fullWidth: true,
    hint: 'The default <title>, and the fallback for pages that do not set their own.',
  },
  {
    name: 'defaultDescription',
    label: 'Default description',
    type: 'textarea',
    required: true,
    rows: 3,
    max: 300,
    fullWidth: true,
    hint: 'Used as the meta description wherever a page has none of its own.',
  },
  {
    name: 'canonicalUrl',
    label: 'Canonical URL',
    type: 'text',
    inputType: 'url',
    placeholder: 'https://samkabir.com',
    hint: 'The site’s own address. Used to build absolute URLs for Open Graph tags.',
  },
  {
    name: 'twitterHandle',
    label: 'Twitter handle',
    type: 'text',
    max: 40,
    placeholder: 'samkabir',
    hint: 'Without the @ — it is stripped on save, so every consumer can add exactly one back.',
  },
  {
    name: 'ogImageMediaId',
    mediaKey: 'ogImageMedia',
    label: 'Default share image',
    type: 'image',
    fullWidth: true,
    hint: 'Shown when a link to the site is pasted into a chat or a social post. 1200×630 is the usual size.',
  },
];

const SECTION_LABELS = {
  about: 'About',
  skills: 'Skills',
  experience: 'Experience',
  contractual: 'Contractual',
  projects: 'Projects',
  contact: 'Contact',
};

function sectionFields(isEdit) {
  const key = {
    name: 'key',
    label: 'Section',
    type: 'select',
    required: true,
    options: SECTION_KEYS.map((value) => ({ value, label: SECTION_LABELS[value] ?? value })),
    hint: 'Which component reads this row. One row per section.',
  };

  const rest = [
    {
      name: 'numberLabel',
      label: 'Number label',
      type: 'text',
      required: true,
      max: 10,
      placeholder: '00.',
      hint: 'The prefix before the heading. Free text — the numbering is a stylistic choice, not a sequence.',
    },
    { name: 'heading', label: 'Heading', type: 'text', required: true, max: 200, fullWidth: true },
    {
      name: 'subheading',
      label: 'Subheading',
      type: 'textarea',
      rows: 2,
      max: 500,
      fullWidth: true,
    },
    {
      name: 'navLabel',
      label: 'Nav label',
      type: 'text',
      max: 80,
      hint: 'Used in the header nav when it should be shorter than the heading — “Work” rather than “Some Projects I worked on…”.',
    },
    {
      name: 'anchor',
      label: 'Anchor',
      type: 'text',
      max: 80,
      placeholder: 'about',
      hint: 'The in-page target, without the #. Leave empty for a section not in the nav.',
    },
    { name: 'showInNav', label: 'Show in the header nav', type: 'checkbox', fullWidth: true },
  ];

  /**
   * `key` is only offered on create.
   *
   * The update schema omits it deliberately — it is a join point for code, not
   * content, and changing it would silently disconnect a component from its copy.
   * Rendering the field anyway and having the server reject it would be a worse
   * way to communicate the same rule.
   */
  return isEdit ? rest : [key, ...rest];
}

function SettingsScreen({ adminUser }) {
  const seo = useSingleton('/api/admin/seo');
  const sections = useResource('/api/admin/section-copy', { query: { take: 50 } });
  const { notifySaved } = useToast();

  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirming, setConfirming] = useState(null);

  const fields = useMemo(() => sectionFields(Boolean(editing)), [editing]);

  const usedKeys = new Set(sections.items.map((item) => item.key));
  const missingKeys = SECTION_KEYS.filter((key) => !usedKeys.has(key));

  async function saveSeo(body) {
    await seo.save(body);
    notifySaved('SEO settings saved.');
  }

  async function submitSection(body) {
    if (editing) {
      await sections.update(editing.id, body);
      notifySaved(`${SECTION_LABELS[editing.key] ?? editing.key} updated.`);
    } else {
      const created = await sections.create(body);
      notifySaved(`${SECTION_LABELS[created.key] ?? created.key} added.`);
    }

    setFormOpen(false);
  }

  return (
    <AdminLayout
      title="Settings"
      number="12."
      user={adminUser}
      hint="Site-wide configuration: what search engines and link previews see, and the headings above each section."
    >
      <Box className={`${PANEL} px-5 py-5 mb-10`}>
        <PanelHeading
          title="SEO"
          hint="One record, replaced wholesale on save."
        />

        {seo.error ? (
          <ErrorState message={seo.error} onRetry={seo.reload} />
        ) : seo.loading ? (
          <LoadingRows rows={3} label="Loading SEO settings…" />
        ) : (
          <>
            {!seo.item ? (
              <Typography className={`${HINT} pb-4`}>
                Not configured yet. A title and a description are the two the site
                cannot do without.
              </Typography>
            ) : null}

            <EntityForm
              key={seo.item ? 'loaded' : 'empty'}
              fields={SEO_FIELDS}
              item={seo.item}
              schema={seoSettingsSchema}
              mode="replace"
              columns={2}
              submitLabel="Save SEO settings"
              onSubmit={saveSeo}
            />
          </>
        )}
      </Box>

      <Box className={`${PANEL} px-5 py-5 mb-10`}>
        <PanelHeading
          title="Section headings"
          hint="One row per section of the public page. The order here is the order the sections appear in the nav."
          action={
            <button
              type="button"
              className={BUTTON_SM}
              disabled={missingKeys.length === 0}
              title={
                missingKeys.length === 0
                  ? 'Every section this site renders already has a row'
                  : undefined
              }
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              Add a section
            </button>
          }
        />

        {sections.error ? (
          <ErrorState message={sections.error} onRetry={sections.reload} />
        ) : sections.loading ? (
          <LoadingRows rows={3} label="Loading section headings…" />
        ) : sections.items.length === 0 ? (
          <EmptyState
            title="No section headings yet"
            message="Until these exist the site falls back to the headings hardcoded in each component."
            action={
              <button
                type="button"
                className={BUTTON_SM}
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                Add a section
              </button>
            }
          />
        ) : (
          <>
            {missingKeys.length ? (
              <Box className={`${PANEL} px-4 py-3 mb-4`}>
                <Typography className={HINT}>
                  No row yet for: {missingKeys.map((key) => SECTION_LABELS[key] ?? key).join(', ')}.
                  Those sections keep the heading hardcoded in their component.
                </Typography>
              </Box>
            ) : null}

            <SortableList
              items={sections.items}
              getId={(item) => item.id}
              itemLabel="section"
              onReorder={(ids) => sections.reorder(ids)}
              renderRow={(item) => (
                <Box className="flex flex-wrap items-start justify-between gap-4">
                  <Box className="min-w-0">
                    <Typography className="text-[#d2d2d2] text-sm font-semibold">
                      <span className="text-[#7a61ff]">{item.numberLabel} </span>
                      {item.heading}
                    </Typography>

                    {item.subheading ? (
                      <Typography className={`${HINT} pt-1`}>{item.subheading}</Typography>
                    ) : null}

                    <Box className="flex flex-wrap items-center gap-2 pt-2">
                      <StatusChip status={item.status} />
                      <Flag
                        label={item.key}
                        tone="quiet"
                        title="The key the component looks this row up by"
                      />
                      {item.showInNav ? (
                        <Flag
                          label={item.navLabel ? `Nav: ${item.navLabel}` : 'In nav'}
                          tone="accent"
                          title="Appears in the header navigation"
                        />
                      ) : null}
                      {item.showInNav && !item.anchor ? (
                        <Flag
                          label="No anchor"
                          tone="warning"
                          title="In the nav but with nothing to scroll to — the link will not go anywhere"
                        />
                      ) : null}
                    </Box>
                  </Box>

                  <Box className="flex items-center gap-4 shrink-0">
                    <button
                      type="button"
                      className={LINK_ACTION}
                      disabled={sections.isBusy(item.id)}
                      onClick={() =>
                        sections.publish(item.id, item.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED')
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
                      disabled={sections.isBusy(item.id)}
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
      </Box>

      {/*
        The rebuild control is described rather than offered.

        A button that appears to work and does nothing is worse than no button:
        the user clicks it, sees no change on the public site, and concludes the
        save failed. On-demand revalidation needs `pages/api/revalidate.js` and a
        public site that reads from the database — both Phase 7 — so this says so
        instead.
      */}
      <Box className={`${PANEL} px-5 py-5`}>
        <PanelHeading title="Publishing" />

        <Typography className={HINT}>
          The public site still reads the static files in <code>data/</code>, so
          nothing on this screen changes what a visitor sees yet. Phase 7 switches
          the site over to these records and adds the rebuild control here — until
          then there is nothing for it to rebuild.
        </Typography>
      </Box>

      <EntityFormDialog
        open={formOpen}
        title={editing ? `Edit ${SECTION_LABELS[editing.key] ?? editing.key}` : 'Add a section'}
        onClose={() => setFormOpen(false)}
        fields={fields}
        item={editing}
        schema={editing ? updateSectionCopySchema : createSectionCopySchema}
        mode={editing ? 'update' : 'create'}
        createDefaults={{ order: nextOrder(sections.items) }}
        columns={2}
        onSubmit={submitSection}
      />

      <ConfirmDialog
        open={Boolean(confirming)}
        title="Delete this section heading?"
        message={`The copy for “${confirming?.heading}” will be removed.`}
        consequence="The section itself stays on the site — it falls back to the heading hardcoded in its component."
        onCancel={() => setConfirming(null)}
        onConfirm={async () => {
          const item = confirming;
          setConfirming(null);
          if (await sections.remove(item.id)) notifySaved('Section heading deleted.');
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
export default adminScreen(SettingsScreen);

export const getServerSideProps = withAdminPage();
