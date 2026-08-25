import { formatTimeline, formatYearRange } from './adminFormat.js';
import { prisma } from './prisma.js';

/**
 * Everything the public site reads, in one place.
 *
 * Phase 7, Step 3. Four properties matter more than the queries themselves, and
 * they are the reason this is a module rather than a handful of calls spread
 * across pages:
 *
 *   1. **Every query filters `status: 'PUBLISHED'`.** This is the single
 *      predicate the whole schema was shaped around — see the note on
 *      `PublishStatus` in `prisma/schema.prisma`. A section that forgets it
 *      publishes a draft, and nobody notices until it is indexed. One module
 *      means one place to check, and `grep -c PUBLISHED` is the check.
 *
 *   2. **Ordering is explicit and matches the dashboard.** Each `orderBy` below
 *      is copied from the corresponding resource in `lib/api/resources/`. If they
 *      drift, the order the dashboard shows and the order a visitor sees stop
 *      agreeing, and the drag-to-reorder feature starts lying.
 *
 *   3. **Nothing crosses the boundary that `getStaticProps` cannot serialise.**
 *      A `Date` throws at build time with a message that names the field but not
 *      the cause, and `undefined` throws too. Dates are formatted to display
 *      strings here — once — so no page or component has to remember.
 *
 *   4. **It is never imported by a client component.** It touches Prisma;
 *      importing it into anything that renders in the browser pulls the client
 *      into the bundle and fails the build.
 *
 * Each function returns the shape its component actually renders, not the shape
 * the database happens to store. That is deliberate: it keeps the field renames
 * in one file instead of scattering `row.jobPosition ?? row.job_position` through
 * the components.
 */

/** Applied to every list. Named so it reads as a decision rather than a filter. */
const PUBLISHED = { status: 'PUBLISHED' };

/**
 * The columns a cover image needs, and nothing else.
 *
 * `width` and `height` are the point: `next/image` uses them to reserve the right
 * box before the file arrives, which is what removes the layout shift the old
 * `<img>` caused.
 */
const coverSelect = {
  select: { url: true, width: true, height: true, alt: true },
};

/** Null-safe: a project with no cover renders without one rather than crashing. */
function toImage(media) {
  if (!media?.url) return null;

  return {
    url: media.url,
    width: media.width ?? null,
    height: media.height ?? null,
    alt: media.alt ?? '',
  };
}

// ---------------------------------------------------------------------------
// Singletons
// ---------------------------------------------------------------------------

/**
 * The identity block: name, headline, bio, the addresses and the footer credit.
 *
 * Returns null when the row does not exist, which is a real state — a fresh
 * database before the seed has run. Callers render defaults rather than assume.
 */
export async function getProfile(client = prisma) {
  const row = await client.profile.findUnique({
    where: { id: 'singleton' },
    select: {
      greeting: true,
      fullName: true,
      headline: true,
      bio: true,
      publicEmail: true,
      contactEmail: true,
      leetcodeUsername: true,
      showLeetcode: true,
      footerCredit: true,
      attributionLabel: true,
      attributionUrl: true,
      avatarMedia: coverSelect,
    },
  });

  if (!row) return null;

  const { avatarMedia, ...profile } = row;
  return { ...profile, avatar: toImage(avatarMedia) };
}

/** What goes in `<head>`. */
export async function getSeoSettings(client = prisma) {
  const row = await client.seoSettings.findUnique({
    where: { id: 'singleton' },
    select: {
      siteTitle: true,
      defaultDescription: true,
      canonicalUrl: true,
      twitterHandle: true,
      ogImageMedia: coverSelect,
    },
  });

  if (!row) return null;

  const { ogImageMedia, ...seo } = row;
  return { ...seo, ogImage: toImage(ogImageMedia) };
}

// ---------------------------------------------------------------------------
// Section copy
// ---------------------------------------------------------------------------

