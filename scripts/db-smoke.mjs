/**
 * Schema smoke test.
 *
 * Writes one row into every model, reads it back, exercises the relations and
 * the cascade rules, then deletes everything it created. Run it after the first
 * migration and after any schema change:
 *
 *     npm run db:smoke
 *
 * This is not a substitute for the unit tests in Phase 10. It answers a narrower
 * question that those tests cannot: does the schema that reached the database
 * actually behave the way the schema file claims? Constraints, defaults and
 * delete behaviour are all things Prisma will happily let you write down wrongly
 * and only complain about at runtime.
 *
 * It is safe to run against a database with real content: every row it creates
 * carries the SMOKE_TAG prefix, and it removes them in reverse dependency order
 * in a finally block.
 */

import { PrismaClient } from '@prisma/client';

const SMOKE_TAG = '__smoke__';
const prisma = new PrismaClient({ log: ['warn', 'error'] });

/**
 * Ids of rows this run created, so cleanup can delete exactly those.
 *
 * Matching on content would be near enough for the tagged fixtures, but not for
 * AuditLog: its rows carry no name of ours, and a `where` loose enough to catch
 * ours would also catch real history. Audit rows are the one thing here that
 * must never be deleted by accident, so they are tracked by id.
 */
const created = { auditLogIds: [], createdProfile: false };

let passed = 0;
let failed = 0;

function check(label, condition) {
  if (condition) {
    passed += 1;
    console.log(`  ok    ${label}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${label}`);
  }
}

async function main() {
  console.log('\nConnecting…');
  await prisma.$queryRaw`SELECT 1`;
  console.log('Connected.\n');

  console.log('Identity');
  const user = await prisma.adminUser.create({
    data: { email: `${SMOKE_TAG}@example.invalid`, name: 'Smoke Test' },
  });
  check('AdminUser created with default role ADMIN', user.role === 'ADMIN');
  check('AdminUser.passwordHash is null when unset', user.passwordHash === null);

  const account = await prisma.oAuthAccount.create({
    data: { userId: user.id, provider: 'google', providerAccountId: `${SMOKE_TAG}-1` },
  });
  check('OAuthAccount links to AdminUser', account.userId === user.id);

  // The composite unique on (provider, providerAccountId) is what stops the same
  // Google identity being attached to two admin rows.
  let duplicateRejected = false;
  try {
    await prisma.oAuthAccount.create({
      data: { userId: user.id, provider: 'google', providerAccountId: `${SMOKE_TAG}-1` },
    });
  } catch {
    duplicateRejected = true;
  }
  check('duplicate (provider, providerAccountId) is rejected', duplicateRejected);

  console.log('\nUploads');
  const media = await prisma.media.create({
    data: {
      url: 'https://example.invalid/smoke.png',
      pathname: `${SMOKE_TAG}/smoke.png`,
      mimeType: 'image/png',
      sizeBytes: 1024,
      width: 32,
      height: 32,
      uploadedById: user.id,
    },
  });
  check('Media records its uploader', media.uploadedById === user.id);

  console.log('\nSingletons');
  // If a real profile already exists this must not touch it, so the update
  // branch is empty and cleanup only removes a row this run inserted.
  const existingProfile = await prisma.profile.findUnique({ where: { id: 'singleton' } });
  created.createdProfile = existingProfile === null;
  const profile = await prisma.profile.upsert({
    where: { id: 'singleton' },
    create: {
      fullName: `${SMOKE_TAG} Profile`,
      headline: 'Smoke headline',
      bio: 'Smoke bio',
      publicEmail: 'smoke@example.invalid',
    },
    update: {},
  });
  check('Profile id defaults to "singleton"', profile.id === 'singleton');
  check('Profile.greeting has a default', Boolean(profile.greeting));

  console.log('\nRésumé content');
  const skill = await prisma.skill.create({ data: { name: `${SMOKE_TAG} Skill` } });
  check('Skill defaults to PUBLISHED', skill.status === 'PUBLISHED');

  const experience = await prisma.experience.create({
    data: {
      kind: 'CONTRACT',
      jobPosition: 'Smoke Engineer',
      companyName: `${SMOKE_TAG} Ltd`,
      startDate: new Date('2024-07-01'),
      endDate: new Date('2024-09-30'),
      responsibilities: ['First bullet', 'Second bullet'],
    },
  });
  check('Experience stores a String[] in order', experience.responsibilities[1] === 'Second bullet');
  check('Experience.isCurrent defaults to false', experience.isCurrent === false);

  const project = await prisma.project.create({
    data: {
      slug: `${SMOKE_TAG}-project`,
      title: 'Smoke Project',
      stacks: ['Next JS', 'Prisma'],
      coverMediaId: media.id,
    },
    include: { coverMedia: true },
  });
  check('Project resolves its cover Media relation', project.coverMedia?.id === media.id);

  let duplicateSlugRejected = false;
  try {
    await prisma.project.create({ data: { slug: `${SMOKE_TAG}-project`, title: 'Clash' } });
  } catch {
    duplicateSlugRejected = true;
  }
  check('duplicate Project.slug is rejected', duplicateSlugRejected);

  const resume = await prisma.resume.create({
    data: { label: `${SMOKE_TAG} CV`, mediaId: media.id, isActive: true },
  });
  check('Resume attaches to Media', resume.mediaId === media.id);

  // Restrict, not Cascade: deleting the file out from under an active résumé
  // would leave a dead download link on the site.
  let mediaDeleteBlocked = false;
  try {
    await prisma.media.delete({ where: { id: media.id } });
  } catch {
    mediaDeleteBlocked = true;
  }
  check('Media in use by a Resume cannot be deleted', mediaDeleteBlocked);

  const social = await prisma.socialLink.create({
    data: {
      platform: 'github',
      label: 'GitHub',
      url: `https://github.invalid/${SMOKE_TAG}`,
      iconKey: 'github',
    },
  });
  check('SocialLink shows in both places by default', social.showInSidebar && social.showInContact);

  const education = await prisma.education.create({
    data: { institution: `${SMOKE_TAG} University`, degree: "Bachelor's" },
  });
  check('Education created', Boolean(education.id));

  const section = await prisma.sectionCopy.create({
    data: { key: `${SMOKE_TAG}-about`, numberLabel: '00.', heading: 'About Me', anchor: 'about' },
  });
  check('SectionCopy stores the binary number label verbatim', section.numberLabel === '00.');

  console.log('\nBlog');
  const tag = await prisma.tag.create({ data: { slug: `${SMOKE_TAG}-tag`, name: 'Smoke' } });
  const post = await prisma.blogPost.create({
    data: {
      slug: `${SMOKE_TAG}-post`,
      title: 'Smoke Post',
      contentMarkdown: '# Hello\n\nBody.',
      authorId: user.id,
      coverMediaId: media.id,
      ogMediaId: media.id,
      tags: { create: [{ tagId: tag.id }] },
    },
    include: { tags: { include: { tag: true } }, coverMedia: true, ogMedia: true, author: true },
  });
  check('BlogPost defaults to DRAFT', post.status === 'DRAFT');
  check('BlogPost.publishedAt is null while a draft', post.publishedAt === null);
  check('BlogPost resolves its tags', post.tags[0]?.tag.slug === `${SMOKE_TAG}-tag`);
  check(
    'BlogPost distinguishes cover from OG image relation',
    post.coverMedia?.id === media.id && post.ogMedia?.id === media.id
  );

  // The uniform status filter every public query relies on.
  const publicPosts = await prisma.blogPost.findMany({
    where: { slug: post.slug, status: 'PUBLISHED' },
  });
  check('a DRAFT post is invisible to the public filter', publicPosts.length === 0);

  console.log('\nAudit');
  const log = await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: 'create',
      entity: 'BlogPost',
      entityId: post.id,
      diff: { title: { from: null, to: 'Smoke Post' } },
    },
  });
  created.auditLogIds.push(log.id);
  check('AuditLog stores a JSON diff', log.diff?.title?.to === 'Smoke Post');

  console.log('\nDelete behaviour');
  await prisma.blogPost.delete({ where: { id: post.id } });
  const orphanJoins = await prisma.blogPostTag.count({ where: { postId: post.id } });
  check('deleting a BlogPost cascades to its tag joins', orphanJoins === 0);

  // SetNull on AuditLog.actorId and Media.uploadedById: removing an account must
  // not erase the trail of what it did, or the files it uploaded.
  await prisma.oAuthAccount.deleteMany({ where: { userId: user.id } });
  await prisma.adminUser.delete({ where: { id: user.id } });
  const survivingLog = await prisma.auditLog.findUnique({ where: { id: log.id } });
  check('AuditLog survives deletion of its actor', survivingLog !== null);
  check('AuditLog.actorId is nulled, not cascaded', survivingLog?.actorId === null);

  const survivingMedia = await prisma.media.findUnique({ where: { id: media.id } });
  check('Media survives deletion of its uploader', survivingMedia !== null);
}

