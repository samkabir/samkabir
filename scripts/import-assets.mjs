import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { PrismaClient } from '@prisma/client';

import { putObject } from '../lib/storage.js';
import { inspectUpload, storageKey } from '../lib/uploads.js';

/**
 * Moves the repository's own assets into Blob storage, once.
 *
 * Phase 7, Step 2. The seed script (Step 1) created the content rows; this puts
 * the files those rows describe behind the same storage layer every future
 * upload uses, and links them up.
 *
 * **It goes through `inspectUpload` and `putObject` rather than the Blob SDK.**
 * That is the whole point: the same magic-byte validation, the same generated
 * storage keys and the same dimension parsing apply to these 20 files as to
 * anything uploaded through the dashboard later. If the checks are wrong, they
 * are wrong for everything and get fixed in one place — rather than this script
 * quietly writing rows that no upload path could ever have produced.
 *
 * A useful consequence: the uppercase `.PNG` extensions in
 * `public/images/projects/` do not matter at all. The storage key's extension
 * comes from what the bytes actually are, so every one of them lands as `.png`
 * with no case-collision risk on a case-insensitive store.
 *
 * **Idempotent.** A project that already has a cover is skipped, and so is the
 * CV if an active résumé already exists. Re-running after a partial failure
 * finishes the job instead of duplicating it. `--force` re-uploads anyway, which
 * is only useful if a file was replaced on disk.
 *
 * **This migration has already run, and its inputs are gone.** Step 7 deleted
 * `public/images/projects/**` and `public/assets/Samiul_Kabir_Resume.pdf` — the
 * files now live in Blob and the `Media` rows point at them. The script is kept
 * because it documents where every stored file came from and what its alt text
 * says, which is not recorded anywhere else. To run it again, restore the
 * originals first:
 *
 *     git checkout 639815e -- public/images/projects public/assets
 *
 * Usage:
 *   npm run assets:import
 *   npm run assets:import -- --dry-run
 *   npm run assets:import -- --force
 */

const prisma = new PrismaClient();

const PUBLIC_DIR = path.join(import.meta.dirname, '..', 'public');

/**
 * Every project cover, keyed by the slug the seed script assigned.
 *
 * The `alt` text is written here rather than derived from the project title,
 * because a title is not a description: "Shades Sunglases" tells someone using a
 * screen reader nothing about what the screenshot shows. This is the one moment
 * all nineteen images are in front of a person at once, so it is the moment to
 * write them.
 */
const PROJECT_COVERS = [
  {
    slug: 'shades-sunglasses',
    file: 'images/projects/project1/1.webp',
    alt: 'Screenshot of the Shades Sunglasses storefront: a dark product grid of sunglasses with prices and an add-to-cart button on each card.',
  },
  {
    slug: 'evanto-tourism',
    file: 'images/projects/project2/1.webp',
    alt: 'Screenshot of the Evanto Tourism home page: a hero photograph of a travel destination above a row of bookable tour cards.',
  },
  {
    slug: 'optima-diagnostic',
    file: 'images/projects/project3/1.webp',
    alt: 'Screenshot of the Optima Diagnostic Center site: a medical services landing page listing diagnostic tests with an appointment call to action.',
  },
  {
    slug: 'barikoi-map-search',
    file: 'images/projects/barikoi/1.PNG',
    alt: 'Screenshot of the BariKoi map search page: an interactive street map of Bangladesh with a place-search box and dropped location markers.',
  },
  {
    slug: 'honest-elite',
    file: 'images/projects/honestelite/1.PNG',
    alt: 'Screenshot of the Honest Elite site: a business landing page with a navigation bar, headline banner and service sections.',
  },
  {
    slug: 'food-network-static',
    file: 'images/projects/foodnetwork/1.PNG',
    alt: 'Screenshot of the Food Network static page: a recipe site layout with a large food photograph and a grid of dish cards.',
  },
  {
    slug: 'music-landing-page',
    file: 'images/projects/music/1.PNG',
    alt: 'Screenshot of the Music landing page: a dark hero section with an album image, artist name and streaming call to action.',
  },
  {
    slug: 'mache-landing-page',
    file: 'images/projects/Mache/1.PNG',
    alt: 'Screenshot of the Mache landing page: a minimal marketing layout with a headline, product imagery and a sign-up form.',
  },
  {
    slug: 'static-login-page',
    file: 'images/projects/loginpage/1.PNG',
    alt: 'Screenshot of a static login page: a centred sign-in card with email and password fields over a plain background.',
  },
  {
    slug: 'quiz-scoring-site',
    file: 'images/projects/itechsoft/1.PNG',
    alt: 'Screenshot of the quiz scoring site: a multiple-choice question panel with answer options and a running score display.',
  },
  {
    slug: 'open-library-search',
    file: 'images/projects/openlibrary/1.PNG',
    alt: 'Screenshot of the Open Library search page: a search field above result rows showing book covers, titles and authors.',
  },
  {
    slug: 'fakestore-rest-api',
    file: 'images/projects/fakestore/1.PNG',
    alt: 'Screenshot of the FakeStore demo: an e-commerce product grid built from a REST API, each card showing an image, title and price.',
  },
  {
    slug: 'talkshow-context-api',
    file: 'images/projects/talkshow/1.PNG',
    alt: 'Screenshot of the TalkShow event app: speaker cards with an add-to-cart action and a running selection total alongside.',
  },
  {
    slug: 'static-math-academy',
    file: 'images/projects/mathacademy/1.PNG',
    alt: 'Screenshot of the Math Academy site: a course listing page with topic cards and a sidebar of lesson links.',
  },
  {
    slug: 'honda-cbr-bootstrap',
    file: 'images/projects/honda/1.PNG',
    alt: 'Screenshot of the Honda CBR page: a full-width motorcycle photograph with specification blocks laid out beneath it.',
  },
  {
    slug: 'responsive-football',
    file: 'images/projects/football/1.PNG',
    alt: 'Screenshot of the responsive football page: a sports landing layout with a player hero image and match highlight cards.',
  },
];