/**
 * Section headings, keyed for lookup rather than returned as a list.
 *
 * Components ask for the one they need — `sections.about` — so a component is
 * never coupled to how many sections exist or what order they are in. A missing
 * key yields `undefined` and the component falls back to its own text, which is
 * why deleting a heading in the dashboard does not blank out a section.
 */
export async function getSectionCopy(client = prisma) {
  const rows = await client.sectionCopy.findMany({
    where: PUBLISHED,
    orderBy: [{ order: 'asc' }],
    select: {
      key: true,
      numberLabel: true,
      heading: true,
      subheading: true,
      navLabel: true,
      anchor: true,
      showInNav: true,
    },
  });

  const byKey = {};
  for (const row of rows) byKey[row.key] = row;

  return byKey;
}

/**
 * The header nav, derived from the same rows.
 *
 * `showInNav` alone is not enough: a row flagged for the nav but missing an
 * anchor would render a link to nowhere, so both are required. That keeps a
 * half-filled dashboard form from producing a dead link.
 */
export function navFromSections(sections) {
  return Object.values(sections)
    .filter((section) => section.showInNav && section.anchor)
    .map((section) => ({
      key: section.key,
      numberLabel: section.numberLabel,
      label: section.navLabel || section.heading,
      anchor: section.anchor,
    }));
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

/**
 * Skill names, as strings.
 *
 * `SkillCard` takes a `name` and nothing else, so returning rows would mean every
 * caller writing `.map(s => s.name)`. The dashboard's tiebreaker (`name: 'asc'`)
 * is kept so two skills sharing an `order` land the same way in both places.
 */
export async function getSkills(client = prisma) {
  const rows = await client.skill.findMany({
    where: PUBLISHED,
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    select: { name: true },
  });

  return rows.map((row) => row.name);
}

/**
 * Education rows, with the year range pre-formatted.
 *
 * `years` is an empty string when neither year is set, which is the current state
 * of both rows — the site has never shown dates for them. An empty string renders
 * as nothing rather than as `undefined`.
 */
export async function getEducation(client = prisma) {
  const rows = await client.education.findMany({
    where: PUBLISHED,
    orderBy: [{ order: 'asc' }, { endYear: 'desc' }],
    select: {
      id: true,
      institution: true,
      degree: true,
      field: true,
      note: true,
      startYear: true,
      endYear: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    institution: row.institution,
    degree: row.degree ?? '',
    field: row.field ?? '',
    note: row.note ?? '',
    years: formatYearRange(row.startYear, row.endYear),
  }));
}

/**
 * Roles of one kind, with the timeline as the string the site displays.
 *
 * The formatter is `formatTimeline` from `lib/adminFormat.js` — the same one the
 * dashboard uses. Sharing it is the point: the dashboard is where these dates are
 * edited, so if it rendered them differently from the site then every edit would
 * be a guess. It also honours `timelineOverride`, which is the entire reason that
 * column exists.
 *
 * One visible consequence, worth stating rather than discovering: the old
 * `data/experience.js` wrote six of its seven ranges with an en dash (U+2013) and
 * one — "July 2025 - Present" — with an ASCII hyphen. The formatter emits an en
 * dash for all of them, so that single row's separator changes. The alternative
 * was to set `timelineOverride` on it purely to preserve a typo, which would have
 * made the override column meaningless.
 */
async function getExperiencesOfKind(kind, client = prisma) {
  const rows = await client.experience.findMany({
    where: { ...PUBLISHED, kind },
    orderBy: [{ order: 'asc' }, { startDate: 'desc' }],
    select: {
      id: true,
      jobPosition: true,
      companyName: true,
      location: true,
      isNda: true,
      responsibilities: true,
      startDate: true,
      endDate: true,
      isCurrent: true,
      timelineOverride: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    jobPosition: row.jobPosition,
    companyName: row.companyName,
    location: row.location ?? '',
    isNda: row.isNda,
    responsibilities: row.responsibilities,
    // Formatted here, so no Date reaches getStaticProps and no component has to
    // know how a timeline is spelled.
    timeline: formatTimeline(row),
  }));
}

export const getExperiences = (client) => getExperiencesOfKind('FULL_TIME', client);
export const getContractualExperiences = (client) => getExperiencesOfKind('CONTRACT', client);

/**
 * Projects, newest-ordered as the dashboard shows them, each with its cover.
 *
 * Field names are translated to what `ProjectCard` renders. The old static file
 * used `name`, `github`, `liveWebsite` and `image`; the schema uses `title`,
 * `repoUrl`, `liveUrl` and a relation. Doing the rename here means the component
 * has one vocabulary rather than two.
 */
export async function getProjects(client = prisma) {
  const rows = await client.project.findMany({
    where: PUBLISHED,
    orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      repoUrl: true,
      liveUrl: true,
      stacks: true,
      isFeatured: true,
      isNda: true,
      coverMedia: coverSelect,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    repoUrl: row.repoUrl ?? '',
    liveUrl: row.liveUrl ?? '',
    stacks: row.stacks,
    isFeatured: row.isFeatured,
    isNda: row.isNda,
    cover: toImage(row.coverMedia),
  }));
}

