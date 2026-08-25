# Admin API reference

Every endpoint below lives under `/api/admin` and requires an authenticated
admin. Authentication is live as of Phase 4 — see
[ADR 0004](adr/0004-authentication.md).

Authorisation is checked **server-side on every request**, by `withAdmin` in
`lib/auth.js`. A request without a valid session cookie gets 401 whatever made
it: the dashboard, curl, Postman, another origin. The `/admin` page redirect in
`proxy.js` is a convenience for humans and protects nothing.

Every request also re-checks that the account still exists and that its address
is still on `ADMIN_EMAILS`, so removing an address revokes its sessions
immediately rather than when the cookie expires.

Responses are never cacheable (`Cache-Control: no-store`).

---

## Conventions

### Request

JSON bodies only. A non-object body is a 400 before any field is examined.

Validation schemas are **strict**: an unrecognised key is an error, not a
silently dropped field. Server-owned fields are rejected rather than ignored —
`readingMinutes`, `authorId`, `Resume.version`, `Resume.isActive`.

`PATCH` sends only what changed. An empty body is a 400: it is always a caller
bug, and accepting it would write an audit entry claiming an update happened.

### Response

Collections:

```json
{ "items": [...], "total": 42, "take": 100, "skip": 0 }
```

Single items: `{ "item": { ... } }` — 201 on create, 200 on read and update,
204 with no body on delete.

Errors, always this shape:

```json
{ "error": { "message": "Some fields need attention.",
             "fields": { "slug": "Already taken." } } }
```

`fields` maps a form input name to its problem, so the dashboard can render the
message beside the input. A whole-object problem is filed under `_`. A nested
path is dot-joined (`items.0`).

### Status codes

| Code | When |
|---|---|
| 400 | Validation failed, or a malformed body / query |
| 401 | Not signed in |
| 404 | No such row — possibly deleted in another tab |
| 405 | Method not registered on this route; `Allow` header lists what is |
| 409 | Valid request, conflicting state: slug taken, row still referenced, file in use |
| 500 | Unexpected. Fixed message; detail goes to the server log only |

### Query parameters on every collection

| Name | Default | Notes |
|---|---|---|
| `q` | — | Free-text search across that entity's text fields |
| `status` | — | `DRAFT` or `PUBLISHED`. Ignored by entities with no publication state (Tag, Media) |
| `take` | 100 | 1–200 |
| `skip` | 0 | |

---

## Entities

Nine entities follow the same shape. Substitute the path:

| Entity | Path | Reorder | Publish |
|---|---|---|---|
| Skills | `/skills` | yes | yes |
| Education | `/education` | yes | yes |
| Experiences | `/experiences` | yes | yes |
| Projects | `/projects` | yes | yes |
| Social links | `/social-links` | yes | yes |
| Section copy | `/section-copy` | yes | yes |
| Blog posts | `/blog` | no — ordered by publication date | yes |
| Tags | `/tags` | no | no |
| Résumés | `/resumes` | no | no — see `activate` |
| Media | `/media` | no | no |

```
GET    /api/admin/{path}                 list
POST   /api/admin/{path}                 create                       → 201
GET    /api/admin/{path}/{id}            read
PATCH  /api/admin/{path}/{id}            update
DELETE /api/admin/{path}/{id}            delete                       → 204
POST   /api/admin/{path}/reorder         { ids: [...] }               (orderable only)
POST   /api/admin/{path}/{id}/publish    { status: "PUBLISHED" }      (publishable only)
```

`media` has no `POST` on its collection — Media rows describe files that already
exist at the storage provider, so `POST /api/admin/media/upload` is their only
writer. A create attempt on the collection gets 405.

### Reorder

```http
POST /api/admin/skills/reorder
{ "ids": ["clx…a", "clx…b", "clx…c"] }
```

Send the **whole list** in its new order; positions are assigned `0, 1, 2, …`
in one transaction. Every id is verified to exist first, so a stale id returns
409 and changes nothing rather than half-applying. Duplicate ids are rejected.

### Publish

```http
POST /api/admin/blog/{id}/publish
{ "status": "PUBLISHED" }
```

Separate from `PATCH` so the audit entry reads `publish` / `unpublish` rather
than a generic `update`.

For a blog post this also stamps `publishedAt` the first time it goes live, and
preserves it afterwards — editing a typo in a two-year-old post does not move it
to the top of the archive, and unpublishing then republishing restores it to
where it was.

---

## Singletons

```
GET /api/admin/profile      PUT /api/admin/profile
GET /api/admin/seo          PUT /api/admin/seo
```

