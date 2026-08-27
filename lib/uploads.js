import { randomBytes } from 'node:crypto';

/**
 * What may be uploaded, and how it is proved.
 *
 * The rule that matters: **a file's type is decided by its bytes, never by its
 * name or its declared Content-Type.** Both of those are supplied by whoever is
 * uploading. A `.png` extension on a PDF, or a `Content-Type: image/png` header
 * on an executable, costs nothing to send. Reading the first few bytes is the
 * only check that examines the thing itself.
 *
 * This is not defence against an attacker who already has the admin session —
 * they can upload whatever the allowlist permits. It is defence against a file
 * that is not what the dashboard will render it as: a "logo" that is really an
 * HTML document, served from the site's own origin, becomes stored XSS.
 */

/**
 * Hard ceiling, below Vercel's serverless request-body limit of 4.5 MB.
 *
 * Uploads are proxied through the API route rather than sent straight to the
 * storage provider, which is what makes byte-level validation possible before
 * anything is written — see ADR 0005. The cost is this cap. For a portfolio it
 * is not a real constraint: the entire existing asset set is a few megabytes,
 * and a 4 MB image on a personal site is a performance problem before it is a
 * size problem.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/**
 * Recognised types, keyed by the MIME type they will be served as.
 *
 * `magic` is checked at `offset`; `secondary` is a further signature further in,
 * needed for container formats where the first four bytes only say "RIFF" or
 * "ISO base media file".
 */
const SIGNATURES = [
  {
    mime: 'image/jpeg',
    extension: 'jpg',
    kind: 'image',
    magic: [0xff, 0xd8, 0xff],
    offset: 0,
  },
  {
    mime: 'image/png',
    extension: 'png',
    kind: 'image',
    magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    offset: 0,
  },
  {
    mime: 'image/gif',
    extension: 'gif',
    kind: 'image',
    magic: [0x47, 0x49, 0x46, 0x38], // "GIF8" — covers both 87a and 89a
    offset: 0,
  },
  {
    mime: 'image/webp',
    extension: 'webp',
    kind: 'image',
    magic: [0x52, 0x49, 0x46, 0x46], // "RIFF"
    offset: 0,
    secondary: { magic: [0x57, 0x45, 0x42, 0x50], offset: 8 }, // "WEBP"
  },
  {
    mime: 'image/avif',
    extension: 'avif',
    kind: 'image',
    magic: [0x66, 0x74, 0x79, 0x70], // "ftyp"
    offset: 4,
    secondary: { magic: [0x61, 0x76, 0x69, 0x66], offset: 8 }, // "avif" brand
  },
  {
    mime: 'application/pdf',
    extension: 'pdf',
    kind: 'document',
    magic: [0x25, 0x50, 0x44, 0x46, 0x2d], // "%PDF-"
    offset: 0,
  },
];

/**
 * SVG is deliberately **not** accepted.
 *
 * An SVG is an XML document that may contain `<script>`, event handlers and
 * external references. Served from the site's own origin — which is where
 * uploaded media is served from — that is stored XSS, and the same-origin
 * placement is exactly what makes it serious. Accepting SVG safely means
 * sanitising it on every render or serving it from a separate origin, neither of
 * which is worth it for a portfolio that has no SVG uploads to make: the icons
 * are MUI components and the screenshots are WebP and PNG.
 *
 * Named explicitly rather than left to fall through the allowlist, so the answer
 * to "why was my SVG rejected" is here rather than absent.
 */
const REJECTED_WITH_REASON = {
  'image/svg+xml':
    'SVG is not accepted: it is a document that can carry scripts, and serving one from this domain would let it run as if the site had written it. Export a PNG or WebP instead.',
};

/** Longest prefix any check needs. */
export const SNIFF_BYTES = 32;

const matchesAt = (buffer, magic, offset) =>
  buffer.length >= offset + magic.length &&
  magic.every((byte, index) => buffer[offset + index] === byte);

