import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { signOut } from 'next-auth/react';
import { Rubik } from 'next/font/google';
import { Box, Dialog, DialogActions, DialogContent, DialogTitle, ThemeProvider, Typography } from '@mui/material';

import { adminTheme, BUTTON, BUTTON_QUIET_XS, HINT, PANEL } from '@/lib/adminTheme';
import { setSessionLostHandler } from '@/lib/adminClient';
import { loginUrlFor } from '@/lib/returnPath';

import Sidebar from './Sidebar';
import { ToastProvider } from './Toast';

/**
 * Loaded once, here, rather than in each page.
 *
 * `next/font` must be called at module scope, and every dashboard page calling it
 * separately means the same font declared several times — which is what the
 * public site currently does in three places and Phase 7 consolidates. Starting
 * the dashboard with one instance avoids adding a fourth.
 */
const rubik = Rubik({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });

/**
 * The frame every dashboard screen renders inside.
 *
 * It owns four things that must be identical on every screen, and would not stay
 * identical if each page did them:
 *
 *   * **`noindex`.** A private dashboard has no business in search results, and
 *     the one screen that forgets is the one that gets indexed.
 *   * **The MUI theme.** Without it, a Dialog or Snackbar renders in MUI's
 *     default light palette — a white box on a `#141e30` page.
 *   * **The toast provider**, so `useToast` works from any screen.
 *   * **The expired-session dialog.** A seven-day JWT that can be revoked at any
 *     moment means every screen will eventually meet a 401, and the useful
 *     response is the same everywhere.
 */
export default function AdminLayout({ title, heading, number, hint, user, children, actions }) {
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const [sessionLost, setSessionLost] = useState(null);

  /**
   * Reacts to a 401 from anywhere in the dashboard.
   *
   * A dialog rather than an immediate redirect, deliberately. The session is gone,
   * so nothing on the screen can be saved — but the *content* of a half-written
   * form is still on screen, and bouncing to the login page destroys it without
   * warning. This way the text can be copied out first, and the navigation is a
   * click the user makes.
   */
  useEffect(() => {
    setSessionLostHandler((message) => setSessionLost(message));
    return () => setSessionLostHandler(null);
  }, []);

  const signOutAndReturn = () =>
    signOut({ callbackUrl: loginUrlFor(router.asPath) });

  return (
    <ThemeProvider theme={adminTheme}>
      <ToastProvider>
        <Head>
          <title>{`${title} — Dashboard`}</title>
          <meta name="robots" content="noindex, nofollow" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>

        <Box className={`min-h-screen ${rubik.className}`}>
          {/* Skip link: the nav is ten items, and a keyboard user should not have
              to tab through all of them on every screen to reach the content. */}
          <a
            href="#admin-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-[#233352] focus:text-[#d2d2d2] focus:px-4 focus:py-2"
          >
            Skip to content
          </a>

          <Box className="flex flex-col lg:flex-row">
            <Box
              component="aside"
              id="admin-nav"
              className={`${
                navOpen ? 'block' : 'hidden'
              } lg:block lg:w-56 lg:shrink-0 border-b-2 lg:border-b-0 lg:border-r-2 border-[#d2d2d2]/20 py-6`}
            >
              <Box className="px-4 pb-6">
                <Typography variant="subtitle1" className="font-semibold text-[#7a61ff]">
                  <span>00. </span> Dashboard
                </Typography>
                <Typography className={`${HINT} pt-1 break-words`}>{user?.email}</Typography>
              </Box>

              <Sidebar pathname={router.pathname} onNavigate={() => setNavOpen(false)} />

              <Box className="px-4 pt-8">
                <button type="button" className={BUTTON_QUIET_XS} onClick={signOutAndReturn}>
                  Sign out
                </button>
              </Box>
            </Box>

            <Box component="main" id="admin-content" className="grow min-w-0 px-5 py-6 lg:px-10 lg:py-10">
              <Box className="flex items-start justify-between gap-4 pb-2 lg:hidden">
                <Typography className="text-[#7a61ff] font-semibold">Dashboard</Typography>

                <button
                  type="button"
                  className={BUTTON_QUIET_XS}
                  onClick={() => setNavOpen((open) => !open)}
                  aria-expanded={navOpen}
                  aria-controls="admin-nav"
                >
                  {navOpen ? 'Close menu' : 'Menu'}
                </button>
              </Box>

              <Box className="flex flex-wrap items-end justify-between gap-4 pb-8">
                <Box className="min-w-0">
                  {number ? (
                    <Typography variant="subtitle1" className="font-semibold text-[#7a61ff] pb-1">
                      {number} {title}
                    </Typography>
                  ) : null}

                  <Typography variant="h5" className="font-semibold text-[#d2d2d2]">
                    {heading ?? title}
                  </Typography>

                  {hint ? <Typography className={`${HINT} pt-2 max-w-2xl`}>{hint}</Typography> : null}
                </Box>

                {actions ? <Box className="shrink-0">{actions}</Box> : null}
              </Box>

              {children}
            </Box>
          </Box>
        </Box>

        <Dialog open={Boolean(sessionLost)} aria-labelledby="session-lost-title">
          <DialogTitle id="session-lost-title" sx={{ fontWeight: 600 }}>
            Your session has ended
          </DialogTitle>

          <DialogContent>
            <Typography sx={{ fontSize: '0.9rem' }}>{sessionLost}</Typography>

            <Box className={`${PANEL} px-4 py-3 mt-4`}>
              <Typography className={HINT}>
                Nothing on this screen can be saved until you sign in again. Copy
                anything unsaved before continuing — this page will be replaced by
                the sign-in form.
              </Typography>
            </Box>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 3 }}>
            <button
              type="button"
              className={BUTTON}
              onClick={() => window.location.assign(loginUrlFor(router.asPath))}
            >
              Sign in again
            </button>
          </DialogActions>
        </Dialog>
      </ToastProvider>
    </ThemeProvider>
  );
}

AdminLayout.propTypes = {
  /** Used in the document title and the small accent line above the heading. */
  title: PropTypes.string.isRequired,
  /** The on-screen heading, when it should read differently from the title. */
  heading: PropTypes.string,
  number: PropTypes.string,
  hint: PropTypes.string,
  user: PropTypes.shape({ email: PropTypes.string, name: PropTypes.string }),
  children: PropTypes.node,
  actions: PropTypes.node,
};
