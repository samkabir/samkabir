import Head from 'next/head';
import { signOut } from 'next-auth/react';
import { Box, Typography } from '@mui/material';
import { Rubik } from 'next/font/google';

import { getSessionUser } from '@/lib/auth';

const rubikFont = Rubik({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });

/**
 * Placeholder dashboard.
 *
 * Phase 6 replaces this with the real thing — Overview, Experiences, Projects,
 * Skills, Bio, Links, CV, Blogs, Settings, Account. It exists now for one
 * reason: without a page behind the login, there is no way to confirm by hand
 * that signing in actually works, and "the tests pass" is a weaker claim than
 * "I signed in and saw my own email".
 *
 * Deliberately minimal rather than a half-built dashboard. A stub that looks
 * finished is harder to notice than one that says what it is.
 */
export default function AdminHome({ user, counts }) {
  return (
    <>
      <Head>
        <title>Dashboard — Samiul Kabir</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <Box className="min-h-screen px-6 py-16 flex flex-col items-center">
        <Box className={`w-full max-w-2xl ${rubikFont.className}`}>
          <Typography variant="subtitle1" className="font-semibold text-[#7a61ff] pb-2">
            <span className="text-[#7a61ff]">00. </span> Dashboard
          </Typography>

          <Typography variant="h4" className="font-semibold text-[#d2d2d2] pb-2">
            Signed in
          </Typography>

          <Typography className="text-[#d2d2d2]/70 pb-10">
            {user.email}
            {user.lastLoginAt ? ` — last sign-in ${user.lastLoginAt}` : ''}
          </Typography>

          <Box className="border-2 border-[#d2d2d2]/20 p-6 mb-10">
            <Typography className="text-[#d2d2d2] font-semibold pb-4">
              Content in the database
            </Typography>

            {Object.entries(counts).map(([label, count]) => (
              <Box key={label} className="flex justify-between py-1">
                <span className="text-[#d2d2d2]/70 text-sm">{label}</span>
                <span className="text-[#7a61ff] text-sm font-semibold">{count}</span>
              </Box>
            ))}

            <Typography className="text-[#d2d2d2]/50 text-xs pt-4 leading-relaxed">
              All zero until Phase 7 imports the existing content from the static
              files. The editing screens arrive in Phase 6.
            </Typography>
          </Box>

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/admin/login' })}
            className="transform transition duration-500 border-2 border-[#7a61ff] py-2 px-6 font-semibold text-[#7a61ff] hover:text-[#000] hover:bg-[#7a61ff] normal-case"
          >
            Sign out
          </button>
        </Box>
      </Box>
    </>
  );
}

/**
 * Authorises server-side and loads the counts.
 *
 * `middleware.js` has already redirected anonymous visitors, but this check is
 * not redundant: middleware only inspects the JWT, because it runs on the edge
 * runtime where Prisma cannot. The account-still-exists and still-allowlisted
 * checks can only happen here. Middleware is the convenience; this is the
 * boundary.
 */
export async function getServerSideProps({ req, res }) {
  const user = await getSessionUser(req, res);

  if (!user) {
    return { redirect: { destination: '/admin/login', permanent: false } };
  }

  const { prisma } = await import('@/lib/prisma');

  const [experiences, projects, skills, posts, media] = await Promise.all([
    prisma.experience.count(),
    prisma.project.count(),
    prisma.skill.count(),
    prisma.blogPost.count(),
    prisma.media.count(),
  ]);

  return {
    props: {
      // Serialised explicitly rather than passed through: `lastLoginAt` is a
      // Date, and Next cannot serialise one into props.
      user: {
        email: user.email,
        name: user.name ?? null,
        lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString().slice(0, 16).replace('T', ' ') : null,
      },
      counts: { Experiences: experiences, Projects: projects, Skills: skills, 'Blog posts': posts, Media: media },
    },
  };
}
