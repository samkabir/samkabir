# Portfolio CMS — Implementation Plan

Turning this static portfolio into a database-backed site with a private admin
dashboard, so content is managed through a UI instead of by editing
`data/*.js` and redeploying.

**Status:** Phases 1–5 complete and verified. Phase 6 next, nothing blocking
(see [`Todo/01-create-neon-database.md`](Todo/01-create-neon-database.md)).

---

## Locked decisions

| Concern | Choice | Why |
|---|---|---|
| Backend | Next.js API routes | Next.js already *is* a backend. One repo, one deploy, no CORS, no second service to host or secure. |
| Router | Pages Router (stay) | The App Router in Next 16 needs React 19; this project is pinned to React 18.2 with MUI 5.11, which does not officially support React 19. Staying avoids a React 18→19 + MUI 5→7 migration that risks the existing design. Pages Router still gives SSG, ISR, on-demand revalidation and API routes. |
| Database | Neon Postgres | Strongest genuinely-free Postgres: 0.5 GB, no credit card, auto-suspends to zero and wakes on connection. |
| ORM | Prisma, pinned to 6.x | Versioned SQL migrations and seeding were explicit requirements; the schema file doubles as documentation. Pinned to v6 because v7 requires a TypeScript config file, `dotenv` and a driver adapter — see [ADR 0001](docs/adr/0001-orm-and-prisma-version.md). |
| Auth | NextAuth v4 | The Pages-Router-native version. Google + Credentials in one config, httpOnly signed cookies, CSRF built in. |
| Password hashing | bcryptjs | Pure JS, no native build step — so it cannot hit the class of problem that broke the build in Phase 1. |
| Validation | Zod | One schema per entity, imported by both the dashboard form and the API handler. |
| File storage | Vercel Blob | One env var, no second account. Behind `lib/storage.js` so it can be swapped. |
| Blog content | Markdown | Portable and diffable. Rendered with `remark-gfm` + `rehype-sanitize`. |
| Dashboard UI | MUI 5 + Tailwind | Already dependencies. No new UI framework. |
| Tests | Vitest | Covers Zod schemas, auth guards, and the migration mapping. |
| Password recovery | CLI-only | No email dependency, no attack surface. Requires terminal access to recover. |

### Why not SQLite

Vercel's production filesystem is **read-only**. A SQLite file lives in that
filesystem, so the public site could read content but every dashboard save
would fail — which removes the point of the CMS. Writes to `/tmp` do not
survive past a single function invocation. Turso (hosted libSQL) would work
technically but needs the same signup-and-token flow as Neon, so it buys
nothing.

### Fallback if Vercel Blob's free allowance changes

Cloudinary — 25 credits/month, free indefinitely, no card. `lib/storage.js`
keeps the provider behind an interface, so switching is a one-file change
rather than a migration.

---

## Rules this work follows

1. **Inspect before changing.** Understand the existing architecture first.
2. **Preserve the existing UI.** Components change their *data source*, not
   their markup. The only visual-layer change proposed is `<img>` →
   `next/image`, and only because it fixes measurable layout shift.
3. **Minimise dependencies.** Every package added is justified in the table
   above.
4. **Reuse existing code.** Existing components, colours, fonts and patterns
   are adapted, not replaced.
5. **No hardcoded secrets.** Ever, in any form, including seed files.
6. **Production quality.** Not a prototype.
7. **Backward compatibility.** Existing functionality keeps working.
8. **Validate on both sides.** Same Zod schema client and server.
9. **Authorization is server-side.** Hiding a route is not security.
10. **Document decisions.** Anything a future reader would have to re-derive.

---

## Phase 1 — Repair the baseline ✅ COMPLETE

**Objective.** Get the project building, linting and rendering as it is today,
before adding anything. The repo did not compile, so nothing after this would
have been verifiable.

**What was wrong.**

- `pages/_app.js` imported `@/styles/globals.css`, but commit `da82247`
  deleted `styles/` — so Tailwind emitted nothing and the build failed.
- `next build` died with `Bus error (core dumped)`. Root cause: the
  `@next/swc` native binary was truncated to 38 MB while its ELF `PT_LOAD`
  headers described a 130 MB shared object. `mmap` succeeds on such a file;
  faulting a page past end-of-file raises SIGBUS. npm re-served the same bad
  tarball from cache, so a forced reinstall was a no-op.
- `npm run lint` was broken — Next 16 removed the `next lint` command.
- Both `mailto:` links displayed `samkabir26@gmail.com` but pointed at
  `admin@gamblingco.in`.
- Two projects referenced screenshots deleted in the same commit.
- `prop-types` was imported but resolved only transitively through MUI.
- `.gitignore` covered `.env*.local` but not plain `.env`.

**Changes.** Restored `styles/globals.css` and both screenshots from
`da82247^`; pinned `turbopack.root`; replaced `next lint` with a flat ESLint
config; fixed the mailto targets; declared `prop-types`; hardened
`.gitignore`; escaped apostrophes and switched the logo link to `next/link`.
Fixed the SWC truncation with `npm cache clean --force` plus a reinstall.

**Result.**

```
npm run build  →  compiled in ~1.7s, 3 routes prerendered
npm run lint   →  0 errors, 3 warnings (all the planned next/image work)
```

The restored stylesheet is confirmed in the compiled CSS — `#141e30`,
`.writer-text2` and the `scaleIn` keyframes all emit, where before Tailwind
produced nothing.

**Deliberately not fixed.** `pages/index.js` gates the page behind a loading
state set in an empty effect, so the prerendered HTML is **2,476 bytes** of
spinner with no indexable content. Annotated `TODO(phase-7)` rather than
changed — removing it alters what renders, and belongs in the phase where the
result can be diffed visually. **2,476 bytes is the baseline Phase 7 is
measured against.**

