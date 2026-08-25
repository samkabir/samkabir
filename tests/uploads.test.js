import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  MAX_UPLOAD_BYTES,
  formatBytes,
  inspectUpload,
  readImageDimensions,
  sanitiseDisplayName,
  sniffType,
  storageKey,
} from '@/lib/uploads';

const asset = (relative) =>
  readFileSync(path.join(import.meta.dirname, '..', 'public', relative));

const fixture = (name) =>
  readFileSync(path.join(import.meta.dirname, 'fixtures', name));

/**
 * Real encoder output, not synthesised headers.
 *
 * These pointed at the project screenshots and the CV in `public/` until Phase 7
 * moved those into Blob and deleted them — the fixtures below took over so the
 * coverage did not leave with the content. They are still real files: `sharp`
 * produced the images and the PDF is a valid one-page document, so the chunk
 * layouts and marker chains being parsed are genuine rather than hand-forged
 * prefixes. The synthesised-buffer tests further down are deliberately separate,
 * because they probe malformed input.
 *
 * Two properties are worth keeping in mind when editing them:
 *
 *   * **The dimensions are asserted exactly**, and were chosen to match the
 *     screenshots they replace, so re-generating a fixture at a different size
 *     breaks the tests loudly rather than weakening them quietly.
 *   * **The two WebPs are different sub-formats** — VP8 lossy and VP8L lossless.
 *     That is better coverage than the two lossy files here before: a parser that
 *     handles only one reads the wrong bytes for the other, and "RIFF….WEBP" is
 *     identical in both.
 *
 * `png` still points at the real site logo, which Phase 7 kept.
 */
const REAL = {
  png: 'images/Logo.png',
};

const FIXTURE = {
  webpVp8: 'lossy.webp',
  webpLarge: 'lossless.webp',
  pdf: 'document.pdf',
  screenshot: 'screenshot.png',
};

describe('type detection from real files', () => {
  it('identifies a PNG', () => {
    expect(sniffType(asset(REAL.png))).toEqual({
      mime: 'image/png',
      extension: 'png',
      kind: 'image',
    });
  });

  it('identifies a WebP, not just the RIFF container', () => {
    // "RIFF" alone is also WAV and AVI. The check has to read the second
    // signature at offset 8, or an audio file passes as an image.
    expect(sniffType(fixture(FIXTURE.webpVp8)).mime).toBe('image/webp');
  });

  it('identifies a PDF', () => {
    expect(sniffType(fixture(FIXTURE.pdf))).toEqual({
      mime: 'application/pdf',
      extension: 'pdf',
      kind: 'document',
    });
  });

  it('rejects a RIFF container that is not WebP', () => {
    // RIFF header with "WAVE" where "WEBP" should be.
    const wav = Buffer.alloc(32);
    wav.write('RIFF', 0, 'ascii');
    wav.write('WAVE', 8, 'ascii');
    expect(sniffType(wav)).toBe(null);
  });

  it('rejects an unknown file', () => {
    expect(sniffType(Buffer.from('just some plain text, honestly'))).toBe(null);
    expect(sniffType(Buffer.alloc(0))).toBe(null);
    expect(sniffType(Buffer.from([0x00, 0x01, 0x02]))).toBe(null);
  });

  it('rejects an ELF executable', () => {
    const elf = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);
    expect(sniffType(elf)).toBe(null);
  });

  it('rejects an HTML document', () => {
    // The case that matters most: HTML served from the site's own origin runs
    // with the site's privileges.
    expect(sniffType(Buffer.from('<!DOCTYPE html><script>alert(1)</script>'))).toBe(null);
  });

  it('rejects a ZIP, which is also what a .docx is', () => {
    expect(sniffType(Buffer.from([0x50, 0x4b, 0x03, 0x04]))).toBe(null);
  });
});

/**
 * The requirement in the brief: "MIME **and** magic-byte checks, not just the
 * extension".
 */
