import { del, list, put } from '@vercel/blob';

/**
 * Object storage, behind a two-function interface.
 *
 * Storage is the one genuinely hard vendor dependency in this project: the
 * database can be pointed at any Postgres, and auth is our own code, but a file
 * has to physically live at a provider. So the surface that touches the vendor
 * is kept to exactly this file, and it is deliberately tiny — put an object,
 * delete an object. Everything above it deals in `{ url, pathname }`.
 *
 * That matters for a concrete reason rather than an architectural one:
 * `Todo/03` told the user to stop and say so if Vercel demanded a payment
 * method, because the fallback is Cloudinary. Honouring that promise means the
 * swap has to be a change to one file, and it is — implement `putObject` and
 * `deleteObject` against another SDK and nothing else in the codebase knows.
 *
 * No caching or CDN logic here. Blob URLs are already served from a CDN, and
 * adding a layer would mean two places to look when a stale image appears.
 */

/**
 * Fails loudly and early rather than at the first upload.
 *
 * A missing token produces an SDK error several frames deep that reads like a
 * network fault, at the moment someone is trying to upload their CV. This says
 * what is actually wrong.
 */
function requireToken() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (!token) {
    throw new Error(
      'BLOB_READ_WRITE_TOKEN is not set, so files cannot be stored. See Todo/03-create-vercel-blob-store.md.'
    );
  }

  return token;
}

/** Whether uploads are configured at all. Used to disable the UI honestly. */
export function isStorageConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function storageProviderName() {
  return 'vercel-blob';
}

/**
 * Writes an object and returns where it landed.
 *
 * `addRandomSuffix: false` because `storageKey` already generated a random name.
 * Leaving the SDK to add its own suffix would mean the returned pathname differs
 * from the key we asked for — and since deletion is by pathname, storing the
 * wrong one leaves a file that can never be removed.
 *
 * `cacheControlMaxAge` is a year: the key contains 16 random bytes, so a given
 * URL's content never changes. Replacing an image writes a new key.
 */
export async function putObject({ key, buffer, contentType }) {
  const token = requireToken();

  try {
    const result = await put(key, buffer, {
      token,
      /**
       * The store must be a **public** one.
       *
       * Vercel now creates Blob stores with private access by default, and a
       * private blob has no publicly readable URL — reading one requires an
       * authenticated call through the SDK. That is unusable for a portfolio:
       * every project screenshot on the home page would have to be proxied
       * through a serverless function, which defeats CDN caching, spends an
       * invocation per image, and adds a round trip to a page whose whole point
       * is loading fast.
       *
       * So public access is required rather than worked around, and the error
       * below says exactly that instead of surfacing the SDK's message as a 500.
       */
      access: 'public',
      contentType,
      addRandomSuffix: false,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });

    return { url: result.url, pathname: result.pathname };
  } catch (error) {
    throw translateStorageError(error);
  }
}

/**
 * Turns the provider's configuration errors into something a human can act on.
 *
 * These are not bugs and not transient — they are a setting in a dashboard, and
 * the person who can fix them is the one seeing the message. An unrecognised
 * error is re-thrown unchanged: inventing a friendly message for a fault we do
 * not understand would hide it.
 */
function translateStorageError(error) {
  const message = String(error?.message ?? '');

  if (/private store|private access/i.test(message)) {
    const explained = new Error(
      'The Blob store is set to private access, so uploaded files would have no public URL. ' +
        'Open the store in the Vercel dashboard and switch its access to public — or create a ' +
        'new store with public access and replace BLOB_READ_WRITE_TOKEN. See Todo/04-make-the-blob-store-public.md.'
    );
    explained.storageConfigurationError = true;
    return explained;
  }

  if (/unauthorized|invalid token|forbidden/i.test(message)) {
    const explained = new Error(
      'The Blob store rejected the token. BLOB_READ_WRITE_TOKEN may be revoked, or belong to a store that no longer exists.'
    );
    explained.storageConfigurationError = true;
    return explained;
  }

  return error;
}

/**
 * Lists everything in the store, a page at a time.
 *
 * Only the prune script needs this — to find files with no database row. It goes
 * through here rather than importing the SDK directly, because the point of this
 * module is that it is the *only* file that knows which provider is in use. One
 * stray import elsewhere and the Cloudinary fallback stops being a one-file
 * change.
 *
 * Returns `{ objects, cursor }` in provider-neutral terms: `pathname` and
 * `sizeBytes`, not the SDK's shape.
 */
export async function listObjects({ cursor, limit = 1000 } = {}) {
  const token = requireToken();
  const page = await list({ token, cursor, limit });

  return {
    objects: page.blobs.map((blob) => ({
      pathname: blob.pathname,
      sizeBytes: blob.size ?? 0,
      uploadedAt: blob.uploadedAt ?? null,
    })),
    cursor: page.hasMore ? page.cursor : null,
  };
}

/**
 * Removes an object.
 *
 * A missing object is treated as success. Deletion is called while removing a
 * `Media` row, and a file that is already gone should not prevent the row from
 * going too — otherwise the database keeps a permanent reference to nothing, and
 * the only way to clear it is by hand.
 */
export async function deleteObject({ pathname }) {
  const token = requireToken();

  try {
    await del(pathname, { token });
    return { deleted: true };
  } catch (error) {
    // The SDK does not expose a typed not-found, so the message is what there is
    // to go on. Anything else is re-thrown: a permissions or network failure
    // must not be mistaken for a successful delete.
    if (/not found|404/i.test(String(error?.message ?? ''))) {
      return { deleted: false, reason: 'already-absent' };
    }

    throw error;
  }
}