---

## Phase 2 — Database design and schema ✅ COMPLETE

**Objective.** Turn the content model into a Prisma schema with a first
migration, verified against a live database.

**Done.** Prisma installed and pinned to **6.19.3**; `prisma/schema.prisma`
written — 16 models, 3 enums, 12 foreign keys; initial migration SQL generated
and committed; `lib/prisma.js` singleton; `scripts/db-smoke.mjs`; `db:*` scripts;
ADRs 0001 and 0002.

```
npx prisma validate   →  the schema at prisma/schema.prisma is valid
npx prisma generate   →  16 models, 3 enums in the generated client
npm run build         →  compiled in 3.6s, 3 routes prerendered
npm run lint          →  0 errors, 3 warnings (unchanged from Phase 1)
```

**Migration applied.** Neon project `samkabir-portfolio`, database `neondb`,
region `ap-southeast-1`, pooled and direct connections both confirmed.

```
npm run db:migrate:deploy  →  20260823071807_init applied
                              17 tables (16 models + _prisma_migrations)
                              3 enums: ExperienceKind, PublishStatus, UserRole
npm run db:migrate:status  →  database schema is up to date
npm run db:smoke           →  27 passed, 0 failed
```

The smoke test is the part worth keeping: it confirmed against the real database
that defaults fire (`Skill` → PUBLISHED, `BlogPost` → DRAFT, `Profile.id` →
`singleton`), that both unique constraints reject duplicates, that
`ON DELETE RESTRICT` stops a `Media` row being deleted while a `Resume` points at
it, that deleting a `BlogPost` cascades to its tag joins, and that an `AuditLog`
row survives deletion of its actor with `actorId` nulled rather than the row
vanishing. Those are the rules that are easy to write down wrongly in a schema
and only discover at runtime.

The migration was generated with `prisma migrate diff --from-empty`, which needs
no database, rather than `migrate dev`, which does. Same SQL either way — it
means the schema is reviewable and committed now instead of after the credentials
arrive.

**Five deviations from this plan, each deliberate.**

1. **Prisma pinned to v6, not `latest`.** `prisma@latest` is 7.9.1, which removes
   `url` and `directUrl` from the schema and requires a `prisma.config.ts`,
   `dotenv`, and a driver adapter — a TypeScript config file and three extra
   packages, in a project with no TypeScript. See
   [ADR 0001](docs/adr/0001-orm-and-prisma-version.md).

2. **`PublishStatus` on everything**, replacing the sketch's mix of `status`,
   `isPublished` and `isVisible`. A mixed convention is how a draft leaks. See
   [ADR 0002 §3](docs/adr/0002-database-schema.md).

3. **`.env.local`, bridged by `scripts/with-env.mjs`.** Phase 2 originally
   chose `.env`, on the grounds that the Prisma CLI reads it and `.env.local`
   only works for Next.js. That reasoning was sound but the change was never
   carried into `Todo/` or `.env.example`, both of which still said
   `.env.local` — so the `db:*` scripts would have run with no `DATABASE_URL`
   the first time anyone used them. Resolved the other way instead: secrets stay
   in `.env.local`, and every `db:*` script goes through
   `scripts/with-env.mjs`, which calls Node's built-in `process.loadEnvFile` on
   `.env` then `.env.local` before spawning the real command. `.env.local` wins
   on conflict, matching Next.js precedence. No new dependency, one convention,
   and a clear error instead of a Prisma stack trace when the file is missing.

4. **`db:seed` deferred to Phase 7**, where the seed script is actually written.
   A script entry pointing at a file that does not exist is a broken script, not
   a placeholder.

5. **`OAuthAccount` is ours, not `@next-auth/prisma-adapter`'s shape.** The
   adapter persists a user row during the OAuth handshake, which is the wrong
   order given the requirement that a rejected sign-in leave no trace. See
   [ADR 0002 §5](docs/adr/0002-database-schema.md).

**Fields added beyond the sketch**, all from re-reading the components rather
than from the data files: `Profile.showLeetcode` (the LeetCode block is an open
question, so it needs a switch); `SectionCopy.navLabel` / `anchor` / `showInNav`
(the nav says "Work" where the section says "Some Projects I worked on...", and
both labels were duplicated across two files); `Project.isNda` (five commented-out
entries carry an NDA disclaimer in their description); `Media.pathname` unique
(deletion needs the provider path, and parsing it back out of a CDN URL is
brittle).

**Blocked on:** `Todo/01-create-neon-database.md`.

- **Files:** `prisma/schema.prisma`, `prisma/migrations/`, `lib/prisma.js`,
  `package.json` scripts, `.env.example`.
- **Database:** all models, enums, and indexes on every `slug`, `order` and
  `status`. Scripts for `db:migrate`, `db:push`, `db:studio`, `db:seed`.
- **Frontend / Auth / API:** none yet.
- **Migration:** initial only; no data.
- **Testing:** migrate up and down cleanly on a scratch database; client
  generates; a smoke script reads and writes each model.
- **Docs:** schema decisions recorded as ADRs; `.env.example` with names only.
- **Packages:** `prisma` (dev), `@prisma/client`.
- **Risks:** serverless connection limits — mitigated by a pooled connection
  string and a singleton client. Getting the singleton wrong exhausts
  connections under dev hot-reload, so it is written the documented way.
- **Result:** a versioned schema and a reproducible `migrate` path.

### The data model

