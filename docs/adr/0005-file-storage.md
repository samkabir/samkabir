# 0005 — File storage: bytes decide the type, and the order of destruction matters

**Phase:** 5
**Status:** accepted

## Context

The CV, blog covers and project images all need uploading from the dashboard.
The brief's requirements for this phase:

> MIME **and** magic-byte checks, not just the extension; per-type size caps;
> generated storage keys, never the client's filename; uploads authenticated and
> audited; orphaned `Media` rows cleaned up.

And the noted risk:

> serverless request-body limits make large PDFs fail server-side; client-direct
> upload with a signed token avoids it.

## Decision

### 1. Uploads are proxied through the API, not sent client-direct

This is a deliberate deviation from the plan's own suggested mitigation, and the
two requirements are in direct tension:

- **Client-direct** (Vercel Blob's `handleUpload` plus a signed token) lifts the
  4.5 MB request-body limit. But the provider validates the *declared* content
  type, not the bytes — so magic-byte checking would happen after the file is
  already stored, as a delete-if-bad cleanup. And its `onUploadCompleted`
  callback requires a publicly reachable URL, so that validation path would be
  untestable in local development, which is where it would need to be exercised
  most.

- **Proxied** keeps a 4 MB cap but means nothing is ever written anywhere until
  the bytes have been read and identified.

Bytes-first validation won. The cap is not a real constraint for this project:
the entire existing asset set is a few megabytes, the largest file in the repo is
a 435 KB screenshot, and a 4 MB image on a personal portfolio is a performance
problem before it is a size problem. If that changes, `lib/storage.js` is where
client-direct would be added, and the validation would have to move to a
post-store cleanup — a worse design accepted for a real reason, rather than now
for a hypothetical one.

### 2. The body is raw bytes, not multipart

One file per request, metadata in the query string. `formidable` and its
equivalents are a dependency, a temp-file lifecycle and their own set of limits
to configure, all to unwrap a single field. `fetch(url, { body: file })` sends
the bytes directly and the client is simpler for it.

This requires `export const config = { api: { bodyParser: false } }` — as a
literal in the route file, because Next parses it at compile time and rejects a
re-exported constant. That is the one exception to route files containing no
logic, and without it the built-in parser drains the stream before the handler
sees a byte.

### 3. The size cap is enforced while streaming

`Content-Length` is checked first as a courtesy, so an oversized file is refused
before a byte is sent — but it is client-supplied. The real check destroys the
stream on the first chunk that crosses the limit. Waiting until the body is
buffered to check its length means a 500 MB upload is 500 MB of memory before it
is refused.

### 4. A file's type is decided by its bytes

Not the extension, not the `Content-Type` header — both are free to send. Magic
signatures for JPEG, PNG, GIF, WebP, AVIF and PDF, checked at fixed offsets, with
a second signature where the container demands it: `RIFF` alone is also WAV and
AVI, so WebP is only WebP if `WEBP` appears at offset 8.

A declared type that disagrees with the bytes is refused with a message naming
what the file actually is. Usually innocent — every phone eventually produces a
`.jpg` that is really a PNG — so it explains rather than accuses.

This is not defence against an attacker holding the admin session; they can
upload whatever the allowlist permits. It is defence against a file that is not
what the dashboard will render it as. A "logo" that is really an HTML document,
served from the site's own origin, is stored XSS.

### 5. SVG is rejected, with a reason

An SVG is an XML document that can carry `<script>`, event handlers and external
references. Served from the site's own origin, that runs with the site's
privileges. Accepting SVG safely means sanitising on every render or serving from
a separate origin — neither worth it for a portfolio with no SVG uploads to make:
the icons are MUI components and the screenshots are WebP and PNG.

Named explicitly rather than left to fall through the allowlist, so "why was my
SVG rejected" has an answer.

### 6. The client's filename never reaches the storage path

Keys are `{images|documents}/YYYY-MM/{16 random bytes}.{extension}`, where the
extension is the one the bytes earned. This closes off path traversal, null
bytes, absurd lengths, case-collisions on case-insensitive stores, and two
uploads called `screenshot.png` overwriting each other — by construction, rather
than by sanitising a hostile string. The original name is kept for display and
in the audit log only.

### 7. Dimensions are parsed by hand, not with `sharp`

PNG, GIF, JPEG and all three WebP sub-formats. JPEG needs the marker chain
walked, because dimensions sit in an SOF segment behind EXIF and ICC blocks of
arbitrary length — and 0xC4 sits inside the SOF marker range but is a Huffman
table, so treating it as a frame header reads two arbitrary bytes as the size.

`sharp` is a native module, and Phase 1 lost an afternoon to a truncated native
binary raising SIGBUS. Next.js does pull it in for image optimisation, but
depending on a transitive dependency is the mistake `prop-types` already taught
this project once. Nothing here decodes pixels; these are documented byte offsets.

AVIF returns null — it needs full ISOBMFF box walking. `width` and `height` are
nullable columns precisely so "unknown" is representable.

Verified against all 23 real asset files in the repository: every one identified,
every image's dimensions read.

### 8. Storage is one file, and one file only

`lib/storage.js` is the only module that imports `@vercel/blob` — checked by
grep, and it stays true. `Todo/03` promised the user that Cloudinary was a
fallback if Vercel demanded payment, and honouring that means the swap is a
change to one file. When the prune script needed to list objects, `listObjects`
was added here rather than importing the SDK there.

### 9. `/cv` is a redirect, not a file

`pages/api/cv.js`, rewritten from `/cv`, looks up the active `Resume` and 302s to
its storage URL. The point is that the URL never changes: uploading a new CV
activates a new row pointing at a new object, and every link ever shared keeps
working and starts serving the new file.

302 rather than 301 — a permanent redirect is cached indefinitely by browsers and
would pin the link to whichever CV was active the first time it was clicked, and
there is no way to clear someone else's cache. `s-maxage=60` lets the CDN absorb
traffic; `max-age=0` keeps the visitor's own browser from holding a stale
redirect.

It is deliberately **not** built with `createHandler`, and written longhand so
that being public is a visible choice rather than a missing import. A CV link
that only works when signed in is not a CV link.

### 10. Deletion order: row first, file second

The one that was wrong, and worth stating in full because the reasoning that
produced the bug was superficially sound.

The first version deleted the stored file in `beforeDelete` — before the row — on
the grounds that a row pointing at a missing file is worse than a file with no
row. That much is true. The error was forgetting *where the safety check lives*:
deleting the file behind a live CV is prevented by `Resume.mediaId`'s
`ON DELETE RESTRICT`, and Postgres evaluates that when the **row** is deleted.

So the actual sequence was: file deleted, row delete rejected with 409,
transaction rolled back, row still present and now pointing at nothing. The
ordering guaranteed the exact failure it was chosen to prevent.

Now an `afterDelete` hook runs only once the database has committed. The RESTRICT
case never reaches it — it surfaces as a 409 with the file untouched. A failure
in the cleanup leaves an unreferenced file, which `npm run media:prune` finds and
removes, and is logged rather than raised: the delete has already succeeded, and
reporting an error would invite a retry against a row that is gone.

The upload path has the opposite order for the same reasoning — store first,
record second — because there the survivable leftover is an orphaned file, not a
broken reference. **Whichever step happens second is the one whose failure must
be survivable.**

`tests/deleteOrdering.test.js` asserts the sequence directly, and was confirmed
to fail when the bug is reintroduced.

### 11. Prune defaults to reporting

`npm run media:prune` lists; `--apply` deletes. A destructive default on a script
that walks every reference in the database is how a CV gets deleted because one
relation was missed.

The relation list lives in `lib/mediaRelations.js` and is checked against
`schema.prisma` by a test. Getting it wrong is silent: the script would report a
referenced image as an orphan and delete it, with no error, leaving a broken
image behind. So adding a relation to `Media` and forgetting the list fails in
the suite.

## Consequences

- Uploads are capped at 4 MB, below Vercel's 4.5 MB serverless body limit.
- Every upload costs one function invocation and holds the file in memory
  briefly. For one admin uploading occasionally, irrelevant.
- Two kinds of leftover accumulate slowly — unreferenced rows and orphaned
  objects — and `media:prune` is the answer to both.
- The `ImageField` and `FileField` components exist but are first mounted in a
  real form in Phase 6, so they are deliberately dumb: they own the upload and
  hand back a `Media` row, and know nothing about which entity it belongs to.

## Blocked on a setting, not on code

Vercel now creates Blob stores with **private** access by default, which only
surfaced when the first real upload returned
`Cannot use public access on a private store`. A private blob has no publicly
readable URL, which is unusable for a public portfolio: every screenshot would
have to be proxied through a function, defeating CDN caching and spending an
invocation per image.

Public access is therefore required rather than worked around, and `putObject`
now translates that error into an actionable 503 instead of a generic 500.
`Todo/04` asks the user to flip the setting.

Everything else was verified by pointing the code at the private store
temporarily: 39 end-to-end checks, all passing, covering real uploads, byte-level
rejection, the size cap, the audit trail, `/cv`, and the RESTRICT guard. Then
reverted, and the store confirmed empty. The single unverified step is that an
uploaded URL is publicly readable — which is exactly what `Todo/04` fixes.