/**
 * Identifies a file from its leading bytes, or returns null.
 *
 * Returning null rather than throwing keeps the "what is it" question separate
 * from the "is it allowed" one, so the caller can phrase the error.
 */
export function sniffType(buffer) {
  for (const signature of SIGNATURES) {
    if (!matchesAt(buffer, signature.magic, signature.offset)) continue;
    if (signature.secondary && !matchesAt(buffer, signature.secondary.magic, signature.secondary.offset)) {
      continue;
    }

    return {
      mime: signature.mime,
      extension: signature.extension,
      kind: signature.kind,
    };
  }

  return null;
}

/**
 * Validates a complete upload and returns what to store.
 *
 * Returns `{ ok: false, message }` rather than throwing, because every failure
 * here is something to show the person uploading — not an exception.
 */
export function inspectUpload({ buffer, declaredMime, declaredName }) {
  if (!buffer || buffer.length === 0) {
    return { ok: false, message: 'That file is empty.' };
  }

  if (buffer.length > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      message: `That file is ${formatBytes(buffer.length)}. The limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`,
    };
  }

  const declared = String(declaredMime ?? '').split(';')[0].trim().toLowerCase();

  if (REJECTED_WITH_REASON[declared]) {
    return { ok: false, message: REJECTED_WITH_REASON[declared] };
  }

  const actual = sniffType(buffer);

  if (!actual) {
    return {
      ok: false,
      message:
        'That file type is not supported. Images may be JPEG, PNG, WebP, GIF or AVIF; documents must be PDF.',
    };
  }

  /**
   * A declared type that disagrees with the bytes is reported specifically.
   *
   * Almost always innocent — a `.jpg` that is really a PNG, which every phone
   * produces sooner or later — so the message says what the file actually is
   * rather than accusing anyone. It is still worth refusing: the extension the
   * name implies would be wrong, and a URL ending `.jpg` serving PNG bytes
   * confuses caches and image pipelines.
   */
  if (declared && declared !== actual.mime) {
    const isImagePair = declared.startsWith('image/') && actual.mime.startsWith('image/');

    return {
      ok: false,
      message: isImagePair
        ? `This file is actually ${actual.mime.replace('image/', '').toUpperCase()}, not ${declared.replace('image/', '').toUpperCase()}. Re-save or rename it and try again.`
        : `This file claims to be ${declared} but its contents are ${actual.mime}. It was not uploaded.`,
    };
  }

  const dimensions = actual.kind === 'image' ? readImageDimensions(buffer, actual.mime) : null;

  return {
    ok: true,
    mime: actual.mime,
    extension: actual.extension,
    kind: actual.kind,
    sizeBytes: buffer.length,
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
    // Kept only for the human-readable label in the media library. It is never
    // part of the storage path — see `storageKey`.
    originalName: sanitiseDisplayName(declaredName),
  };
}

/**
 * Builds the storage path.
 *
 * The client's filename is **never** used. That closes off path traversal
 * (`../../`), null bytes, absurd lengths, case-collisions on case-insensitive
 * stores, and the smaller annoyance of two uploads called `screenshot.png`
 * overwriting each other. A random name plus the extension the bytes earned is
 * all the path needs to be.
 */
export function storageKey({ kind, extension }) {
  const folder = kind === 'document' ? 'documents' : 'images';
  const stamp = new Date().toISOString().slice(0, 7); // YYYY-MM, for browsability
  return `${folder}/${stamp}/${randomBytes(16).toString('hex')}.${extension}`;
}

/**
 * A filename safe to display.
 *
 * Not used for storage, so this only has to be readable and harmless in a list:
 * no directory separators, no control characters, bounded length.
 */
