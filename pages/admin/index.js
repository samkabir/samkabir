import Link from 'next/link';
import { Box, Typography } from '@mui/material';

import AdminLayout, { adminScreen } from '@/components/admin/AdminLayout';
import { EmptyState, PanelHeading } from '@/components/admin/States';
import { Flag } from '@/components/admin/StatusChip';
import { withAdminPage } from '@/lib/adminPage';
import { HINT, PANEL } from '@/lib/adminTheme';
import { describeAuditEntry, formatDateTime } from '@/lib/adminFormat';

/**
 * Overview — what is in the database, and what changed recently.
 *
 * Rendered on the server rather than fetched after mount, unlike every other
 * screen. The difference is deliberate: this page is a dozen counts and a short
 * feed, all of it read-only. Fetching it client-side would mean ten requests, ten
 * loading states and a page that assembles itself in front of the user, to
 * produce something a single pipelined transaction returns before the HTML is
 * sent. The CRUD screens fetch client-side because their data changes while you
 * look at it; this one does not.
 */
const SECTIONS = [
  { key: 'experiences', label: 'Experience', href: '/admin/experiences' },
  { key: 'projects', label: 'Projects', href: '/admin/projects' },
  { key: 'skills', label: 'Skills', href: '/admin/skills' },
  { key: 'education', label: 'Education', href: '/admin/bio' },
  { key: 'socialLinks', label: 'Links', href: '/admin/links' },
  { key: 'sections', label: 'Section headings', href: '/admin/settings' },
  { key: 'posts', label: 'Blog posts', href: '/admin/blogs' },
  { key: 'tags', label: 'Tags', href: '/admin/blogs' },
  { key: 'resumes', label: 'CV versions', href: '/admin/resume' },
  // No link: uploaded files have no screen of their own. They are created by the
  // upload field wherever an image or a CV is attached, and swept up by
  // `npm run media:prune`. Linking this to a screen that does not manage them
  // would be a worse answer than none.
  { key: 'media', label: 'Uploaded files', href: null },
];

