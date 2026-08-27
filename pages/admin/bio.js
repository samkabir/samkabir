import { useState } from 'react';
import { Box, Typography } from '@mui/material';

import AdminLayout, { adminScreen } from '@/components/admin/AdminLayout';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import EntityForm, { EntityFormDialog } from '@/components/admin/EntityForm';
import SortableList from '@/components/admin/SortableList';
import StatusChip from '@/components/admin/StatusChip';
import { EmptyState, ErrorState, LoadingRows, PanelHeading } from '@/components/admin/States';
import { useResource, useSingleton } from '@/components/admin/useResource';
import { useToast } from '@/components/admin/Toast';
import { withAdminPage } from '@/lib/adminPage';
import { BUTTON_SM, HINT, LINK_ACTION, LINK_DANGER, PANEL } from '@/lib/adminTheme';
import { nextOrder } from '@/lib/adminList';
import { formatYearRange } from '@/lib/adminFormat';
import { profileSchema } from '@/lib/validation/profile';
import { createEducationSchema, updateEducationSchema } from '@/lib/validation/education';

/**
 * Bio — the identity block, plus education.
 *
 * Two panels on one screen because they answer the same question ("who is this
 * site about") and are edited in the same sitting, but they are different shapes:
 * the profile is a single row upserted with `PUT`, education is an ordered
 * collection. Nothing is shared between them except the page.
 *
 * The profile fields are the ones currently hardcoded across MainComponent,
 * AboutMe, Contact, SocialMediaLinks and Footer. Phase 7 is what makes the site
 * read them; until then this screen fills the database and the site is unchanged.
 */
const PROFILE_FIELDS = [
  {
    name: 'greeting',
    label: 'Greeting',
    type: 'text',
    required: true,
    max: 80,
    placeholder: 'Hi, This is',
    hint: 'The small line above the name.',
  },
  { name: 'fullName', label: 'Full name', type: 'text', required: true, max: 120 },
  {
    name: 'headline',
    label: 'Headline',
    type: 'text',
    required: true,
    max: 200,
    fullWidth: true,
    hint: 'The animated line under the name — “I Forge Web Designs for the Digital space.”',
  },
  {
    name: 'bio',
    label: 'About text',
    type: 'textarea',
    required: true,
    rows: 8,
    max: 5000,
    fullWidth: true,
    hint: 'The prose in the About section.',
  },
  {
    name: 'publicEmail',
    label: 'Public email',
    type: 'text',
    inputType: 'email',
    required: true,
    hint: 'Displayed on the site and used by the mailto: links.',
  },
  {
    name: 'contactEmail',
    label: 'Contact email',
    type: 'text',
    inputType: 'email',
    hint: 'Where a contact form would deliver, if that differs from the address on display. Leave empty to use the public one.',
  },
  {
    name: 'leetcodeUsername',
    label: 'LeetCode username',
    type: 'text',
    max: 80,
  },
  {
    name: 'showLeetcode',
    label: 'Show the LeetCode stats',
    type: 'checkbox',
  },
  {
    name: 'footerCredit',
    label: 'Footer credit',
    type: 'text',
    required: true,
    max: 200,
    fullWidth: true,
    placeholder: 'Designed & Built By Samiul Kabir',
  },
  { name: 'attributionLabel', label: 'Attribution label', type: 'text', max: 120 },
  { name: 'attributionUrl', label: 'Attribution URL', type: 'text', inputType: 'url' },
  {
    name: 'avatarMediaId',
    mediaKey: 'avatarMedia',
    label: 'Avatar',
    type: 'image',
    fullWidth: true,
    hint: 'Optional. Used where the site shows a portrait.',
  },
];

const EDUCATION_FIELDS = [
  { name: 'institution', label: 'Institution', type: 'text', required: true, max: 200, fullWidth: true },
  { name: 'degree', label: 'Degree', type: 'text', max: 200 },
  { name: 'field', label: 'Field of study', type: 'text', max: 200 },
  {
    name: 'note',
    label: 'Note',
    type: 'text',
    max: 500,
    fullWidth: true,
    placeholder: 'under Pearson Edexcel Education',
  },
  { name: 'startYear', label: 'Start year', type: 'year', min: 1900, max: 2100 },
  { name: 'endYear', label: 'End year', type: 'year', min: 1900, max: 2100 },
];