`PUT` takes the complete object and upserts on the literal id `"singleton"`,
which is what keeps a second row unreachable. `GET` returns
`{ "item": null }` when unconfigured — a normal state on a fresh install, not a
404.

---

## Résumés

CV uploads are versioned: replacing the CV adds a row and flips a flag rather
than overwriting a file, so the previous version stays downloadable and a bad
upload is undone by activating the old one.

```http
POST /api/admin/resumes
{ "label": "CV 2026", "mediaId": "clx…" }
```

`version` is assigned server-side as `max(version) + 1`, inside the transaction,
so two uploads cannot claim the same number. A new upload is never live until
activated.

```http
POST /api/admin/resumes/{id}/activate
```

Activates one version and deactivates the others in a single transaction —
exactly one CV is active, and the public download route has to pick one.

Deleting the active CV returns 409: activate a different version first.
Deleting the `Media` row under a live résumé also returns 409, enforced by a
database-level `RESTRICT` rather than by application code.

---

## Blog posts

Additional behaviour beyond the standard shape:

- **`slug`** — omitted, it is derived from the title and a free variant is found
  automatically (`my-post-2`). Supplied explicitly, it is used as given and a
  collision is a 409, because quietly renaming a URL the user chose would
  publish something they cannot see they got.
- **`readingMinutes`** — recomputed from the Markdown on every save, never
  accepted from the client. Fenced code and URLs are excluded from the count.
- **`tagIds`** — existing tag ids only. Tags are created through
  `/api/admin/tags`; a free-text tag field produces near-duplicates that then
  need finding and merging. A stale id returns 400 with a `tagIds` field error.
  Tags are replaced wholesale on update.
- **`publishedAt`** — optional ISO datetime **with offset**, for backdating an
  imported post. Left out, the server manages it as described under Publish.
- **`coverAlt`** — required once `coverMediaId` is set. Both columns are
  independently nullable and only the combination is wrong, so the database
  cannot enforce it.
- Author is always the signed-in user. The response includes an explicit
  allowlist of author fields — never `passwordHash`.

---

## Uploads

```http
POST /api/admin/media/upload?filename=logo.png&alt=The%20site%20logo
Content-Type: image/png

<raw bytes>
```

**The body is the file itself**, not multipart — one file per request, metadata in
the query string. That avoids a multipart parser entirely; `fetch(url, { body: file })`
is the client side of it, and `components/admin/useUpload.js` wraps it with
progress reporting.

Returns 201 with the created `Media` row.

| Code | When |
|---|---|
| 400 | The bytes are not an accepted type, or disagree with the declared one |
| 401 | Not signed in |
| 413 | Over the 4 MB limit |
| 503 | Storage is not configured, or the store is private (see below) |

**A file's type is decided by its bytes.** The extension and the `Content-Type`
header are both client-supplied, so neither is trusted: magic signatures are
checked at fixed offsets, with a second signature where the container needs one
(`RIFF` alone is also WAV and AVI). A PDF renamed `.png` is refused, and the
message says what the file actually is.

Accepted: JPEG, PNG, WebP, GIF, AVIF, PDF. **SVG is refused** — it is a document
that can carry scripts, and serving one from this origin would let it run as if
the site had written it.

The limit is 4 MB, below Vercel's 4.5 MB serverless request-body limit, and is
enforced while streaming rather than after buffering.

**The uploaded filename never becomes the storage path.** Keys are
`{images|documents}/YYYY-MM/{32 hex}.{ext}`, with the extension the bytes earned.
The original name is kept for display and in the audit log only.

Image dimensions are read from the file header where the format allows (PNG, GIF,
JPEG, WebP); AVIF yields null.

### Deleting media

`DELETE /api/admin/media/{id}` removes the row, then the stored file — in that
order, because `Resume.mediaId` is `ON DELETE RESTRICT` and Postgres only
evaluates it when the row goes. Deleting the file behind the active CV returns
409 with the file untouched.

If the storage cleanup fails after the row is gone, the delete still reports
success and the leftover file is swept up by:

```
npm run media:prune            # report only
npm run media:prune -- --apply # delete
```

which finds both unreferenced rows and stored files with no row.

---

## The CV link

```
GET /cv    → 302 to the active resume's file
```

Public, no authentication — a CV link that only works when signed in is not a CV
link. The URL never changes: uploading a new CV activates a new row pointing at a
new object, so every link already shared keeps working and starts serving the new
file.