/**
 * Social links, split by where they are shown.
 *
 * The site renders the same three links in two places with different styling —
 * a fixed sidebar rail on desktop and a row inside the contact block on mobile —
 * and the two `showIn*` flags let one be hidden without deleting the row. Both
 * lists come from one query rather than two, because they are the same rows.
 */
export async function getSocialLinks(client = prisma) {
  const rows = await client.socialLink.findMany({
    where: PUBLISHED,
    orderBy: [{ order: 'asc' }, { platform: 'asc' }],
    select: {
      id: true,
      platform: true,
      label: true,
      url: true,
      iconKey: true,
      showInSidebar: true,
      showInContact: true,
    },
  });

  return {
    sidebar: rows.filter((row) => row.showInSidebar),
    contact: rows.filter((row) => row.showInContact),
  };
}

/**
 * Whether a CV exists, not where it is.
 *
 * The Resume button always points at `/cv`, which resolves through
 * `pages/api/cv.js` to whichever row is active — so the public page needs to know
 * only whether to render the button at all. Returning the Blob URL instead would
 * bake one version's URL into the static HTML and defeat the indirection the
 * whole versioning scheme exists for.
 */
export async function hasActiveResume(client = prisma) {
  const active = await client.resume.findFirst({
    where: { isActive: true },
    select: { id: true },
  });

  return Boolean(active);
}

// ---------------------------------------------------------------------------
// The whole page
// ---------------------------------------------------------------------------

/**
 * Everything the home page needs, in one round trip.
 *
 * The interactive `$transaction` is not about atomicity — these are all reads.
 * It is about the connection: Neon's free tier suspends an idle database, so the
 * first query after a quiet period pays a wake-up cost. Paying it once beats
 * paying it nine times in sequence, and a static build is exactly the situation
 * where the database has been idle.
 *
 * The return value is plain JSON by construction. Every `Date` has already
 * become a string inside the functions above, so `getStaticProps` can serialise
 * this without a `JSON.parse(JSON.stringify(...))` round trip — which would have
 * worked but would have hidden the very mistake it papered over.
 */
export async function getPageContent() {
  const [
    profile,
    seo,
    sections,
    skills,
    education,
    experiences,
    contractualExperiences,
    projects,
    socialLinks,
    resumeExists,
  ] = await prisma.$transaction(async (tx) => Promise.all([
    getProfile(tx),
    getSeoSettings(tx),
    getSectionCopy(tx),
    getSkills(tx),
    getEducation(tx),
    getExperiences(tx),
    getContractualExperiences(tx),
    getProjects(tx),
    getSocialLinks(tx),
    hasActiveResume(tx),
  ]));

  return {
    profile,
    seo,
    sections,
    nav: navFromSections(sections),
    skills,
    education,
    experiences,
    contractualExperiences,
    projects,
    socialLinks,
    hasResume: resumeExists,
  };
}