export function sanitiseDisplayName(name) {
  const base = String(name ?? '')
    .split(/[/\\]/)
    .pop();

  const cleaned = [...base]
    .filter((char) => char >= ' ' && char !== '\u007f')
    .join('')
    .trim()
    .slice(0, 120);

  return cleaned || null;
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Image dimensions
// ---------------------------------------------------------------------------

/**
 * Reads pixel dimensions from the file header.
 *
 * Done by hand rather than with `sharp`, for two reasons. `sharp` is a native
 * module — Phase 1 lost an afternoon to a truncated native binary raising SIGBUS
 * — and although Next.js pulls it in for image optimisation, depending on a
 * transitive dependency is the mistake `prop-types` already taught this project
 * once. The headers below are a fixed, documented number of bytes at fixed
 * offsets; decoding the pixels is what needs a library, and nothing here decodes
 * pixels.
 *
 * Returns null when the format is not parsed (AVIF, which needs full ISOBMFF box
 * walking) or the header is truncated. `width` and `height` are nullable columns
 * precisely so that "unknown" is representable.
 */
export function readImageDimensions(buffer, mime) {
  try {
    switch (mime) {
      case 'image/png':
        return readPngDimensions(buffer);
      case 'image/jpeg':
        return readJpegDimensions(buffer);
      case 'image/gif':
        return readGifDimensions(buffer);
      case 'image/webp':
        return readWebpDimensions(buffer);
      default:
        return null;
    }
  } catch {
    // A malformed header is not a reason to refuse an otherwise valid image, and
    // the dimensions are metadata for the media library, not a security control.
    return null;
  }
}

/** PNG: the IHDR chunk is always first, at a fixed offset. */
function readPngDimensions(buffer) {
  if (buffer.length < 24) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

/** GIF: logical screen descriptor, little-endian, immediately after the header. */
function readGifDimensions(buffer) {
  if (buffer.length < 10) return null;
  return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
}

/**
 * JPEG: walk the segment chain to a Start Of Frame marker.
 *
 * Dimensions are not at a fixed offset — they sit in an SOF segment that can
 * follow any number of EXIF, ICC and comment segments of arbitrary length. So
 * the marker chain has to be walked. The SOF variants (baseline, progressive,
 * arithmetic, and the lossless and hierarchical ones) all carry height and width
 * at the same place within the segment.
 */
function readJpegDimensions(buffer) {
  let offset = 2; // past SOI

  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1; // resync past padding
      continue;
    }

    const marker = buffer[offset + 1];

    // Standalone markers with no length field.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }

    // SOF0–SOF15, excluding DHT (0xc4), JPG (0xc8) and DAC (0xcc), which share
    // the range but are not frame headers.
    const isStartOfFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

    if (isStartOfFrame) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }

    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (segmentLength < 2) return null; // malformed; stop rather than loop
    offset += 2 + segmentLength;
  }

  return null;
}

/**
 * WebP: three sub-formats, three layouts.
 *
 * Worth handling all of them because WebP is what this site's project
 * screenshots already are, so "unknown dimensions" would be the common case
 * rather than the rare one.
 */
function readWebpDimensions(buffer) {
  if (buffer.length < 30) return null;

  const format = buffer.toString('ascii', 12, 16);

  // Extended format: 24-bit little-endian, stored as value-1.
  if (format === 'VP8X') {
    const width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
    const height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));
    return { width, height };
  }

  // Lossy: after the 3-byte frame tag comes the start code 9d 01 2a, then two
  // 16-bit little-endian values whose low 14 bits are the dimensions.
  if (format === 'VP8 ') {
    if (!(buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a)) return null;
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }

  // Lossless: a signature byte, then 14 bits of width-1 and 14 of height-1,
  // bit-packed across four bytes.
  if (format === 'VP8L') {
    if (buffer[20] !== 0x2f) return null;
    const bits = buffer.readUInt32LE(21);
    return {
      width: 1 + (bits & 0x3fff),
      height: 1 + ((bits >> 14) & 0x3fff),
    };
  }

  return null;
}