function BioScreen({ adminUser }) {
  const profile = useSingleton('/api/admin/profile');
  const education = useResource('/api/admin/education', { query: { take: 100 } });
  const { notifySaved } = useToast();

  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirming, setConfirming] = useState(null);

  async function saveProfile(body) {
    await profile.save(body);
    notifySaved('Bio saved.');
  }

  async function submitEducation(body) {
    if (editing) {
      await education.update(editing.id, body);
      notifySaved(`${editing.institution} updated.`);
    } else {
      const created = await education.create(body);
      notifySaved(`${created.institution} added.`);
    }

    setFormOpen(false);
  }

  return (
    <AdminLayout
      title="Bio"
      number="01."
      user={adminUser}
      hint="The identity block the site reads for its hero, About section, contact details and footer."
    >
      <Box className={`${PANEL} px-5 py-5 mb-10`}>
        <PanelHeading
          title="Profile"
          hint="One record. Saving replaces it wholesale, which is why every field is required to be present even when it is empty."
        />

        {profile.error ? (
          <ErrorState message={profile.error} onRetry={profile.reload} />
        ) : profile.loading ? (
          <LoadingRows rows={3} label="Loading profile…" />
        ) : (
          <>
            {!profile.item ? (
              <Typography className={`${HINT} pb-4`}>
                Nothing saved yet — this is a fresh database. Fill the form in and
                save to create the record.
              </Typography>
            ) : null}

            <EntityForm
              // Remounts once the record arrives, so the fetched values seed the
              // form rather than an empty one being left on screen.
              key={profile.item ? 'loaded' : 'empty'}
              fields={PROFILE_FIELDS}
              item={profile.item}
              schema={profileSchema}
              mode="replace"
              columns={2}
              submitLabel="Save bio"
              onSubmit={saveProfile}
            />
          </>
        )}
      </Box>

      <Box className={`${PANEL} px-5 py-5`}>
        <PanelHeading
          title="Education"
          hint="Listed in this order on the CV section. Drag or use the arrows to change it."
          action={
            <button
              type="button"
              className={BUTTON_SM}
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              Add education
            </button>
          }
        />

        {education.error ? (
          <ErrorState message={education.error} onRetry={education.reload} />
        ) : education.loading ? (
          <LoadingRows rows={2} label="Loading education…" />
        ) : education.items.length === 0 ? (
          <EmptyState
            title="No education entries yet"
            message="Institution is the only required field — the rest of a row can be filled in later."
            action={
              <button
                type="button"
                className={BUTTON_SM}
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                Add education
              </button>
            }
          />
        ) : (
          <SortableList
            items={education.items}
            getId={(item) => item.id}
            itemLabel="entry"
            onReorder={(ids) => education.reorder(ids)}
            renderRow={(item) => (
              <Box className="flex flex-wrap items-start justify-between gap-4">
                <Box className="min-w-0">
                  <Typography className="text-[#d2d2d2] text-sm font-semibold">
                    {item.institution}
                  </Typography>

                  <Typography className={`${HINT} pt-1`}>
                    {[item.degree, item.field].filter(Boolean).join(', ')}
                    {item.degree || item.field ? ' · ' : ''}
                    {formatYearRange(item.startYear, item.endYear)}
                  </Typography>

                  {item.note ? (
                    <Typography className={`${HINT} pt-1 italic`}>{item.note}</Typography>
                  ) : null}

                  <Box className="pt-2">
                    <StatusChip status={item.status} />
                  </Box>
                </Box>

                <Box className="flex items-center gap-4 shrink-0">
                  <button
                    type="button"
                    className={LINK_ACTION}
                    disabled={education.isBusy(item.id)}
                    onClick={() =>
                      education.publish(item.id, item.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED')
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
                    disabled={education.isBusy(item.id)}
                    onClick={() => setConfirming(item)}
                  >
                    delete
                  </button>
                </Box>
              </Box>
            )}
          />
        )}
      </Box>

      <EntityFormDialog
        open={formOpen}
        title={editing ? `Edit ${editing.institution}` : 'Add education'}
        onClose={() => setFormOpen(false)}
        fields={EDUCATION_FIELDS}
        item={editing}
        schema={editing ? updateEducationSchema : createEducationSchema}
        mode={editing ? 'update' : 'create'}
        createDefaults={{ order: nextOrder(education.items) }}
        columns={2}
        onSubmit={submitEducation}
      />

      <ConfirmDialog
        open={Boolean(confirming)}
        title="Delete this entry?"
        message={`“${confirming?.institution}” will be removed from the database.`}
        onCancel={() => setConfirming(null)}
        onConfirm={async () => {
          const item = confirming;
          setConfirming(null);
          if (await education.remove(item.id)) notifySaved(`${item.institution} deleted.`);
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
export default adminScreen(BioScreen);

export const getServerSideProps = withAdminPage();