/**
 * The three NDA screenshots on disk with no project row.
 *
 * `data/projects.js` has them commented out, so they are not on the site today
 * and importing them would be a content decision rather than a migration. Named
 * here so the omission is visible: whoever wonders why nineteen files became
 * sixteen uploads finds the answer without diffing directories.
 */
const UNIMPORTED = [
  'images/projects/CasinoBlogs/2.webp',
  'images/projects/casinohubs/1.PNG',
  'images/projects/gamblingcoin/1.PNG',
];

const CV = {
  file: 'assets/Samiul_Kabir_Resume.pdf',
  label: 'Samiul Kabir — CV',
  alt: 'Samiul Kabir’s curriculum vitae, two pages, PDF.',
};

/**
 * Reads a file, validates it the way an upload would, and stores it.
 *
 * `declaredMime` is deliberately not passed. `inspectUpload` compares a declared
 * type against the bytes and rejects a mismatch, which is right for a browser
 * upload where the header is attacker-supplied — but here there is no declared
 * type to check, only a filename, and a filename is not evidence. Omitting it
 * lets the bytes speak and skips a comparison that would have nothing to compare.
 */
async function storeFile(relativePath, { alt, uploadedById, dryRun }) {
  const absolute = path.join(PUBLIC_DIR, relativePath);
  const buffer = await readFile(absolute);

  const inspected = inspectUpload({
    buffer,
    declaredName: path.basename(relativePath),
  });

  if (!inspected.ok) {
    throw new Error(`${relativePath}: ${inspected.message}`);
  }

  const key = storageKey({ kind: inspected.kind, extension: inspected.extension });

  if (dryRun) {
    return {
      dryRun: true,
      key,
      mimeType: inspected.mime,
      sizeBytes: inspected.sizeBytes,
      width: inspected.width,
      height: inspected.height,
    };
  }

  const stored = await putObject({
    key,
    buffer,
    contentType: inspected.mime,
  });

  /**
   * Store, then record — the same order the upload route uses, and for the same
   * reason. Whichever step happens second is the one whose failure has to be
   * survivable: an orphaned file is found and removed by `npm run media:prune`,
   * whereas a row pointing at a file that was never written is a broken image
   * with nothing to clean it up.
   */
  const media = await prisma.media.create({
    data: {
      url: stored.url,
      pathname: stored.pathname,
      mimeType: inspected.mime,
      sizeBytes: inspected.sizeBytes,
      width: inspected.width,
      height: inspected.height,
      alt,
      uploadedById,
    },
  });

  return { media, key, ...inspected };
}