async function cleanup() {
  console.log('\nCleaning up…');
  const like = { contains: SMOKE_TAG };

  // Reverse dependency order. deleteMany is used throughout so a partial failure
  // mid-run still leaves nothing behind.
  await prisma.auditLog.deleteMany({ where: { id: { in: created.auditLogIds } } });
  await prisma.blogPostTag.deleteMany({ where: { tag: { slug: like } } });
  await prisma.blogPost.deleteMany({ where: { slug: like } });
  await prisma.tag.deleteMany({ where: { slug: like } });
  await prisma.resume.deleteMany({ where: { label: like } });
  await prisma.project.deleteMany({ where: { slug: like } });
  await prisma.sectionCopy.deleteMany({ where: { key: like } });
  await prisma.education.deleteMany({ where: { institution: like } });
  await prisma.socialLink.deleteMany({ where: { url: like } });
  await prisma.experience.deleteMany({ where: { companyName: like } });
  await prisma.skill.deleteMany({ where: { name: like } });
  if (created.createdProfile) {
    await prisma.profile.deleteMany({ where: { fullName: like } });
  }
  await prisma.media.deleteMany({ where: { pathname: like } });
  await prisma.oAuthAccount.deleteMany({ where: { providerAccountId: like } });
  await prisma.adminUser.deleteMany({ where: { email: like } });
}

try {
  await main();
} catch (error) {
  failed += 1;
  console.error('\nUnexpected error:', error.message);
} finally {
  try {
    await cleanup();
  } catch (error) {
    console.error('Cleanup failed — inspect rows containing', SMOKE_TAG, ':', error.message);
  }
  await prisma.$disconnect();
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