404 while no resume is active, uncached so it stops being a 404 the moment one
is. 302 rather than 301, since a permanent redirect would be cached indefinitely
and pin the link to whichever CV was active the first time it was clicked.

---

## Account

The signed-in admin's own account. Not CRUD: no create, no delete, no list, and
nothing here can act on another account.

```
GET  /api/admin/account           who am I
POST /api/admin/account/password  change password                    → 204
```

`GET` returns the same fields `getSessionUser` resolved, plus two derived facts
about how the account can sign in:

- `hasPassword` — a boolean, not the hash — so the dashboard can offer "set a
  password" for an account that has only ever used Google.
- `linkedProviders` — `[{ provider, linkedAt }]`. The `providerAccountId` is
  deliberately absent: it identifies the Google account itself, the dashboard has
  no use for it, and a value with no use is a value that only has downsides if it
  leaks.

`POST` takes `{ currentPassword?, newPassword }`. The current password is
required whenever one is set. That is the check which makes a stolen session
cookie insufficient to lock the real owner out: without it, anyone holding a
session could set a new password and take the account permanently.

Password policy: at least 12 characters, and at most 72 **bytes** — bcrypt reads
no further, so anything longer would be silently ignored rather than protecting
you. Setting the same password again is rejected, so no audit entry claims a
change that did not happen.

There is no account-creation or password-reset endpoint. Both are CLI-only:

```
npm run admin:create           create the admin account
npm run admin:reset-password   set a new password
```

Both read the password from hidden stdin, so it never reaches a file, a shell
history, a process listing, or an environment variable.

---

## Sign-in

Handled by NextAuth at `/api/auth/*`. Two methods, both restricted to
`ADMIN_EMAILS`:

- **Google** — the address must be allowlisted, verified by Google, **and**
  already have an `AdminUser` row. Google sign-in links an identity to an
  existing admin; it never creates one, and a rejected attempt leaves no row
  behind.
- **Email and password** — bcrypt, with the allowlist re-checked after the
  password matches.

Failures are uniform: wrong password, unknown address and a de-allowlisted
account all answer `Incorrect email or password.`, with equalised timing, so the
response cannot be used to discover which addresses have accounts.

Rate limited to 5 failures per account or 10 per IP address in 15 minutes,
counted from the audit log so the limit holds across serverless instances. The
limit is checked before the password is verified, so a correct password is also
refused while it holds.

---

## Audit log

```
GET /api/admin/audit?entity=BlogPost&entityId=clx…&action=publish&take=50
```

Read-only, and there is deliberately no write, update or delete route anywhere:
an audit trail an admin can edit is not an audit trail. Rows are written only by
`recordAudit`, inside the same transaction as the change they describe.

Each entry records actor, action (`create` `update` `delete` `publish`
`unpublish` `reorder`), entity, entity id, IP, and a `diff` of
`{ field: { from, to } }` covering changed fields only.

Password hashes, tokens and API keys are recorded as `[redacted]` — the fact
that a secret changed is kept, the values are not. Long values are truncated:
a 200 KB Markdown body would make the audit row larger than the post it
describes.

---

## Where the code is

| Concern | File |
|---|---|
| Method allowlist, auth, error envelope, body parsing | `lib/api/handler.js` |
| CRUD, reorder, publish, transactions | `lib/api/resource.js` |
| Per-entity config and hooks | `lib/api/resources/*.js` |
| Validation schemas (shared with the forms) | `lib/validation/*.js` |
| Error classes and Prisma error mapping | `lib/api/errors.js` |
| Audit diffing and redaction | `lib/api/audit.js` |
| Session guard (gate 3) | `lib/auth.js` |
| NextAuth config, sign-in gates 1 and 2 | `lib/authOptions.js` |
| Email allowlist | `lib/adminEmails.js` |
| bcrypt hashing and password policy | `lib/password.js` |
| Login rate limiting | `lib/rateLimit.js` |
| `/admin` page redirect (convenience only) | `proxy.js` |
| Object storage — the only file importing the vendor SDK | `lib/storage.js` |
| Magic bytes, size caps, storage keys, dimensions | `lib/uploads.js` |
| Upload handler | `lib/api/resources/upload.js` |
| Media relations the prune script must know about | `lib/mediaRelations.js` |
| Password policy, with no bcrypt dependency so the form can share it | `lib/passwordPolicy.js` |
| The dashboard's HTTP client, error envelope and 401 handling | `lib/adminClient.js` |
| Server-side page guard | `lib/adminPage.js` |

Route files under `pages/api/admin/` are three lines each and contain no logic.
