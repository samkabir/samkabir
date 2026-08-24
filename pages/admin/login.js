import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { signIn } from 'next-auth/react';
import { Box, Typography } from '@mui/material';
import { Rubik } from 'next/font/google';

import { getSessionUser } from '@/lib/auth';
import { safeReturnPath } from '@/lib/returnPath';

const rubikFont = Rubik({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });

/**
 * NextAuth error codes, translated.
 *
 * The raw codes arrive in the query string after a failed OAuth round trip.
 * `AccessDenied` is the one that matters most and is the vaguest: it is what the
 * `signIn` callback returns for an address that is not on the allowlist. The
 * message deliberately does not confirm or deny whether an account exists for
 * the address — it says the same thing either way.
 */
const ERROR_MESSAGES = {
  AccessDenied: 'That account is not permitted to sign in here.',
  OAuthAccountNotLinked: 'That account is not permitted to sign in here.',
  OAuthSignin: 'Could not reach Google. Try again, or use your password.',
  OAuthCallback: 'Google sign-in did not complete. Try again, or use your password.',
  Configuration:
    'Sign-in is misconfigured on the server. Check GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and NEXTAUTH_SECRET.',
  SessionRequired: 'Please sign in to continue.',
  Verification: 'That sign-in link is no longer valid.',
};

const describeError = (code) =>
  !code ? null : ERROR_MESSAGES[code] ?? 'Sign-in failed. Try again.';

export default function AdminLogin() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  const returnPath = safeReturnPath(router.query.from);
  const message = error ?? describeError(router.query.error);

  async function handleCredentials(event) {
    event.preventDefault();
    setError(null);
    setBusy('credentials');

    // `redirect: false` so the error comes back here as a value instead of a
    // page load with a code in the query string. It also keeps whatever the user
    // typed in the form, which matters when the failure is a typo.
    const result = await signIn('credentials', { email, password, redirect: false });

    if (result?.ok) {
      // replace, not push: the login page should not be in the back history of a
      // signed-in session.
      router.replace(returnPath);
      return;
    }

    // The message from `authorize` — either "Incorrect email or password." or the
    // rate-limit notice, which says how long to wait.
    setError(result?.error ?? 'Sign-in failed. Try again.');
    setPassword('');
    setBusy(null);
  }

  const inputClass =
    'w-full bg-transparent border-2 border-[#d2d2d2]/30 focus:border-[#7a61ff] outline-none ' +
    'text-[#d2d2d2] px-4 py-3 transition duration-300';

  const buttonClass =
    'w-full transform transition duration-500 border-2 border-[#7a61ff] py-3 px-6 ' +
    'font-semibold text-[#7a61ff] hover:text-[#000] hover:bg-[#7a61ff] normal-case ' +
    'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent ' +
    'disabled:hover:text-[#7a61ff]';

  return (
    <>
      <Head>
        <title>Sign in — Samiul Kabir</title>
        {/* A private page has no business in search results. */}
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <Box className="min-h-screen flex flex-col justify-center items-center px-6 py-16">
        <Box className={`w-full max-w-md ${rubikFont.className}`}>
          <Typography variant="subtitle1" className="font-semibold text-[#7a61ff] pb-2">
            <span className="text-[#7a61ff]">00. </span> Dashboard
          </Typography>

          <Typography variant="h4" className="font-semibold text-[#d2d2d2] pb-8">
            Sign in
          </Typography>

          {message ? (
            <Box
              role="alert"
              className="border-2 border-[#ff6b6b] text-[#ff9b9b] px-4 py-3 mb-6 text-sm"
            >
              {message}
            </Box>
          ) : null}

          <form onSubmit={handleCredentials} noValidate>
            <label htmlFor="email" className="block text-[#d2d2d2] text-sm pb-2">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
            />

            <label htmlFor="password" className="block text-[#d2d2d2] text-sm pt-5 pb-2">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClass}
            />

            <Box className="pt-8">
              <button type="submit" disabled={busy !== null} className={buttonClass}>
                {busy === 'credentials' ? 'Signing in…' : 'Sign in'}
              </button>
            </Box>
          </form>

          <Box className="flex items-center gap-4 py-8">
            <span className="h-px flex-1 bg-[#d2d2d2]/20" />
            <span className="text-[#d2d2d2]/60 text-xs uppercase tracking-widest">or</span>
            <span className="h-px flex-1 bg-[#d2d2d2]/20" />
          </Box>

          <button
            type="button"
            disabled={busy !== null}
            onClick={() => {
              setBusy('google');
              // A full redirect here, unlike the credentials path: the OAuth
              // round trip has to leave the page, and NextAuth sends the user
              // back with `?error=` on failure, which `describeError` renders.
              signIn('google', { callbackUrl: returnPath });
            }}
            className={buttonClass}
          >
            {busy === 'google' ? 'Redirecting…' : 'Continue with Google'}
          </button>

          <Typography className="text-[#d2d2d2]/50 text-xs pt-10 leading-relaxed">
            Both methods are restricted to a configured address. Forgotten password
            recovery is by CLI — see the project docs.
          </Typography>
        </Box>
      </Box>
    </>
  );
}

/**
 * Sends an already-signed-in visitor straight to the dashboard.
 *
 * Uses the same `getSessionUser` the API does, so "signed in" means the same
 * thing here as it does at every endpoint — including the allowlist re-check. A
 * client-side `useSession` check would trust the cookie alone and show the
 * dashboard link to someone whose address had been removed.
 */
export async function getServerSideProps({ req, res, query }) {
  const user = await getSessionUser(req, res);

  if (user) {
    return { redirect: { destination: safeReturnPath(query.from), permanent: false } };
  }

  return { props: {} };
}