async function importProjectCovers({ uploadedById, dryRun, force }) {
  const results = { uploaded: 0, skipped: 0, missing: [] };

  for (const cover of PROJECT_COVERS) {
    const project = await prisma.project.findUnique({
      where: { slug: cover.slug },
      select: { id: true, title: true, coverMediaId: true },
    });

    if (!project) {
      results.missing.push(cover.slug);
      console.log(`  ✗ ${cover.slug} — no project row. Run \`npm run db:seed\` first.`);
      continue;
    }

    if (project.coverMediaId && !force) {
      results.skipped += 1;
      console.log(`  ⊘ ${cover.slug} — already has a cover.`);
      continue;
    }

    const stored = await storeFile(cover.file, {
      alt: cover.alt,
      uploadedById,
      dryRun,
    });

    if (dryRun) {
      console.log(
        `  → ${cover.slug} — would store ${stored.mimeType} ${stored.width}×${stored.height} as ${stored.key}`
      );
      results.uploaded += 1;
      continue;
    }

    await prisma.project.update({
      where: { id: project.id },
      data: { coverMediaId: stored.media.id },
    });

    results.uploaded += 1;
    console.log(
      `  ✓ ${cover.slug} — ${stored.mime} ${stored.width}×${stored.height}, ${stored.media.pathname}`
    );
  }

  return results;
}

/**
 * Uploads the CV and makes it the active résumé.
 *
 * `version` continues from the highest existing row rather than restarting, and
 * every other row is deactivated in the same transaction — two résumés both
 * claiming to be active would make `/cv` depend on row order, which is the kind
 * of bug that only shows up after the second upload.
 */
async function importCv({ uploadedById, dryRun, force }) {
  const active = await prisma.resume.findFirst({
    where: { isActive: true },
    select: { id: true, label: true, version: true },
  });

  if (active && !force) {
    console.log(`  ⊘ CV — version ${active.version} is already active.`);
    return { uploaded: 0, skipped: 1 };
  }

  const stored = await storeFile(CV.file, {
    alt: CV.alt,
    uploadedById,
    dryRun,
  });

  if (dryRun) {
    console.log(`  → CV — would store ${stored.mimeType} (${stored.sizeBytes} bytes) as ${stored.key}`);
    return { uploaded: 1, skipped: 0 };
  }

  const highest = await prisma.resume.aggregate({ _max: { version: true } });
  const version = (highest._max.version ?? 0) + 1;

  await prisma.$transaction([
    prisma.resume.updateMany({ where: { isActive: true }, data: { isActive: false } }),
    prisma.resume.create({
      data: {
        label: CV.label,
        mediaId: stored.media.id,
        version,
        isActive: true,
      },
    }),
  ]);

  console.log(`  ✓ CV — version ${version} active, ${stored.media.pathname}`);
  return { uploaded: 1, skipped: 0 };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');

  if (dryRun) {
    console.log('🔎 Dry run — nothing will be uploaded or written.\n');
  }

  /**
   * Attribution, not authorisation.
   *
   * `Media.uploadedById` is nullable, so a missing admin is not fatal — but a
   * media library where every row says "uploaded by nobody" is a worse audit
   * trail than one that names the only person who could have done it.
   */
  const admin = await prisma.adminUser.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true },
  });

  if (!admin) {
    console.log('⚠ No admin account exists, so uploads will not be attributed to anyone.');
    console.log('  Run `npm run admin:create` first if attribution matters.\n');
  } else {
    console.log(`Attributing uploads to ${admin.email}.\n`);
  }

  const uploadedById = admin?.id ?? null;

  console.log('🖼  Project covers');
  const covers = await importProjectCovers({ uploadedById, dryRun, force });

  console.log('\n📄 CV');
  const cv = await importCv({ uploadedById, dryRun, force });

  console.log('\n— Summary —');
  console.log(`  Covers stored:  ${covers.uploaded}`);
  console.log(`  Covers skipped: ${covers.skipped}`);
  console.log(`  CV stored:      ${cv.uploaded}`);
  console.log(`  Not imported:   ${UNIMPORTED.length} (NDA screenshots with no project row)`);

  if (covers.missing.length) {
    console.log(`\n⚠ ${covers.missing.length} project rows were missing: ${covers.missing.join(', ')}`);
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error('\n❌ Import failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
