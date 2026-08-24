/**
 * Finds and optionally removes media nothing refers to.
 *
 *     npm run media:prune            # report only
 *     npm run media:prune -- --apply # actually delete
 *
 * Two kinds of leftover accumulate, and they are different problems:
 *
 *   * **Unreferenced rows** — a `Media` row no record points at. Created by
 *     uploading a file and then not attaching it, which is a normal thing to do
 *     by accident: pick an image, change your mind, close the form.
 *
 *   * **Orphaned objects** — a file at the provider with no row. Created when an
 *     upload stores successfully and the row insert then fails. The upload route
 *     stores first on purpose, because an orphaned file is cheaper than a row
 *     pointing at nothing — this script is the other half of that trade.
 *
 * Defaults to reporting. A destructive default on a script that walks every
 * reference in the database is how a CV gets deleted because one relation was
 * missed.
 */

import { prisma } from '../lib/prisma.js';
import { deleteObject, listObjects } from '../lib/storage.js';
import { formatBytes } from '../lib/uploads.js';
import { MEDIA_RELATIONS } from '../lib/mediaRelations.js';

const apply = process.argv.includes('--apply');

async function unreferencedRows() {
  const rows = await prisma.media.findMany({
    select: {
      id: true,
      pathname: true,
      sizeBytes: true,
      createdAt: true,
      alt: true,
      _count: { select: Object.fromEntries(MEDIA_RELATIONS.map((name) => [name, true])) },
    },
    orderBy: { createdAt: 'asc' },
  });

  return rows.filter((row) =>
    MEDIA_RELATIONS.every((relation) => (row._count[relation] ?? 0) === 0)
  );
}

async function orphanedObjects(knownPathnames) {
  const orphans = [];
  let cursor;

  do {
    // Paged rather than fetched at once: the listing is unbounded in principle,
    // and holding every pathname twice serves no purpose.
    const page = await listObjects({ cursor });

    for (const object of page.objects) {
      if (!knownPathnames.has(object.pathname)) orphans.push(object);
    }

    cursor = page.cursor ?? undefined;
  } while (cursor);

  return orphans;
}

async function main() {
  console.log(`\nScanning media${apply ? '' : ' (report only — pass --apply to delete)'}\n`);

  const [rows, allMedia] = await Promise.all([
    unreferencedRows(),
    prisma.media.findMany({ select: { pathname: true } }),
  ]);

  const knownPathnames = new Set(allMedia.map((row) => row.pathname));
  const orphans = await orphanedObjects(knownPathnames);

  // ------------------------------------------------------------- rows
  console.log(`Unreferenced Media rows: ${rows.length}`);

  let rowBytes = 0;
  for (const row of rows) {
    rowBytes += row.sizeBytes;
    const age = Math.round((Date.now() - row.createdAt.getTime()) / 86_400_000);
    console.log(
      `  ${row.pathname}  ${formatBytes(row.sizeBytes).padStart(8)}  ${age}d old` +
        (row.alt ? `  "${row.alt.slice(0, 40)}"` : '')
    );
  }
  if (rows.length) console.log(`  total ${formatBytes(rowBytes)}`);

  // ---------------------------------------------------------- orphans
  console.log(`\nStored files with no Media row: ${orphans.length}`);

  let orphanBytes = 0;
  for (const orphan of orphans) {
    orphanBytes += orphan.sizeBytes;
    console.log(`  ${orphan.pathname}  ${formatBytes(orphan.sizeBytes).padStart(8)}`);
  }
  if (orphans.length) console.log(`  total ${formatBytes(orphanBytes)}`);

  if (!apply) {
    if (rows.length || orphans.length) {
      console.log('\nNothing was deleted. Re-run with --apply to remove the above.\n');
    } else {
      console.log('\nNothing to clean up.\n');
    }
    return;
  }

  if (!rows.length && !orphans.length) {
    console.log('\nNothing to clean up.\n');
    return;
  }

  console.log('\nDeleting…');

  for (const row of rows) {
    /**
     * Row first, then the file — the same ordering the delete endpoint uses, and
     * for the same reason.
     *
     * These rows were selected as unreferenced, so no foreign key should object.
     * "Should" is the operative word: the query and this loop are separate
     * statements, and a reference created in between would make the delete fail.
     * Deleting the file first would then leave a row pointing at nothing. This
     * way the worst case is a file with no row, which the next run of this
     * script reports as an orphan and removes.
     */
    await prisma.media.delete({ where: { id: row.id } });
    await deleteObject({ pathname: row.pathname });
    console.log(`  removed row + file  ${row.pathname}`);
  }

  for (const orphan of orphans) {
    await deleteObject({ pathname: orphan.pathname });
    console.log(`  removed file        ${orphan.pathname}`);
  }

  console.log(
    `\nDone. Reclaimed about ${formatBytes(rowBytes + orphanBytes)}.\n` +
      'Note that this is not audited: it is maintenance run from a terminal, not\n' +
      'a dashboard action, and there is no session to attribute it to.\n'
  );
}

try {
  await main();
} catch (error) {
  console.error(`\n${error.message}\n`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