describe('the bytes decide, not the name or the header', () => {
  it('rejects a PDF renamed and declared as a PNG', () => {
    const result = inspectUpload({
      buffer: fixture(FIXTURE.pdf),
      declaredMime: 'image/png',
      declaredName: 'totally-an-image.png',
    });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/application\/pdf/);
  });

  it('rejects HTML declared as an image', () => {
    const result = inspectUpload({
      buffer: Buffer.from('<html><script>fetch("/api/admin/skills")</script></html>'),
      declaredMime: 'image/png',
      declaredName: 'logo.png',
    });

    expect(result.ok).toBe(false);
  });

  it('rejects an executable declared as a PDF', () => {
    const result = inspectUpload({
      buffer: Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00, 0x00]),
      declaredMime: 'application/pdf',
      declaredName: 'cv.pdf',
    });

    expect(result.ok).toBe(false);
  });

  it('rejects a PNG declared as a JPEG, and says which it really is', () => {
    // Innocent and common — phones do it — so the message explains rather than
    // accuses.
    const result = inspectUpload({
      buffer: asset(REAL.png),
      declaredMime: 'image/jpeg',
      declaredName: 'logo.jpg',
    });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/actually PNG/i);
  });

  it('rejects SVG with a reason, before even looking at the bytes', () => {
    const result = inspectUpload({
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
      declaredMime: 'image/svg+xml',
      declaredName: 'icon.svg',
    });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/scripts/i);
  });

  it('accepts a real file whose declared type matches', () => {
    const result = inspectUpload({
      buffer: asset(REAL.png),
      declaredMime: 'image/png',
      declaredName: 'Logo.png',
    });

    expect(result.ok).toBe(true);
    expect(result.mime).toBe('image/png');
    expect(result.kind).toBe('image');
  });

  it('accepts a file with no declared type at all, judging by bytes alone', () => {
    // Some clients send nothing. The bytes are the authority anyway, so a
    // missing header is not a failure.
    const result = inspectUpload({ buffer: fixture(FIXTURE.pdf), declaredName: 'cv.pdf' });
    expect(result.ok).toBe(true);
    expect(result.mime).toBe('application/pdf');
  });

  it('ignores charset parameters on the declared type', () => {
    const result = inspectUpload({
      buffer: asset(REAL.png),
      declaredMime: 'image/png; charset=binary',
      declaredName: 'Logo.png',
    });
    expect(result.ok).toBe(true);
  });
});

describe('size limits', () => {
  it('rejects an empty file', () => {
    expect(inspectUpload({ buffer: Buffer.alloc(0) })).toMatchObject({ ok: false });
    expect(inspectUpload({ buffer: null })).toMatchObject({ ok: false });
  });

  it('rejects a file over the limit with a readable message', () => {
    // A valid PNG header followed by enough bytes to exceed the cap, so the
    // rejection is about the size rather than the type.
    const oversized = Buffer.concat([
      asset(REAL.png),
      Buffer.alloc(MAX_UPLOAD_BYTES + 1024),
    ]);

    const result = inspectUpload({ buffer: oversized, declaredMime: 'image/png' });

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/limit is 4\.0 MB/);
    expect(result.message).toMatch(/MB/);
  });

  it('stays under Vercel serverless request-body limit', () => {
    // The cap only works if it is below the platform's own limit — otherwise the
    // request dies before the handler with an error nobody can phrase.
    expect(MAX_UPLOAD_BYTES).toBeLessThan(4.5 * 1024 * 1024);
  });

  it('formats sizes readably', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});

