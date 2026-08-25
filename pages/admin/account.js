import { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';

import AdminLayout, { adminScreen } from '@/components/admin/AdminLayout';
import DataTable from '@/components/admin/DataTable';
import { EmptyState, ErrorState, LoadingRows, PanelHeading } from '@/components/admin/States';
import { useSingleton } from '@/components/admin/useResource';
import { useToast } from '@/components/admin/Toast';
import { api, ApiError } from '@/lib/adminClient';
import { withAdminPage } from '@/lib/adminPage';
import {
  BANNER_ERROR,
  BUTTON,
  ERROR_TEXT,
  HINT,
  INPUT,
  INPUT_INVALID,
  LABEL,
  PANEL,
} from '@/lib/adminTheme';
import { formatDateTime } from '@/lib/adminFormat';
import { describePasswordProblem, MIN_PASSWORD_LENGTH } from '@/lib/passwordPolicy';

/**
 * Account — this admin's own details.
 *
 * Not CRUD, and deliberately incapable of being: there is no create, no delete,
 * no list, and nothing here can act on another account. The API has the same
 * shape for the same reason — an endpoint that can edit any admin is an endpoint
 * that only has to be reached once.
 */
function AccountScreen({ adminUser }) {
  const account = useSingleton('/api/admin/account');
  const { notifySaved } = useToast();

  const [signIns, setSignIns] = useState({ items: [], loading: true, error: null });

  /**
   * Recent sign-ins, read from the audit log.
   *
   * Fetched here rather than through `useResource`, which models a collection
   * that can be created in and deleted from — the audit log is append-only and
   * has neither. Both successes and failures are shown: a failed sign-in on an
   * account that only one person uses is worth seeing.
   */
  useEffect(() => {
    let cancelled = false;

    Promise.all([
      api.get('/api/admin/audit?action=login&take=10'),
      api.get('/api/admin/audit?action=login_failed&take=10'),
    ])
      .then(([ok, failed]) => {
        if (cancelled) return;

        const merged = [...(ok?.items ?? []), ...(failed?.items ?? [])]
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 10);

        setSignIns({ items: merged, loading: false, error: null });
      })
      .catch((problem) => {
        if (cancelled || problem?.name === 'AbortError') return;
        setSignIns({ items: [], loading: false, error: problem.message });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const google = account.item?.linkedProviders?.find((entry) => entry.provider === 'google');

  return (
    <AdminLayout
      title="Account"
      number="13."
      user={adminUser}
      hint="Your own sign-in details. Nothing here can act on any other account, because no other account can exist without the CLI."
    >
      <Box className={`${PANEL} px-5 py-5 mb-10`}>
        <PanelHeading title="Who you are" />

        {account.error ? (
          <ErrorState message={account.error} onRetry={account.reload} />
        ) : account.loading ? (
          <LoadingRows rows={2} label="Loading account…" />
        ) : (
          <dl className="m-0">
            {[
              ['Email', account.item?.email],
              ['Name', account.item?.name || '—'],
              ['Role', account.item?.role],
              [
                'Last sign-in',
                account.item?.lastLoginAt ? formatDateTime(account.item.lastLoginAt) : '—',
              ],
              ['Password', account.item?.hasPassword ? 'Set' : 'Not set'],
              [
                'Google',
                google ? `Linked ${formatDateTime(google.linkedAt)}` : 'Not linked',
              ],
            ].map(([label, value]) => (
              <Box key={label} className="flex justify-between gap-4 py-1 border-b border-[#d2d2d2]/10">
                <dt className="text-[#d2d2d2]/60 text-sm">{label}</dt>
                <dd className="text-[#d2d2d2] text-sm m-0 text-right break-all">{value}</dd>
              </Box>
            ))}
          </dl>
        )}
      </Box>

      <Box className={`${PANEL} px-5 py-5 mb-10`}>
        <PanelHeading
          title={account.item?.hasPassword ? 'Change your password' : 'Set a password'}
          hint={
            account.item?.hasPassword
              ? undefined
              : 'This account has only ever signed in with Google. Setting a password gives you a way in if Google is unavailable.'
          }
        />

        {account.loading ? (
          <LoadingRows rows={1} label="Loading…" />
        ) : (
          <PasswordForm
            hasPassword={Boolean(account.item?.hasPassword)}
            onChanged={() => {
              notifySaved('Password changed.');
              account.reload();
            }}
          />
        )}
      </Box>

      <Box className={`${PANEL} px-5 py-5 mb-10`}>
        <PanelHeading title="Sessions" />

        {/*
          There is no session list, and saying so is more useful than an empty
          table. Sessions here are signed JWTs in a cookie, not rows — nothing
          server-side records that a browser is signed in, so nothing can
          enumerate or individually revoke them. What *is* true is the part that
          matters, and it is stronger than a revoke button: every request
          re-checks the account against ADMIN_EMAILS, so removing the address
          ends every session everywhere on the next request.
        */}
        <Typography className={`${HINT} pb-2`}>
          Sessions are signed cookies rather than database rows, so there is no
          list of them to show and no way to end one browser’s session from
          another.
        </Typography>

        <Typography className={HINT}>
          What does work immediately: removing this address from{' '}
          <code>ADMIN_EMAILS</code> in the deployment’s environment ends every
          session everywhere on the next request, because every request re-checks
          the allowlist. Signing out below ends this browser’s session only.
        </Typography>
      </Box>

      <Box className={`${PANEL} px-5 py-5`}>
        <PanelHeading
          title="Recent sign-ins"
          hint="From the audit log. Failed attempts are included — on a single-admin site, one you do not recognise is worth knowing about."
        />

        <DataTable
          caption="Recent sign-in attempts"
          loading={signIns.loading}
          error={signIns.error}
          rows={signIns.items}
          empty={<EmptyState title="No sign-ins recorded yet" />}
          columns={[
            {
              key: 'action',
              header: 'Result',
              render: (row) => (
                <span className={row.action === 'login' ? 'text-[#d2d2d2]' : 'text-[#ff9b9b]'}>
                  {row.action === 'login' ? 'Signed in' : 'Failed'}
                </span>
              ),
            },
            {
              key: 'createdAt',
              header: 'When',
              render: (row) => (
                <Typography className={HINT}>{formatDateTime(row.createdAt)}</Typography>
              ),
            },
            {
              key: 'ip',
              header: 'IP',
              hideOnNarrow: true,
              render: (row) => <span className="font-mono text-xs">{row.ip ?? '—'}</span>,
            },
            {
              key: 'detail',
              header: 'Detail',
              hideOnNarrow: true,
              render: (row) => (
                <Typography className={HINT}>
                  {row.diff?.provider ?? ''}
                  {row.diff?.reason ? ` · ${row.diff.reason}` : ''}
                </Typography>
              ),
            },
          ]}
        />
      </Box>
    </AdminLayout>
  );
}

/**
 * The change-password form.
 *
 * Its own component rather than an `EntityForm`, because a password is not a
 * field of a record: it is never loaded into the form, never diffed against a
 * previous value, and the request body is not the record's shape. Reusing the
 * generic form here would mean teaching it about write-only fields for one case.
 *
 * The rule it applies is imported from `lib/passwordPolicy.js` — the same module
 * the endpoint and both CLI scripts use, so the message about bcrypt's 72-byte
 * limit is worded identically wherever it appears.
 */
function PasswordForm({ hasPassword, onChanged }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [fields, setFields] = useState({});
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  // Live, but only once there is something to judge: telling someone their empty
  // password is too short before they have typed anything is nagging.
  const liveProblem = newPassword ? describePasswordProblem(newPassword) : null;

  async function submit(event) {
    event.preventDefault();
    setFields({});
    setMessage(null);

    const problem = describePasswordProblem(newPassword);

    if (problem) {
      setFields({ newPassword: problem });
      setMessage('That password cannot be used.');
      return;
    }

    // Checked here and nowhere else: the API has no idea what the user typed
    // twice. A mistyped new password with no confirmation field is an account
    // locked out until the CLI is available.
    if (newPassword !== confirmation) {
      setFields({ confirmation: 'The two passwords do not match.' });
      setMessage('The confirmation does not match.');
      return;
    }

    setSaving(true);

    try {
      await api.post('/api/admin/account/password', {
        ...(hasPassword ? { currentPassword } : {}),
        newPassword,
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
      onChanged();
    } catch (problemFromServer) {
      if (problemFromServer instanceof ApiError && problemFromServer.fields) {
        setFields(problemFromServer.fields);
      }
      setMessage(problemFromServer.message);
    } finally {
      setSaving(false);
    }
  }

  const inputClass = (name) => `${INPUT} ${fields[name] ? INPUT_INVALID : ''}`;

  return (
    <form onSubmit={submit} noValidate>
      {message ? (
        <Box role="alert" className={`${BANNER_ERROR} mb-4`}>
          {message}
        </Box>
      ) : null}

      {hasPassword ? (
        <Box className="py-3">
          <label htmlFor="currentPassword" className={LABEL}>
            Current password
          </label>
          <input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            disabled={saving}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className={inputClass('currentPassword')}
          />
          {fields.currentPassword ? (
            <Typography role="alert" className={`${ERROR_TEXT} pt-2`}>
              {fields.currentPassword}
            </Typography>
          ) : (
            <Typography className={`${HINT} pt-2`}>
              Required. It is what stops a stolen session cookie from being used to
              lock you out of your own account permanently.
            </Typography>
          )}
        </Box>
      ) : null}

      <Box className="py-3">
        <label htmlFor="newPassword" className={LABEL}>
          New password
        </label>
        <input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          disabled={saving}
          onChange={(event) => setNewPassword(event.target.value)}
          className={inputClass('newPassword')}
        />
        {fields.newPassword ? (
          <Typography role="alert" className={`${ERROR_TEXT} pt-2`}>
            {fields.newPassword}
          </Typography>
        ) : liveProblem ? (
          <Typography className={`${HINT} pt-2`}>{liveProblem}</Typography>
        ) : (
          <Typography className={`${HINT} pt-2`}>
            At least {MIN_PASSWORD_LENGTH} characters. A few unrelated words beat a
            short scramble on both strength and memorability.
          </Typography>
        )}
      </Box>

      <Box className="py-3">
        <label htmlFor="confirmation" className={LABEL}>
          Confirm new password
        </label>
        <input
          id="confirmation"
          type="password"
          autoComplete="new-password"
          value={confirmation}
          disabled={saving}
          onChange={(event) => setConfirmation(event.target.value)}
          className={inputClass('confirmation')}
        />
        {fields.confirmation ? (
          <Typography role="alert" className={`${ERROR_TEXT} pt-2`}>
            {fields.confirmation}
          </Typography>
        ) : null}
      </Box>

      <Box className="pt-4">
        <button type="submit" className={BUTTON} disabled={saving || !newPassword}>
          {saving ? 'Saving…' : hasPassword ? 'Change password' : 'Set password'}
        </button>
      </Box>

      <Typography className={`${HINT} pt-4`}>
        Forgotten it entirely? Recovery is by CLI —{' '}
        <code>npm run admin:reset-password</code> — which needs terminal access to
        the deployment rather than an email inbox.
      </Typography>
    </form>
  );
}

/**
 * Wrapped so the theme and the toast provider sit *above* this component.
 * Rendering them from inside it would put them below every hook it calls —
 * see the note on `adminScreen`.
 */
export default adminScreen(AccountScreen);

export const getServerSideProps = withAdminPage();