> **Superseded by the real thing.** `prisma/schema.prisma` is now authoritative,
> and it is commented. The sketch below is kept as the record of what was planned
> before the schema was written; where the two differ, the schema is right and the
> difference is explained in Phase 2's deviations above.

Four deliberate departures from the current static shape:

- **Experience and ContractualExperience become one table** with a `kind`
  discriminator. The two source files are structurally identical and the two
  components are near-duplicates. One model means one form, one API, one
  validation schema — and a role can be reclassified without moving rows.
- **Real dates replace display strings.** `startDate` / `endDate` /
  `isCurrent` instead of `'July 2025 - Present'`, so ordering is computed
  rather than manual. An optional `timelineOverride` preserves any label that
  should read differently.
- **Everything orderable gets an explicit `order`**, everything publishable
  gets a status. The dashboard can reorder and unpublish without deleting.
- **Uploads are first-class rows.** `Media` and a versioned `Resume` mean
  replacing a CV keeps the old one recoverable instead of overwriting a file.

```
AdminUser      id, email(unique), name, image, passwordHash?, role,
               lastLoginAt, createdAt, updatedAt
Account        NextAuth OAuth linkage (Google) → AdminUser

Profile        singleton. greeting, fullName, headline, tagline, bio,
               publicEmail, contactEmail, leetcodeUsername, footerCredit,
               attributionLabel, attributionUrl, avatarMediaId?
SeoSettings    singleton. siteTitle, defaultDescription, canonicalUrl,
               ogImageMediaId?, twitterHandle?
SectionCopy    key(unique), numberLabel, heading, subheading?, order,
               isVisible          ← the 00/01/10/11 numbering becomes data

Education      institution, degree, field, note, startYear?, endYear?, order
Skill          name(unique), category?, order, isPublished
Experience     kind[FULL_TIME|CONTRACT], jobPosition, companyName, isNda,
               location?, startDate, endDate?, isCurrent, timelineOverride?,
               responsibilities String[], order, isPublished
Project        slug(unique), title, description, coverMediaId?, repoUrl?,
               liveUrl?, stacks String[], isFeatured, order, status
SocialLink     platform, label, url, iconKey, order, isPublished,
               showInSidebar, showInContact
Resume         label, mediaId, version, isActive, uploadedAt

BlogPost       slug(unique), title, excerpt, contentMarkdown, coverMediaId?,
               coverAlt?, status[DRAFT|PUBLISHED], publishedAt,
               readingMinutes, seoTitle?, seoDescription?, ogMediaId?,
               authorId, createdAt, updatedAt
Tag            slug(unique), name
BlogPostTag    many-to-many join

Media          url, pathname, mimeType, sizeBytes, width?, height?, alt?,
               uploadedById, createdAt
AuditLog       actorId, action, entity, entityId, diff Json, ip?, createdAt
```

**A judgement call.** Responsibility bullets are a Postgres `String[]`, not a
child table. They are never queried or shared across roles — they only need
reordering inside one form — so a child table would add joins and id
management for nothing. If individual bullets ever need tagging or reuse, that
becomes a migration; unlikely.

---

## Phase 3 — Validation layer and admin API ✅ COMPLETE

**Objective.** Build the protected CRUD surface with one handler pattern, so
every entity behaves identically and no route can forget its auth check.

- **Files:** `lib/validation/*.js` (one Zod schema per entity),
  `lib/api/handler.js`, `lib/auth.js`, `pages/api/admin/**`.
- **API:** full CRUD per entity plus `reorder` and `publish`. Consistent error
  envelope `{ error: { message, fields? } }`, where `fields` maps Zod issues
  onto form inputs. `AuditLog` written on every mutation.
- **Auth:** `withAdmin()` is written here and **stubbed to deny-all** until
  Phase 4, so no route is ever open by default.
- **Testing:** Zod unit tests (valid, invalid, boundary, injection-shaped);
  every route returns 401 unauthenticated, asserted per route rather than
  assumed; 405 on disallowed methods; reorder is transactional.
- **Packages:** `zod`, `vitest` (dev).
- **Risks:** a hand-rolled route that skips `withAdmin()` is the classic hole.
  The suite asserts 401 across an enumerated list of every admin route, so a
  new unguarded route fails CI.
- **Result:** a complete, tested, uniformly guarded API.

**Done.** 12 validation modules in `lib/validation/`; `lib/api/handler.js`,
`resource.js`, `errors.js`, `audit.js`, `slugs.js`; 12 resource definitions in
`lib/api/resources/`; `lib/auth.js` denying all; 37 route files under
`pages/api/admin/`; `lib/slug.js` and `lib/blog.js` helpers; 158 tests;
[ADR 0003](docs/adr/0003-admin-api.md) and [docs/api.md](docs/api.md).

```
npm test       →  158 passed, 6 files
npm run build  →  compiled in 1.8s, 37 API routes registered
npm run lint   →  0 errors, 3 warnings (unchanged since Phase 1)
```

Verified additionally by a throwaway integration pass against the live Neon
database with the guard mocked — 28 checks covering create/list/update/
reorder/publish/delete, audit rows written in-transaction, slug derivation and
collision, blog publish-date preservation, résumé versioning and activation,
singleton upsert, and the RESTRICT mapping. Removed after running; the database
was left empty.

**One deviation from the plan, and it is an improvement.** The plan said the
401 suite would assert "an enumerated list of every admin route". It globs
`pages/api/admin/**/*.js` instead and asks each route which methods it serves
via its own `Allow` header. A hand-written list is exactly as good as whoever
last remembered to update it, and the failure mode is a new unguarded endpoint
that no test mentions. Globbing means adding a route file adds it to the suite.

**Three bugs found by the tests, none visible by reading the code.**