describe('storage keys', () => {
  it('never contains the uploaded filename', () => {
    const key = storageKey({ kind: 'image', extension: 'png' });
    expect(key).not.toMatch(/logo/i);
    expect(key).toMatch(/^images\/\d{4}-\d{2}\/[0-9a-f]{32}\.png$/);
  });

  it('puts documents in their own folder', () => {
    expect(storageKey({ kind: 'document', extension: 'pdf' })).toMatch(/^documents\//);
  });

  it('is different every time, so two uploads cannot collide', () => {
    const keys = new Set(
      Array.from({ length: 200 }, () => storageKey({ kind: 'image', extension: 'png' }))
    );
    expect(keys.size).toBe(200);
  });

  it('cannot be steered by a malicious filename', () => {
    // The filename is not an input to the key at all, which is what closes off
    // traversal rather than trying to sanitise it.
    const result = inspectUpload({
      buffer: asset(REAL.png),
      declaredMime: 'image/png',
      declaredName: '../../../etc/passwd.png',
    });

    const key = storageKey(result);
    expect(key).not.toMatch(/\.\./);
    expect(key).not.toMatch(/passwd/);
  });
});

describe('display names', () => {
  it('strips directory components', () => {
    expect(sanitiseDisplayName('../../etc/passwd')).toBe('passwd');
    expect(sanitiseDisplayName('C:\\Users\\me\\cv.pdf')).toBe('cv.pdf');
  });

  it('strips control characters', () => {
    expect(sanitiseDisplayName('cv\u0000\u001b[31m.pdf')).toBe('cv[31m.pdf');
  });

  it('bounds the length', () => {
    expect(sanitiseDisplayName('a'.repeat(500)).length).toBe(120);
  });

  it('returns null rather than an empty string', () => {
    expect(sanitiseDisplayName('')).toBe(null);
    expect(sanitiseDisplayName('   ')).toBe(null);
    expect(sanitiseDisplayName(null)).toBe(null);
  });
});

/**
 * Dimensions are read by hand rather than with `sharp`, so they are checked
 * against real files of every format the site actually uses.
 */
describe('image dimensions from real files', () => {
  it('reads PNG', () => {
    expect(readImageDimensions(asset(REAL.png), 'image/png')).toEqual({
      width: 342,
      height: 262,
    });
  });

  it('reads a large screenshot PNG', () => {
    const dims = readImageDimensions(fixture(FIXTURE.screenshot), 'image/png');
    expect(dims.width).toBe(1341);
    expect(dims.height).toBe(656);
  });

  it('reads WebP', () => {
    expect(readImageDimensions(fixture(FIXTURE.webpVp8), 'image/webp')).toEqual({
      width: 720,
      height: 318,
    });
  });

  it('reads a large WebP', () => {
    expect(readImageDimensions(fixture(FIXTURE.webpLarge), 'image/webp')).toEqual({
      width: 1916,
      height: 908,
    });
  });

  it('returns null for a PDF rather than guessing', () => {
    expect(readImageDimensions(fixture(FIXTURE.pdf), 'application/pdf')).toBe(null);
  });

  it('returns null on a truncated header instead of throwing', () => {
    // Dimensions are metadata for the media library, not a security control, so
    // a malformed header must not fail an otherwise valid upload.
    expect(readImageDimensions(asset(REAL.png).subarray(0, 8), 'image/png')).toBe(null);
    expect(readImageDimensions(Buffer.alloc(4), 'image/webp')).toBe(null);
    expect(readImageDimensions(Buffer.alloc(0), 'image/jpeg')).toBe(null);
  });

  it('reads a synthesised GIF header', () => {
    const gif = Buffer.alloc(16);
    gif.write('GIF89a', 0, 'ascii');
    gif.writeUInt16LE(640, 6);
    gif.writeUInt16LE(480, 8);
    expect(readImageDimensions(gif, 'image/gif')).toEqual({ width: 640, height: 480 });
  });

  it('walks JPEG segments to find the frame header', () => {
    // Dimensions are not at a fixed offset in a JPEG — an EXIF block of
    // arbitrary length sits in front of them — so the marker chain has to be
    // walked. This builds SOI, a long APP1, then SOF0.
    const exifLength = 400;
    const jpeg = Buffer.concat([
      Buffer.from([0xff, 0xd8]), // SOI
      Buffer.from([0xff, 0xe1]), // APP1
      (() => {
        const seg = Buffer.alloc(exifLength);
        seg.writeUInt16BE(exifLength, 0);
        return seg;
      })(),
      Buffer.from([0xff, 0xc0]), // SOF0
      (() => {
        const seg = Buffer.alloc(15);
        seg.writeUInt16BE(15, 0);
        seg[2] = 8; // precision
        seg.writeUInt16BE(1080, 3); // height
        seg.writeUInt16BE(1920, 5); // width
        return seg;
      })(),
    ]);

    expect(readImageDimensions(jpeg, 'image/jpeg')).toEqual({ width: 1920, height: 1080 });
  });

  it('does not mistake a DHT marker for a frame header', () => {
    // 0xc4 sits inside the SOF marker range but is a Huffman table. Treating it
    // as a frame header would read two arbitrary bytes as the dimensions.
    const jpeg = Buffer.concat([
      Buffer.from([0xff, 0xd8]),
      Buffer.from([0xff, 0xc4]), // DHT
      (() => {
        const seg = Buffer.alloc(20);
        seg.writeUInt16BE(20, 0);
        return seg;
      })(),
      Buffer.from([0xff, 0xc0]),
      (() => {
        const seg = Buffer.alloc(15);
        seg.writeUInt16BE(15, 0);
        seg.writeUInt16BE(600, 3);
        seg.writeUInt16BE(800, 5);
        return seg;
      })(),
    ]);

    expect(readImageDimensions(jpeg, 'image/jpeg')).toEqual({ width: 800, height: 600 });
  });

  it('gives up on a malformed segment length instead of looping forever', () => {
    const jpeg = Buffer.concat([
      Buffer.from([0xff, 0xd8]),
      Buffer.from([0xff, 0xe1]),
      Buffer.from([0x00, 0x00]), // length 0 — impossible
      Buffer.alloc(20),
    ]);

    expect(readImageDimensions(jpeg, 'image/jpeg')).toBe(null);
  });
});

describe('every format the site actually serves', () => {
  it('is recognised, and every image yields dimensions', () => {
    /**
     * A sweep over the formats in use, so one the site already serves cannot be
     * one the uploader would reject.
     *
     * This used to walk the twenty-odd files in `public/` before Phase 7 moved
     * them into Blob. Enumerating formats rather than files is what it was
     * really testing: PNG, WebP in both sub-formats, and PDF are what the media
     * library holds, and a new format would be a deliberate addition here rather
     * than something that arrived with a screenshot.
     */
    const files = [
      ['public', REAL.png],
      ['fixture', FIXTURE.webpVp8],
      ['fixture', FIXTURE.webpLarge],
      ['fixture', FIXTURE.pdf],
      ['fixture', FIXTURE.screenshot],
    ];

    for (const [where, file] of files) {
      const buffer = where === 'public' ? asset(file) : fixture(file);
      const result = inspectUpload({ buffer, declaredName: file.split('/').pop() });

      expect(result.ok, file).toBe(true);

      if (result.kind === 'image') {
        expect(result.width, `${file} width`).toBeGreaterThan(0);
        expect(result.height, `${file} height`).toBeGreaterThan(0);
      }
    }
  });

  it('covers both WebP sub-formats, which share a container signature', () => {
    // "RIFF….WEBP" is byte-identical for VP8 and VP8L; the dimensions live in
    // different places and are packed differently. Reading one correctly says
    // nothing about the other, so both are asserted rather than assumed.
    expect(readImageDimensions(fixture(FIXTURE.webpVp8), 'image/webp')).toEqual({
      width: 720,
      height: 318,
    });
    expect(readImageDimensions(fixture(FIXTURE.webpLarge), 'image/webp')).toEqual({
      width: 1916,
      height: 908,
    });
  });
});
