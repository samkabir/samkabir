import { z } from 'zod';

import { prisma } from '../../prisma.js';
import { requestIp } from '../../auth.js';
import { isStorageConfigured, putObject } from '../../storage.js';
import { MAX_UPLOAD_BYTES, formatBytes, inspectUpload, storageKey } from '../../uploads.js';
import { ApiError, badRequest } from '../errors.js';
import { recordAudit } from '../audit.js';
import { createHandler, parseQuery } from '../handler.js';

/**
 * `POST /api/admin/media/upload` — the only writer of `Media` rows.
 *
 * **The body is raw bytes, not multipart.** One file per request, its metadata in
 * the query string. That avoids a multipart parser entirely — `formidable` and
 * friends are a dependency, a temp-file lifecycle and a set of their own limits
 * to configure, all to unwrap a single field. `fetch(url, { body: file })` sends
 * the bytes directly and the client is simpler for it too.
 *
 * **The upload is proxied through here rather than sent straight to the
 * provider.** Vercel Blob supports client-direct uploads with a signed token,
 * which would lift the 4.5 MB request-body limit, and it was rejected: the
 * provider checks the *declared* content type, not the bytes, so validation
 * would happen after the file is already stored — and its `onUploadCompleted`
 * callback needs a publicly reachable URL, so the primary validation path would
 * be untestable in local development. Bytes-first validation is worth more than
 * a size limit no portfolio asset approaches. See ADR 0005.
 */

const uploadQuery = z.object({
  filename: z.string().trim().max(255).optional(),
  alt: z.string().trim().max(300).optional(),
});

/**
 * Reads the request body with a hard ceiling.
 *
 * The cap is enforced **while streaming**, not after: waiting until the body is
 * fully buffered to check its length means a 500 MB upload is 500 MB of memory
 * before it is refused. Destroying the stream on the first chunk that crosses
 * the line costs one chunk over.
 *
 * `Content-Length` is checked first as a courtesy — it lets an oversized file be
 * refused before a byte of it is sent — but it is client-supplied, so the
 * streaming check is the one that actually holds.
 */
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const declaredLength = Number(req.headers['content-length'] ?? 0);

    if (declaredLength > limit) {
      reject(
        new ApiError(
          413,
          `That file is ${formatBytes(declaredLength)}. The limit is ${formatBytes(limit)}.`
        )
      );
      return;
    }

    const chunks = [];
    let received = 0;

    req.on('data', (chunk) => {
      received += chunk.length;

      if (received > limit) {
        req.destroy();
        reject(new ApiError(413, `That file is larger than the ${formatBytes(limit)} limit.`));
        return;
      }

      chunks.push(chunk);
    });

    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export const uploadHandler = createHandler({
  POST: async (req, res) => {
    if (!isStorageConfigured()) {
      // 503 rather than 500: nothing is broken, the deployment is missing a
      // setting, and the message says which one.
      throw new ApiError(
        503,
        'File storage is not configured on the server (BLOB_READ_WRITE_TOKEN). Uploads are unavailable.'
      );
    }

    const query = parseQuery(uploadQuery, req);
    const buffer = await readBody(req, MAX_UPLOAD_BYTES);

    // Everything about the file is decided here, from its bytes, before any
    // write happens anywhere.
    const inspected = inspectUpload({
      buffer,
      declaredMime: req.headers['content-type'],
      declaredName: query.filename,
    });

    if (!inspected.ok) {
      throw badRequest(inspected.message, { file: inspected.message });
    }

    const key = storageKey(inspected);

    /**
     * Stored first, recorded second.
     *
     * The ordering is deliberate and the failure modes are asymmetric. Writing
     * the row first would leave a `Media` row pointing at a URL that does not
     * exist if the upload then failed — and the dashboard would render a broken
     * image with no way to tell it apart from a real one. This way a failed row
     * insert leaves an unreferenced file at the provider, which costs a few
     * kilobytes and is what `npm run media:prune` exists to sweep up.
     *
     * An orphaned file is cheaper than a broken reference.
     */
    let stored;

    try {
      stored = await putObject({ key, buffer, contentType: inspected.mime });
    } catch (error) {
      // A misconfigured store is not a bug and not the user's input being wrong,
      // so it gets 503 and the provider's actionable message rather than the
      // generic 500 body. Anything else falls through to the normal handling,
      // which logs it and says nothing specific.
      if (error?.storageConfigurationError) {
        throw new ApiError(503, error.message);
      }
      throw error;
    }

    const media = await prisma.$transaction(async (tx) => {
      const row = await tx.media.create({
        data: {
          url: stored.url,
          pathname: stored.pathname,
          mimeType: inspected.mime,
          sizeBytes: inspected.sizeBytes,
          width: inspected.width,
          height: inspected.height,
          alt: query.alt || null,
          uploadedById: req.adminUser.id,
        },
      });

      await recordAudit(tx, {
        actorId: req.adminUser.id,
        action: 'create',
        entity: 'Media',
        entityId: row.id,
        diff: {
          pathname: { from: null, to: stored.pathname },
          mimeType: { from: null, to: inspected.mime },
          sizeBytes: { from: null, to: inspected.sizeBytes },
          // The name the file arrived with, which is not its storage path. Kept
          // in the log because "which file did I upload" is otherwise
          // unanswerable once the path is a random hex string.
          originalName: { from: null, to: inspected.originalName },
        },
        ip: requestIp(req),
      });

      return row;
    });

    res.status(201).json({ item: media });
  },
});

/**
 * The `bodyParser: false` config this handler depends on lives in
 * `pages/api/admin/media/upload.js`, not here.
 *
 * Next.js parses that export at compile time and rejects anything it cannot read
 * statically, so re-exporting a constant from this module fails the build. Noted
 * because the coupling is invisible otherwise: without that config the built-in
 * parser drains the stream and `readBody` above receives nothing.
 */