function Overview({ adminUser, counts, drafts, activeResume, recent, todo }) {
  const totalRecords = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const totalDrafts = Object.values(drafts).reduce((sum, count) => sum + count, 0);

  return (
    <AdminLayout
      title="Overview"
      number="00."
      heading={`Signed in as ${adminUser.email}`}
      user={adminUser}
      hint={
        adminUser.lastLoginAt
          ? `Last sign-in ${formatDateTime(adminUser.lastLoginAt)}.`
          : 'This is your first sign-in.'
      }
    >
      {todo.length ? (
        <Box className={`${PANEL} px-5 py-5 mb-10`}>
          <PanelHeading
            title="Before the site can use this"
            hint="Phase 7 switches the public site over to these records. Until each of these exists, that section would have nothing to read."
          />

          <ul className="list-none p-0 m-0">
            {todo.map((task) => (
              <li key={task.href} className="flex flex-wrap items-baseline gap-2 py-1">
                <Link href={task.href} className="text-[#7a61ff] underline text-sm">
                  {task.label}
                </Link>
                <Typography className={HINT}>{task.why}</Typography>
              </li>
            ))}
          </ul>
        </Box>
      ) : null}

      <Box className={`${PANEL} px-5 py-5 mb-10`}>
        <PanelHeading
          title="Content"
          hint={`${totalRecords} records, ${totalDrafts} of them hidden from the site.`}
        />

        <Box className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
          {SECTIONS.map((section) => (
            <Box
              key={section.key}
              className="flex items-baseline justify-between gap-3 py-2 border-b border-[#d2d2d2]/10"
            >
              {section.href ? (
                <Link
                  href={section.href}
                  className="text-[#d2d2d2]/80 text-sm hover:text-[#d2d2d2] underline"
                >
                  {section.label}
                </Link>
              ) : (
                <span className="text-[#d2d2d2]/80 text-sm">{section.label}</span>
              )}

              <Box className="flex items-baseline gap-2 shrink-0">
                {drafts[section.key] ? (
                  <Typography className={HINT}>{drafts[section.key]} draft</Typography>
                ) : null}
                <span className="text-[#7a61ff] text-sm font-semibold">
                  {counts[section.key]}
                </span>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      <Box className={`${PANEL} px-5 py-5 mb-10`}>
        <PanelHeading title="The CV link" />

        {activeResume ? (
          <Typography className="text-[#d2d2d2] text-sm">
            <a href="/cv" target="_blank" rel="noreferrer" className="text-[#7a61ff] underline">
              /cv
            </a>{' '}
            serves <strong>{activeResume.label}</strong> (version {activeResume.version}),
            uploaded {formatDateTime(activeResume.uploadedAt)}.
          </Typography>
        ) : (
          <Typography className={HINT}>
            No CV is active, so <code>/cv</code> returns a 404.{' '}
            <Link href="/admin/resume" className="text-[#7a61ff] underline">
              Upload one
            </Link>
            .
          </Typography>
        )}
      </Box>

      <Box className={`${PANEL} px-5 py-5 mb-10`}>
        <PanelHeading
          title="Recent changes"
          hint="From the audit log, which records every change the dashboard makes — inside the same transaction as the change itself."
        />

        {recent.length === 0 ? (
          <EmptyState title="Nothing recorded yet" message="Every edit you make will appear here." />
        ) : (
          <ul className="list-none p-0 m-0">
            {recent.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-baseline justify-between gap-3 py-2 border-b border-[#d2d2d2]/10"
              >
                <Typography className="text-[#d2d2d2] text-sm">
                  {describeAuditEntry(entry)}
                </Typography>

                <Typography className={`${HINT} shrink-0`}>
                  {formatDateTime(entry.createdAt)}
                </Typography>
              </li>
            ))}
          </ul>
        )}
      </Box>

      <Box className={`${PANEL} px-5 py-5`}>
        <PanelHeading title="Publishing" />

        <Box className="flex flex-wrap items-center gap-3 pb-3">
          <Flag label="Static" tone="warning" title="The public site is not reading the database yet" />
          <Typography className={HINT}>Last rebuild: not tracked yet.</Typography>
        </Box>

        <Typography className={HINT}>
          The public site still renders from the files in <code>data/</code>, so
          nothing here is live to a visitor and nothing here can break the site.
          Phase 7 seeds the database from those files, switches each section over,
          and adds the rebuild control — which is when a “last rebuild” timestamp
          starts having something to describe.
        </Typography>
      </Box>
    </AdminLayout>
  );
}

/**
 * Everything the page shows, in one pipelined transaction.
 *
 * `$transaction` with an array sends the whole batch in a single round trip. That
 * matters more than usual here: Neon's free tier suspends an idle database, so
 * the first query after a quiet period pays the wake-up cost — once, rather than
 * twenty times in sequence.
 */
/**
 * Wrapped so the theme and the toast provider sit *above* this component.
 * Rendering them from inside it would put them below every hook it calls —
 * see the note on `adminScreen`.
 */
export default adminScreen(Overview);

export const getServerSideProps = withAdminPage(async () => {
  const { prisma } = await import('@/lib/prisma');

  const draft = { where: { status: 'DRAFT' } };

  const [
    experiences,
    projects,
    skills,
    education,
    socialLinks,
    sections,
    posts,
    tags,
    resumes,
    media,
    draftExperiences,
    draftProjects,
    draftSkills,
    draftEducation,
    draftSocialLinks,
    draftSections,
    draftPosts,
    activeResume,
    profile,
    seo,
    recent,
  ] = await prisma.$transaction([
    prisma.experience.count(),
    prisma.project.count(),
    prisma.skill.count(),
    prisma.education.count(),
    prisma.socialLink.count(),
    prisma.sectionCopy.count(),
    prisma.blogPost.count(),
    prisma.tag.count(),
    prisma.resume.count(),
    prisma.media.count(),

    prisma.experience.count(draft),
    prisma.project.count(draft),
    prisma.skill.count(draft),
    prisma.education.count(draft),
    prisma.socialLink.count(draft),
    prisma.sectionCopy.count(draft),
    prisma.blogPost.count(draft),

    prisma.resume.findFirst({
      where: { isActive: true },
      select: { label: true, version: true, uploadedAt: true },
    }),

    prisma.profile.findUnique({ where: { id: 'singleton' }, select: { id: true } }),
    prisma.seoSettings.findUnique({ where: { id: 'singleton' }, select: { id: true } }),

    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, action: true, entity: true, entityId: true, diff: true, createdAt: true },
    }),
  ]);

  const counts = { experiences, projects, skills, education, socialLinks, sections, posts, tags, resumes, media };

  const drafts = {
    experiences: draftExperiences,
    projects: draftProjects,
    skills: draftSkills,
    education: draftEducation,
    socialLinks: draftSocialLinks,
    sections: draftSections,
    posts: draftPosts,
    tags: 0,
    resumes: 0,
    media: 0,
  };

  /**
   * What is missing that the public site will need.
   *
   * Only the things whose absence would leave a section of the site with nothing
   * to render — not a nag list. Each entry says why it matters rather than just
   * naming a screen.
   */
  const todo = [
    !profile && {
      href: '/admin/bio',
      label: 'Add your bio',
      why: '— the hero, About section, contact details and footer all read from it.',
    },
    !seo && {
      href: '/admin/settings',
      label: 'Set the SEO defaults',
      why: '— the page title and the description shown in search results.',
    },
    experiences === 0 && {
      href: '/admin/experiences',
      label: 'Add your experience',
      why: '— both the full-time and contractual sections read from one list.',
    },
    projects === 0 && {
      href: '/admin/projects',
      label: 'Add a project',
      why: '— the homepage shows the first three featured ones.',
    },
    skills === 0 && { href: '/admin/skills', label: 'Add your skills', why: '— the Skills section.' },
    resumes === 0 && {
      href: '/admin/resume',
      label: 'Upload a CV',
      why: '— until one is active, /cv returns a 404.',
    },
  ].filter(Boolean);

  return {
    props: {
      counts,
      drafts,
      todo,
      // Dates cannot be serialised into props, so every one is a string by the
      // time it leaves here — including the ones nested inside the audit feed.
      activeResume: activeResume
        ? { ...activeResume, uploadedAt: activeResume.uploadedAt.toISOString() }
        : null,
      recent: recent.map((entry) => ({ ...entry, createdAt: entry.createdAt.toISOString() })),
    },
  };
});