1. **`Argument 'description' must not be null`.** The optional-text primitive
   mapped every empty value to `null` — correct for a nullable column, wrong for
   `Project.description` and `BlogPost.excerpt`, both `String @default("")` and
   therefore NOT NULL. A valid create request produced a 500 with no field to
   attach it to. Fixed with a separate `textOrEmpty` primitive, and
   `tests/schemaAlignment.test.js` now reads `schema.prisma` and asserts the
   general rule across every entity.

2. **An empty PATCH body was accepted.** `partialOf` counted the keys of the
   *parsed* object, but `.partial()` still applies `.default()` — so `{}` came
   out with keys and passed, on every entity that has a default. The check now
   runs against the raw body.

3. **Whitespace broke email and URL validation.** `z.email()` and `z.url()`
   reject a string with surrounding spaces, so trimming *after* the format check
   rejected a pasted address that merely had a trailing space. Both now normalise
   first and validate second.

**Deferred deliberately:** deleting the file at the storage provider when a
Media row is deleted. That needs the storage layer from Phase 5; the dangerous
case — removing the file a live CV points at — is already blocked by a database
RESTRICT.

### Conventions every handler follows

Method allowlist → `withAdmin()` → Zod parse → Prisma call. Never a different
order. Nothing echoes a `passwordHash`. No admin response is cacheable.

---

## Phase 4 — Authentication ✅ COMPLETE

**Objective.** Google and email/password sign-in for exactly one allowlisted
identity, with no registration path and no plaintext password anywhere.

**Needs:** `Todo/02-set-up-google-sign-in.md`.

- **Files:** `pages/api/auth/[...nextauth].js`, `lib/auth.js` (real),
  `pages/admin/login.js`, `middleware.js`, `scripts/create-admin.js`,
  `scripts/reset-password.js`.
- **Auth:** Google + Credentials providers; `signIn` callback allowlists
  `ADMIN_EMAILS`; bcrypt verification; JWT sessions in httpOnly `SameSite=Lax`
  `Secure` cookies; rate-limited credentials endpoint; change-password
  requiring the current password.
- **Database:** `Account` for Google linkage; `passwordHash` and `lastLoginAt`
  populated.
- **Testing:** a non-allowlisted Google account is rejected and creates no
  row; wrong password fails and correct succeeds; the rate limit trips; a
  direct curl to an admin route without a cookie returns 401; the session
  cookie is httpOnly and Secure.
- **Packages:** `next-auth`@4, `@next-auth/prisma-adapter`, `bcryptjs`.
- **Risks:** OAuth redirect URIs differ between local and production and are a
  common launch failure. Both get documented and tested.
- **Result:** only you can sign in, by either method. No secret in the repo.

**Done.** `lib/authOptions.js` (Google + Credentials, three gates), `lib/auth.js`
(real `getSessionUser` with a per-request allowlist re-check),
`lib/adminEmails.js`, `lib/password.js`, `lib/rateLimit.js`,
`lib/returnPath.js`, `lib/api/resources/account.js`,
`pages/api/auth/[...nextauth].js`, `pages/admin/login.js`,
`pages/admin/index.js` (placeholder), `proxy.js`, `scripts/prompt.mjs`,
`scripts/create-admin.mjs`, `scripts/reset-password.mjs`, and
[ADR 0004](docs/adr/0004-authentication.md).

```
npm test       ->  213 passed, 7 files (53 new, auth)
npm run build  ->  compiled in 2.3s, 40 API routes + proxy
npm run lint   ->  0 errors, 3 warnings (unchanged since Phase 1)
```

Verified additionally by a throwaway end-to-end pass against a running dev
server - **38 checks, all passing** - driving the real NextAuth HTTP flow with a
cookie jar: unauthenticated 401 on GET and POST with nothing written; `/admin`
redirecting to the login page; a wrong password issuing no cookie and revealing
nothing; failures recorded without the attempted password or the guessed
address; correct sign-in issuing an `HttpOnly` `SameSite=Lax` cookie carrying a
JWT rather than the account id; authenticated reads and writes attributed to the
signed-in admin in the audit log; `lastLoginAt` stamped; the dashboard rendering
and `noindex`; and sign-out invalidating the session. Removed after running; the
database was left empty.

Two properties were worth confirming precisely rather than loosely, and both
were:

* **Revocation actually works.** A live, cryptographically valid session cookie
  is refused the moment the address stops matching `ADMIN_EMAILS`, and accepted
  again when restored. Without the per-request re-check this would have taken up
  to seven days.
* **The rate limit blocks a correct password.** Verified step by step: the right
  password succeeds at four recorded failures and is refused at five, with
  `Too many failed sign-in attempts. Wait 15 minutes and try again.` reaching
  the client. The first version of that assertion was a loose regex that could
  have passed for the wrong reason, so it was redone as an exact check.

**Three deviations from this plan, each deliberate.**

1. **No `@next-auth/prisma-adapter`.** The plan listed it as a package; the
   schema was designed in Phase 2 not to match its shape, and this is why. The
   adapter persists a user row during the OAuth handshake, before application
   logic runs - so a rejected stranger would leave a row behind, contradicting
   the requirement that a rejected sign-in leave no trace. The `signIn` callback
   writes the link row itself, after the allowlist passes. Asserted directly: a
   rejected Google sign-in never calls `adminUser.create`.

2. **Rate limiting counts audit rows instead of holding state in memory.** The
   plan said "rate-limited credentials endpoint" without saying how. An
   in-memory `Map` would be close to useless on Vercel - per-instance memory,
   forgotten on every cold start - so a limit that only held locally would read
   as protection while providing little. Failures are already written to
   `AuditLog`; counting recent rows works across instances and adds no table and
   no dependency.

