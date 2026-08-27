import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Guards the ordering of media deletion.
 *
 * This exists because of a specific bug. The file was deleted from storage in
 * `beforeDelete`, i.e. *before* the row — on the reasoning that a row pointing at
 * a missing file is worse than a file with no row. True, and the wrong
 * conclusion: the protection against deleting the file behind a live CV is
 * `Resume.mediaId`'s `ON DELETE RESTRICT`, which Postgres evaluates when the
 * **row** is deleted. So the sequence was: file deleted, row delete rejected,
 * transaction rolled back, row still present and now referring to nothing. The
 * ordering produced exactly the state it was chosen to prevent.
 *
 * The assertions below are about *when* the storage call happens relative to the
 * database, which is not something the end-to-end run can express as clearly:
 * there, it shows up as "the file is missing", several steps removed from the
 * cause.
 */

const deleteObject = vi.fn();
vi.mock('@/lib/storage', () => ({
  deleteObject,
  putObject: vi.fn(),
  listObjects: vi.fn(),
  isStorageConfigured: () => true,
  storageProviderName: () => 'test',
}));

/** Order of operations, recorded as they happen. */
let log = [];

const row = {
  id: 'clx0000000000000000000000',
  pathname: 'documents/2026-08/abc.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024,
  url: 'https://blob.example/abc.pdf',
};

/** A transaction client whose `delete` can be made to fail like a RESTRICT does. */
function makeTx({ deleteThrows = null } = {}) {
  return {
    media: {
      findUnique: vi.fn(async () => row),
      delete: vi.fn(async () => {
        log.push('db:delete');
        if (deleteThrows) throw deleteThrows;
        return row;
      }),
    },
    auditLog: { create: vi.fn(async () => ({})) },
  };
}

let tx = makeTx();

const prismaMock = {
  media: { findUnique: vi.fn(async () => row) },
  $transaction: vi.fn(async (fn) => fn(tx)),
};

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock, default: prismaMock }));

const { mediaResource } = await import('@/lib/api/resources/media');
const { invoke } = await import('./helpers/http.js');

/**
 * The route is wrapped in `withAdmin`, which denies without a session, so the
 * guard is stubbed to let these tests reach the handler. Every other suite
 * asserts the guard itself; this one is about what happens past it.
 */
vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getSessionUser: async () => ({ id: 'admin-1', email: 'a@b.co' }),
    withAdmin: (handler) => async (req, res) => {
      req.adminUser = { id: 'admin-1', email: 'a@b.co' };
      return handler(req, res);
    },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  log = [];
  deleteObject.mockImplementation(async () => {
    log.push('storage:delete');
    return { deleted: true };
  });
  tx = makeTx();
});

describe('deleting a media row', () => {
  it('deletes the database row before touching storage', async () => {
    const res = await invoke(mediaResource.item, { method: 'DELETE', query: { id: row.id } });

    expect(res.statusCode).toBe(204);
    expect(log).toEqual(['db:delete', 'storage:delete']);
  });

  it('passes the stored pathname, not the url', async () => {
    await invoke(mediaResource.item, { method: 'DELETE', query: { id: row.id } });

    // Deletion is by provider path. Parsing it back out of a CDN URL is the
    // brittle alternative the schema deliberately avoids by storing both.
    expect(deleteObject).toHaveBeenCalledWith({ pathname: row.pathname });
  });

  /** The regression. */
  it('does NOT delete the file when the row delete is refused', async () => {
    // What a RESTRICT violation looks like coming back through Prisma.
    const restrict = Object.assign(
      new Error('violates RESTRICT setting of foreign key constraint "resumes_media_id_fkey"'),
      { code: 'P2003' }
    );

    tx = makeTx({ deleteThrows: restrict });

    const res = await invoke(mediaResource.item, { method: 'DELETE', query: { id: row.id } });

    expect(res.statusCode).toBe(409);
    // The whole point: storage was never touched, so the surviving row still
    // refers to a file that exists.
    expect(deleteObject).not.toHaveBeenCalled();
    expect(log).toEqual(['db:delete']);
  });

  it('still reports success when the row is gone but storage cleanup fails', async () => {
    // The row is already deleted and committed by this point. Surfacing an error
    // would invite a retry against a row that no longer exists, and the leftover
    // file is recoverable — `npm run media:prune` lists and removes it.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    deleteObject.mockRejectedValue(new Error('provider unreachable'));

    const res = await invoke(mediaResource.item, { method: 'DELETE', query: { id: row.id } });

    expect(res.statusCode).toBe(204);
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it('reports 409 with a message about the file being in use', async () => {
    tx = makeTx({
      deleteThrows: Object.assign(new Error('ConnectorError code: "23001" RESTRICT'), {}),
    });

    const res = await invoke(mediaResource.item, { method: 'DELETE', query: { id: row.id } });

    expect(res.statusCode).toBe(409);
    expect(res.body.error.message).toMatch(/in use/i);
  });
});
