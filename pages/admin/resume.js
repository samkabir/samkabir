import { useState } from 'react';
import { Box, Typography } from '@mui/material';

import AdminLayout, { adminScreen } from '@/components/admin/AdminLayout';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import DataTable from '@/components/admin/DataTable';
import EntityForm from '@/components/admin/EntityForm';
import { Flag } from '@/components/admin/StatusChip';
import { EmptyState, PanelHeading } from '@/components/admin/States';
import { useResource } from '@/components/admin/useResource';
import { useToast } from '@/components/admin/Toast';
import { api } from '@/lib/adminClient';
import { withAdminPage } from '@/lib/adminPage';
import { HINT, LINK_ACTION, LINK_DANGER, PANEL } from '@/lib/adminTheme';
import { formatBytes, formatDateTime } from '@/lib/adminFormat';
import { createResumeSchema } from '@/lib/validation/resume';

/**
 * CV versions.
 *
 * Uploading a CV does not replace anything: it adds a row, and the row becomes
 * live only when it is activated. That is the whole point of the design — the
 * previous version stays downloadable, and a bad upload is undone by activating
 * the old one rather than by finding a backup.
 *
 * `/cv` is the link that goes on an actual CV, so it never changes. It redirects
 * to whichever version is active, which is why activation is a separate,
 * deliberate action rather than a side effect of uploading.
 */
const UPLOAD_FIELDS = [
  {
    name: 'mediaId',
    mediaKey: 'media',
    label: 'CV file',
    type: 'file',
    accept: 'application/pdf',
    hint: 'PDF only, up to 4 MB. The file is checked by its bytes, not its extension — a renamed document is refused.',
  },
  {
    name: 'label',
    label: 'Label',
    type: 'text',
    required: true,
    max: 120,
    placeholder: 'CV — August 2026',
    hint: 'How this version is listed here. Not shown publicly.',
  },
];

function ResumeScreen({ adminUser }) {
  const resumes = useResource('/api/admin/resumes', { query: { take: 100 }, position: 'start' });
  const { notifySaved } = useToast();

  const [confirming, setConfirming] = useState(null);
  const [formKey, setFormKey] = useState(0);

  const active = resumes.items.find((item) => item.isActive) ?? null;

  async function addVersion(body) {
    const created = await resumes.create(body);
    // Remounts the form so the file field and label are empty for the next
    // upload, rather than still showing the file that was just added.
    setFormKey((key) => key + 1);
    notifySaved(`Version ${created.version} added — activate it to put it on the site.`);
  }

  const activate = (resume) =>
    resumes.run(
      // Exactly one version is active, so activating this one deactivates the
      // rest. Applied locally in the same shape the server applies it in, or the
      // list would briefly show two live CVs.
      (current) =>
        current.map((item) => ({ ...item, isActive: item.id === resume.id })),
      () => api.post(`/api/admin/resumes/${resume.id}/activate`),
      { id: resume.id }
    );

  return (
    <AdminLayout
      title="CV"
      number="04."
      user={adminUser}
      hint="Versioned uploads. The public /cv link always serves whichever version is active."
    >
      <Box className={`${PANEL} px-5 py-5 mb-10`}>
        <PanelHeading title="The public link" />

        {active ? (
          <>
            <Typography className="text-[#d2d2d2] text-sm pb-2">
              <a
                href="/cv"
                target="_blank"
                rel="noreferrer"
                className="text-[#7a61ff] underline break-all"
              >
                /cv
              </a>{' '}
              currently serves <strong>{active.label}</strong> (version {active.version}).
            </Typography>

            <Typography className={HINT}>
              This URL never changes. Activating a different version below changes
              what it serves, and every link already shared keeps working.
            </Typography>
          </>
        ) : (
          <Typography className={HINT}>
            No version is active, so <code>/cv</code> returns a 404 — uncached, so
            it starts working the moment one is activated.
          </Typography>
        )}
      </Box>

      <Box className={`${PANEL} px-5 py-5 mb-10`}>
        <PanelHeading
          title="Upload a new version"
          hint="Adding a version does not put it on the site. Activate it when you are happy with it."
        />

        <EntityForm
          key={formKey}
          fields={UPLOAD_FIELDS}
          schema={createResumeSchema}
          mode="create"
          submitLabel="Add version"
          onSubmit={addVersion}
        />
      </Box>

      <Box className={`${PANEL} px-5 py-5`}>
        <PanelHeading title="Versions" hint="Newest first." />

        <DataTable
          caption="Uploaded CV versions"
          loading={resumes.loading}
          error={resumes.error}
          onRetry={resumes.reload}
          rows={resumes.items}
          empty={
            <EmptyState
              title="No CV uploaded yet"
              message="Upload a PDF above, then activate it to make /cv work."
            />
          }
          columns={[
            {
              key: 'version',
              header: 'Version',
              render: (row) => (
                <Box className="flex items-center gap-2">
                  <span className="font-mono">{row.version}</span>
                  {row.isActive ? (
                    <Flag label="Live" tone="accent" title="This is what /cv serves" />
                  ) : null}
                </Box>
              ),
            },
            { key: 'label', header: 'Label', render: (row) => row.label },
            {
              key: 'file',
              header: 'File',
              hideOnNarrow: true,
              render: (row) =>
                row.media ? (
                  <Box>
                    <a
                      href={row.media.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#7a61ff] underline"
                    >
                      open
                    </a>
                    <Typography className={HINT}>{formatBytes(row.media.sizeBytes)}</Typography>
                  </Box>
                ) : (
                  <Typography className={HINT}>missing</Typography>
                ),
            },
            {
              key: 'uploadedAt',
              header: 'Uploaded',
              hideOnNarrow: true,
              render: (row) => (
                <Typography className={HINT}>{formatDateTime(row.uploadedAt)}</Typography>
              ),
            },
          ]}
          actions={(row) => (
            <Box className="flex items-center justify-end gap-4">
              {row.isActive ? null : (
                <button
                  type="button"
                  className={LINK_ACTION}
                  disabled={resumes.isBusy(row.id)}
                  onClick={() => activate(row)}
                >
                  activate
                </button>
              )}

              <button
                type="button"
                className={LINK_DANGER}
                disabled={resumes.isBusy(row.id) || row.isActive}
                title={row.isActive ? 'Activate a different version before deleting this one' : undefined}
                onClick={() => setConfirming(row)}
              >
                delete
              </button>
            </Box>
          )}
        />
      </Box>

      <ConfirmDialog
        open={Boolean(confirming)}
        title="Delete this version?"
        message={`“${confirming?.label}” (version ${confirming?.version}) will be removed.`}
        consequence="The PDF itself stays in the media library — the row and the file are deleted separately, and the file is only removed once nothing refers to it."
        onCancel={() => setConfirming(null)}
        onConfirm={async () => {
          const item = confirming;
          setConfirming(null);
          if (await resumes.remove(item.id)) notifySaved(`Version ${item.version} deleted.`);
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
export default adminScreen(ResumeScreen);

export const getServerSideProps = withAdminPage();