3. **`proxy.js`, not `middleware.js`.** Next.js 16 deprecated the `middleware`
   file convention. Building on a deprecated convention on day one is a
   migration scheduled for an inconvenient moment.

**Four bugs and surprises, all found by tests rather than by reading.**

1. **`CredentialsProvider` discards the `authorize` you pass it.** It returns
   `{ authorize: () => null, options }` and NextAuth merges the real function in
   at request time. The first test suite called `provider.authorize(...)`, which
   exercised NextAuth's stub, returned `null`, and asserted nothing.
   `authorizeCredentials` is now exported and tested directly.

2. **bcrypt silently truncates at 72 bytes** - confirmed by experiment, not
   assumed: a 90-character passphrase and a truncated variant sharing its first
   72 bytes authenticate identically. The policy now rejects anything longer,
   counted in *bytes*, since emoji and non-Latin scripts reach the limit far
   sooner than their length suggests.

3. **A test counted `adminUser.update` calls and failed for the wrong reason.**
   `recordLoginSuccess` also updates the row to stamp `lastLoginAt`, so "did
   Google overwrite the dashboard name" had to be asserted on *what* was written.

4. **Every CLI run printed a Node warning.** `MODULE_TYPELESS_PACKAGE_JSON`, from
   importing ESM `lib/*.js` files. Adding `"type": "module"` would break
   `next.config.js`, `tailwind.config.js` and `postcss.config.js`, all CommonJS,
   so the single warning is silenced instead.

**Not covered by automated tests:** completing a real Google OAuth round trip,
which needs a real Google account and a browser. The callback logic is tested
directly - including that a non-allowlisted address is rejected and creates no
row - but the happy path needs a human click. Flagged rather than glossed.

### Three independent gates

1. **Provider level.** Both sign-in methods terminate in NextAuth's `signIn`
   callback, which returns `false` unless the email is in `ADMIN_EMAILS` *and*
   matches an existing `AdminUser`. A stranger with a valid Google account is
   rejected at the callback and no row is created.
2. **Credentials level.** Verified against a bcrypt hash. There is **no signup
   endpoint**. The first admin is created by `npm run admin:create`, which
   reads the email from env and prompts for the password on hidden stdin. The
   plaintext never touches a file, a seed script, or a git object.
3. **Request level.** Every `/api/admin/*` handler is wrapped in
   `withAdmin()`, which 401s before the handler body runs. This is the gate
   that matters: curl, Postman and cross-origin requests hit the same check as
   the dashboard. The `middleware.js` redirect is a convenience for humans,
   **not** a security boundary.

**On account linking.** Signing in with Google using the same address as the
credentials admin would normally be refused, as protection against takeover by
email claim. Linking is enabled *only* for emails already on the
`ADMIN_EMAILS` allowlist — safe because that list is server-side
configuration, not user input.

---

## Phase 5 — File storage and media ✅ COMPLETE

**Objective.** Make uploads work end to end, safely. The CV, blog covers and
project images all depend on it, so it blocks Phases 6–8.

**Needs:** `Todo/03-create-vercel-blob-store.md`.

- **Files:** `lib/storage.js`, `pages/api/admin/media/upload.js`,
  `pages/api/cv.js`, `components/admin/ImageField.jsx`, `FileField.jsx`.
- **Security:** MIME **and** magic-byte checks, not just the extension;
  per-type size caps; generated storage keys, never the client's filename;
  uploads authenticated and audited; orphaned `Media` rows cleaned up.
- **Frontend:** drag-and-drop with progress, preview and an alt-text field;
  replace and remove with confirmation.
- **Testing:** a PDF renamed `.png` is rejected; an oversized upload is
  rejected with a readable error; an unauthenticated upload returns 401;
  `/cv` redirects to the active resume.
- **Packages:** `@vercel/blob`.
- **Risks:** serverless request-body limits make large PDFs fail server-side;
  client-direct upload with a signed token avoids it. Storage is the one hard
  vendor dependency, so it stays behind an interface.
- **Result:** any image or PDF uploadable from the dashboard and served from a
  stable URL. `/cv` becomes a permanent shareable link.

**Done.** `lib/uploads.js` (magic bytes, size caps, key generation, dimension
parsing), `lib/storage.js` (the only file importing the vendor SDK),
`lib/mediaRelations.js`, `lib/api/resources/upload.js`,
`pages/api/admin/media/upload.js`, `pages/api/cv.js` plus the `/cv` rewrite,
`scripts/prune-media.mjs`, `components/admin/{useUpload,FileField,ImageField}.js`,
and [ADR 0005](docs/adr/0005-file-storage.md).

```
npm test       ->  271 passed, 11 files (44 new: uploads, media relations, /cv, delete ordering)
npm run build  ->  compiled in 2.2s
npm run lint   ->  0 errors, 3 warnings (unchanged since Phase 1)
```

Verified additionally by a throwaway end-to-end pass against a running dev
server and the live Blob store — **39 checks, all passing**: real files
uploading with correct MIME type, byte size, dimensions and attribution; a PDF
renamed `.png` refused with a message naming what it really is; HTML declared as
an image refused; SVG refused with a reason; an oversized upload refused with
413; no rejected upload leaving a row or a file behind; the audit trail recording
the original filename; `/cv` 404ing before publication and redirecting after;
and deletion refusing to remove the file behind a live CV. Removed after running;
database and store both confirmed empty.

**One deviation from this plan, and it is a reversal of the plan's own risk
mitigation.** The plan proposed client-direct upload with a signed token, to
avoid the serverless request-body limit. Rejected, because it conflicts with the
requirement listed two bullets above it: Vercel Blob validates the *declared*
content type, not the bytes, so magic-byte checking would become a delete-if-bad
cleanup *after* the file is stored — and `onUploadCompleted` needs a publicly
reachable URL, so that path would be untestable locally. Uploads are proxied and
capped at 4 MB instead. The cap is not a real constraint here: the largest file
in the repository is a 435 KB screenshot.

**Two other choices worth recording.** The request body is raw bytes rather than
multipart, which removes the need for a multipart parser dependency entirely. And
image dimensions are parsed by hand for PNG, GIF, JPEG and all three WebP
sub-formats rather than via `sharp` — a native module, in a project that lost an
afternoon in Phase 1 to a truncated native binary raising SIGBUS, and which
Next.js only provides transitively. Verified against all 23 real asset files in
the repository: every one identified, every image's dimensions read.

**One real bug, found by the end-to-end run and worth stating in full** because
the reasoning that produced it was superficially sound. Media deletion removed
the stored file *before* the row, on the grounds that a row pointing at a missing
file is worse than a file with no row — true, but it forgot where the safety check
lives. Deleting the file behind a live CV is prevented by `Resume.mediaId`'s
`ON DELETE RESTRICT`, which Postgres evaluates when the **row** is deleted. So the
sequence was: file deleted, row delete rejected with 409, transaction rolled back,
row surviving and now pointing at nothing — the exact failure the ordering was
chosen to prevent. Fixed with an `afterDelete` hook that runs only after the
commit. `tests/deleteOrdering.test.js` asserts the sequence and was confirmed to
fail when the bug is reintroduced.

The general rule this produced, now written into the code: **whichever step
happens second is the one whose failure must be survivable.** Upload stores then
records, because an orphaned file is recoverable. Delete removes the row then the
file, for the same reason in the other direction.

**One thing was not a code problem.** Vercel now creates Blob stores with
private access by default, which surfaced only when the first real upload
returned `Cannot use public access on a private store`. A private blob has no
publicly readable URL, so every public screenshot would need proxying through a
function, defeating CDN caching — and the access mode is fixed at creation, so
the store had to be recreated rather than reconfigured. `putObject` now
translates that error into an actionable 503 rather than a generic 500.

Resolved, and re-verified against the new public store — **41 checks, all
passing**, including the parts that were previously impossible: an uploaded file
returns 200 to a caller with no token, its bytes round-trip identically, it is
served with the sniffed content type and a one-year immutable cache, the URL is
not on the `.private.blob` host, and an anonymous request to `/cv` receives the
PDF itself. `npm run media:prune` was exercised for real in both report and
`--apply` modes against a planted orphan. Store and database left empty.

---

## Phase 6 — Dashboard shell and portfolio CRUD

**Objective.** The dashboard itself: layout, reusable table and form
components, and working screens for every portfolio entity.

- **Files:** `components/admin/` (AdminLayout, Sidebar, DataTable, EntityForm,
  SortableList, ArrayField, ConfirmDialog, Toast, StatusChip);
  `pages/admin/` (index, experiences, projects, skills, bio, links, settings,
  account); `lib/adminTheme.js` built from the site's existing hex values.
- **Frontend:** client-side fetching with optimistic updates and rollback;
  drag-to-reorder wired to the batch endpoint; search and filter where a list
  is long enough to need it; loading skeletons, empty states, error states
  with retry, and an unsaved-changes guard.
- **Auth:** every admin page wrapped in a server-side session check, in
  addition to the middleware redirect.
- **Testing:** create, edit, reorder and delete each entity end to end; a
  server-side rejection surfaces as a field error rather than a silent
  failure; keyboard navigation and focus states on every form; usable at
  tablet width.
- **Packages:** ideally none beyond MUI. A small drag library may be needed
  for reordering — MUI primitives get tried first.
- **Risks:** Tailwind's `important: true` can fight MUI's own styles in dense
  admin components. Admin styling goes through MUI's theme and `sx` to avoid
  the collision.
- **Result:** every piece of content editable through a UI, database
  populated, public site still reading static files — so nothing is at risk
  yet.

### Screens

| Screen | What it does |
|---|---|
| `/admin` | Counts per entity, drafts awaiting publish, recent edits from `AuditLog`, active CV, last revalidation |
| `/admin/experiences` | Two tabs (Full-time, Contractual) over one table. Reorder, publish toggle, NDA flag, array editor for bullets |
| `/admin/projects` | Searchable list, featured toggle (drives the homepage's first three), reorder, cover upload, stack tags |
| `/admin/skills` | Fast inline add/remove, reorder, optional grouping |
| `/admin/bio` | Greeting, name, headline, tagline, career objective, education rows, LeetCode username |
| `/admin/links` | URL, icon, and two visibility switches — sidebar rail and contact block |
| `/admin/resume` | Drop a PDF to publish a new version. History with restore. Shows the public `/cv` link |
| `/admin/blogs` | Status filter and search; full editor (Phase 8) |
| `/admin/settings` | SEO defaults, OG image, section headings and numbering, footer credit, manual rebuild |
| `/admin/account` | Change password, linked Google account, active sessions, recent sign-ins |

---

## Phase 7 — Seed the database and cut the public site over

**Objective.** Move the public site from static imports to database-driven
props, section by section, with no visible change.

- **Files:** `prisma/seed.js`; `pages/index.js` (add `getStaticProps`, remove
  the loading gate); all 12 existing components (props instead of imports);
  `lib/revalidate.js`, `pages/api/revalidate.js`.
- **Frontend:** **markup is not redesigned** — each component's data source
  changes, its JSX and classes do not. Rubik consolidated into one module
  instead of three. The dead LeetCode call replaced with a cached server-side
  proxy. Sensible fallbacks when a section is empty.
- **Testing:** side-by-side visual diff of every section, desktop and mobile;
  view-source confirms content is in the HTML rather than injected after
  hydration; edit in the dashboard → reload → change is live; the seed runs
  twice without duplicating rows.
- **Risks:** this is the phase that can visibly break the site. One section
  per commit, each verified before the next, static files retained until the
  whole page is confirmed.
- **Result:** the public portfolio renders from the database, looks identical,
  and updates on save — no code change, no redeploy.

### Migration strategy

1. **Import, don't transcribe.** `prisma/seed.js` imports the existing arrays
   and maps them onto the new models, so the migration is reviewable,
   re-runnable code rather than a data-entry session.
2. **Parse the timeline strings.** `'July 2025 - Present'` becomes
   `startDate: 2025-07-01, isCurrent: true`. Both the en-dash and hyphen forms
   appear in the source; the parser handles both and **fails loudly** on
   anything it cannot read rather than guessing.
3. **Fix identity.** Ignore the duplicate and gapped source ids entirely
   (`data/projects.js` has two entries with `id: 1`; `data/experience.js` uses
   `0,1,4,5,6`). Generate fresh ids, set `order` from array position to
   preserve the current on-screen order exactly, and drop the unused `tag`
   field.
4. **Preserve the commented-out projects.** The five NDA entries in
   `data/projects.js` are imported as `status: DRAFT` — nothing is lost, and
   any can be published later. **Confirm this is wanted.**
5. **Move the files.** Upload every image in `public/images/projects/` and the
   resume PDF to Blob, creating `Media` rows and rewriting references.
   `public/` keeps the logos and favicon only.
6. **Cut over one section at a time**, diffing rendered output against the
   current site before moving on.
7. **Retire the static files last,** in a single commit, once every section is
   verified. Git history keeps them recoverable.

### What is currently hardcoded

More content lives inline in JSX than in `data/` — this is the full surface.

| Content | Lives in | Becomes |
|---|---|---|
| 19 skills | `data/skills.js` | `Skill` |
| 5 full-time roles + bullets | `data/experience.js` | `Experience(FULL_TIME)` |
| 2 contract roles + bullets | `data/contractualExperiences.js` | `Experience(CONTRACT)` |
| 16 active + 5 commented projects | `data/projects.js` | `Project` |
| Greeting, name, tagline | `MainComponent.js:23–44` | `Profile` |
| Career objective paragraph | `AboutMe.js:46–50` | `Profile.bio` |
| BRAC University + O/A Levels | `AboutMe.js:53–65` | `Education` |
| LeetCode username, profile URL, popover copy | `AboutMe.js:14,116` | `Profile` + `SocialLink` |
| LinkedIn, GitHub, Facebook (duplicated) | `SocialMediaLinks.js`, `Contact.js` | `SocialLink` |
| Displayed email and mailto target | `SocialMediaLinks.js:24`, `Contact.js:37` | `Profile` |
| Resume PDF path | `MainComponent.js:53` | `Resume` (active) |
| Section headings + 00/01/10/11 numbering | Header, AboutMe, Experience, DemoProjects, Contact | `SectionCopy` |
| Footer credit and attribution | `Footer.js:13–17` | `Profile` |
| Page title and meta description | `index.js:27–30` | `SeoSettings` |
| "Show first 3 projects" rule | `DemoProjects.js:14` | `Project.isFeatured` |

---

## Phase 8 — Blog system

**Objective.** A complete blog — public listing, post pages, and a dashboard
editor with drafts — in the portfolio's existing visual language.

- **Files:** `pages/blog/index.js`, `pages/blog/[slug].js`,
  `components/Blog/` (BlogCard, BlogPostBody, TagPill, ShareRow),
  `pages/admin/blogs/` (list, new, `[id]`),
  `components/admin/MarkdownEditor.jsx`, and `header.js` to enable the
  already-commented-out Blog nav item at line 66.
- **Frontend:** cards reuse `ProjectCard`'s `#233352` surface, radius and
  hover so the blog looks native. Post page: cover, title, date, reading time,
  tags, sanitized markdown, prev/next. Loading, empty ("no posts yet") and 404
  states. Responsive at the same breakpoints as the rest of the site.
- **SEO:** per-post title, description, canonical, OG and Twitter cards;
  JSON-LD `BlogPosting`; database-driven sitemap. Drafts are `noindex` and 404
  for anonymous visitors.
- **Testing:** a draft is not reachable by URL or listed publicly; publishing
  goes live within one revalidation; slug collisions rejected with a clear
  message; `<script>` in post content is sanitized rather than executed
  (asserted in a test); Lighthouse SEO on a post page.
- **Packages:** `react-markdown`, `remark-gfm`, `rehype-sanitize`.
- **Risks:** stored markup is the main XSS vector in the system — the author is
  trusted but the output is public. `rehype-sanitize` with an explicit
  allowlist, and no `dangerouslySetInnerHTML` anywhere.
- **Result:** `/blog` and `/blog/[slug]` live, "Blogs" in the nav, full
  draft-to-publish workflow.

---

## Phase 9 — Security hardening and test suite

**Objective.** Attack the system deliberately, then close what that finds.
This phase assumes the implementation is wrong until tested.

- **Files:** `tests/` (validation, auth-guard, storage, migration mapping);
  `next.config.js` security headers; `middleware.js` rate limiting.
- **Security:** CSP, `X-Frame-Options`, `Referrer-Policy`, HSTS,
  `X-Content-Type-Options`; admin routes `noindex` and non-cacheable; a secret
  scan across the **full git history**, not just the working tree; dependency
  audit.
- **Testing:** every admin route hit unauthenticated, with an expired session,
  and with a tampered JWT; non-allowlisted Google identity blocked; oversized,
  wrong-type and script-bearing uploads rejected; payloads containing SQL and
  HTML injection attempts; draft-visibility bypass attempted by direct URL and
  by API.
- **Risks:** a CSP tight enough to be useful can break MUI's runtime-injected
  Emotion styles. It gets tuned against the real rendered app, not written
  from a template.
- **Result:** a test suite whose failures would be real security regressions,
  and a documented threat model.

---

## Phase 10 — Documentation and CLAUDE.md

**Objective.** Write down everything a future session or developer would
otherwise have to rediscover, including decisions not visible in the code.

- **Files:** `CLAUDE.md`; `docs/setup.md`, `architecture.md`,
  `content-management.md`, `deployment.md`, `security.md`; `docs/adr/` (one
  short record per architectural decision); `.env.example`; refreshed
  `AGENTS.md` — both it and `docs/README.md` still reference the `styles/`
  directory as though it were never deleted.
- **Contents:** prerequisites, env vars, install, dev, build, migrate, seed,
  deploy; auth flow, API conventions, data and component conventions; Google
  OAuth and storage setup step by step; a plain-language guide per content type
  (how to add an experience, upload a CV, publish a post); what must not be
  changed casually, and why.
- **Testing:** follow the setup doc from a clean clone against an empty
  database. If a step is missing, the doc is wrong — not the reader.
- **Risks:** docs written once and never updated. Mitigated by keeping
  `CLAUDE.md` current at the end of each phase rather than all at the end.

---

## Phase 11 — Deployment and verification

**Objective.** Ship it, then verify the whole flow against production rather
than assuming it carried over.

- **Steps:** production database provisioned and `migrate deploy` run; all env
  vars set in the host; production OAuth redirect URI registered; production
  admin created via the CLI against the live database; seed run once and
  verified row by row; custom domain, HTTPS, `robots.txt`, sitemap submitted.
- **Verification:** both sign-in methods work in production; an edit in
  production updates the public page without a redeploy; a CV and a cover
  image upload in production; a real post publishes and unpublishes;
  Lighthouse on `/` and a post page compared against the current site; admin
  routes confirmed unreachable while signed out.
- **Risks:** environment drift is where this kind of project usually fails — a
  missing variable, an unregistered redirect URI, an unpooled connection
  string. Mitigated by a written pre-flight checklist that gets executed, not
  skimmed.
- **Result:** a live portfolio managed entirely from a dashboard, and a
  repository that no longer needs editing to change its own content.

---

## Rendering strategy

Today the homepage ships a 2,476-byte empty shell. Static HTML generated from
the database and refreshed on demand makes the page **faster and more
indexable** while becoming dynamic.

| Route | Strategy | Notes |
|---|---|---|
| `/` | SSG + ISR | `revalidate: 3600` plus on-demand busting on save. Loading gate removed. |
| `/blog` | SSG + ISR | Published posts only, newest first, paginated. |
| `/blog/[slug]` | SSG + ISR | `getStaticPaths` over published slugs, `fallback: 'blocking'` so a new post is reachable immediately. Unknown slug → 404. |
| `/admin/*` | Client + SSR guard | `noindex, nofollow`. Never statically generated. |
| `/sitemap.xml`, `/robots.txt` | SSR | Generated from the database, so new posts appear without a deploy. |

**On-demand revalidation is the mechanism behind "save and the site
updates".** Saving an experience busts `/`; publishing a post busts `/blog`,
that post's page, and the sitemap. No redeploy.

---

## Risk register

| Risk | Severity | Handling |
|---|---|---|
| Cutting the public site over to the database visibly breaks it | High | One section per commit, visual diff each time, static files retained until verified |
| An admin API route ships without an auth check | High | One shared `withAdmin()`, plus a test asserting 401 across an enumerated route list |
| Stored blog markup executes script on the public site | Medium | `rehype-sanitize` with an explicit allowlist; no `dangerouslySetInnerHTML`; tested with a hostile payload |
| React 18 + MUI 5 pin blocks the App Router | Medium | Accepted deliberately — see Locked decisions |
| Serverless database connection exhaustion | Medium | Pooled connection string, singleton Prisma client |
| Object storage is a real vendor dependency | Medium | Confined behind `lib/storage.js` |
| A secret reaches git | Medium | `.env` added to `.gitignore` in Phase 1; `.env.example` holds names only; Phase 9 scans full history |
| Tailwind `important: true` collides with MUI in the dashboard | Low | Admin components style through MUI's theme and `sx` |
| Content becomes empty and sections render blank | Low | Every section has a defined empty state; the seed guarantees a baseline |

---

## Open questions

- **Admin email** for the `ADMIN_EMAILS` allowlist. Defaulting to
  `samkabir26@gmail.com` — what the site displays and the README uses.
- **Contact email.** Phase 1 pointed both `mailto:` links at
  `samkabir26@gmail.com`, since the displayed address and README agreed and
  `admin@gamblingco.in` was the outlier. Correct if wrong.
- **The five NDA projects** currently commented out — import as drafts, or
  leave out?
- **The LeetCode section.** The code uses `greeed` for the API and `Greeed`
  for the profile link, and the Heroku endpoint behind it is almost certainly
  dead. Keep the section with a server-side cached proxy, or drop it?
- **`next/image` migration.** The one visual-layer change proposed, and only
  because it fixes measurable layout shift. Say so and it gets skipped.
