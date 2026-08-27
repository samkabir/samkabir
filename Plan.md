# Portfolio CMS — Implementation Plan

Turning this static portfolio into a database-backed site with a private admin
dashboard, so content is managed through a UI instead of by editing
`data/*.js` and redeploying.

**Status:** Phases 1–10 complete. Phase 11 (deployment) is in progress — its guide,
docs and automated verification are prepared and it is now blocked on the owner's
production accounts, the one thing it cannot be finished without.

The public site now renders from the database. The homepage went from 2,686
bytes of spinner to 85,004 bytes of real HTML, `data/` and the local assets are
gone, and a dashboard save is live on the next reload.

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

## Phase 6 — Dashboard shell and portfolio CRUD ✅ COMPLETE

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

### What was built, and where it differs from the plan

All ten screens exist. Four deviations, each for a reason:

1. **No drag library.** The plan allowed for one if MUI primitives fell short.
   They did, but the HTML5 drag events cover the pointer half in about thirty
   lines, and the keyboard path (↑/↓ per row) is the primary implementation
   rather than an afterthought. No package was added in this phase at all.

2. **Styling splits by ownership rather than moving wholesale to `sx`.** The
   plan's mitigation for Tailwind's `important: true` fighting MUI was to put
   admin styling through MUI's theme. What was done instead: hand-built controls
   stay Tailwind — matching the public site and the Phase 4 login form, whose
   class strings are now named once in `lib/adminTheme.js` instead of copied —
   and components that ship their own stylesheet (Dialog, Snackbar, Tooltip) are
   left entirely to a small MUI theme. The two are never mixed on one element,
   which is where the collision would happen.

3. **“Active sessions” on `/admin/account` is an explanation, not a list.**
   Sessions are signed JWTs in a cookie, not rows, so nothing server-side can
   enumerate or individually revoke them. The screen says so, and says what does
   work immediately: removing the address from `ADMIN_EMAILS` ends every session
   everywhere on the next request, because every request re-checks the allowlist.

4. **Three controls describe themselves instead of pretending.** The rebuild
   button (needs Phase 7's revalidation endpoint), the “last rebuild” timestamp
   (nothing tracks it yet) and the blog editor (Phase 8) are stated as not-yet
   rather than shipped as controls that appear to work and change nothing.

### Verified

123 checks against the running dev server and the live database: every screen
redirecting when signed out and rendering when signed in; no password hash in any
page's markup; `adminUser` in props being exactly the six-field allowlist; every
entity created, edited, reordered, published and deleted through the same request
bodies the forms build; every field-level rejection reaching the input it belongs
to; the CV flow end to end. Plus 143 unit assertions over the pure form, list,
client and formatting logic.

**Not verified: the browser.** Post-mount fetching, optimistic rollback, the drag
interaction, dialog focus behaviour and tablet-width layout are built for and
reviewed but not observed — there is no browser automation here, and the
components cannot be unit-tested either because they are JSX in `.js` files,
which Vite does not transform. Closing that gap needs either a manual pass
through the ten screens or a new dev dependency. See
[ADR 0006](docs/adr/0006-dashboard.md).

### Two bugs this phase produced, both fixed

- **The context providers were below the code that needed them.** `AdminLayout`
  rendered them around its children, but every screen renders `AdminLayout` from
  its own body — so a screen's own hooks ran above the provider it was mounting.
  Nine of ten screens returned 500. Lint, the build and 419 unit tests all
  passed; only rendering the pages against a real server caught it.
- **An empty slug field posted `''`**, which `slug()` rejects, so creating a
  project without inventing a URL failed with "Required." on a field left blank
  deliberately. Omission is the only value meaning "derive it".

---

## Phase 7 — Seed the database and cut the public site over ✅ COMPLETE

**Objective.** Move the public site from static imports to database-driven
props, section by section, with no visible change to a visitor.

**This is the phase that can visibly break the site.** Everything before it added
machinery beside the portfolio; this one rewires the portfolio itself. Work in
the order below, one commit per step, each verified before the next.

### Already done

The LeetCode proxy this phase listed is finished: `/api/leetcode` queries
LeetCode's GraphQL endpoint server-side and caches it at the edge. What remains
for this phase is reading the username from `Profile.leetcodeUsername` instead of
the constant in `lib/leetcode.js`, and hiding the block when
`Profile.showLeetcode` is false.

### Prerequisites

- An admin account exists (`npm run admin:create`) — the dashboard is how the
  seeded content gets checked.
- `BLOB_READ_WRITE_TOKEN` points at the **public** store (Phase 5, Todo/04).
- `npm run db:migrate:status` reports no pending migrations.

---

### Step 1 — `prisma/seed.js`

**Import, do not transcribe.** The script imports the existing arrays and maps
them onto the models, so the migration is reviewable, re-runnable code rather
than a data-entry session that cannot be diffed.

Wire it up as `prisma.seed` in `package.json` **and** as `npm run db:seed`
through `scripts/with-env.mjs`, like every other database script — the Prisma CLI
reads `.env`, and this project's credentials are in `.env.local`.

**Idempotent, by `upsert` on a natural key.** Running it twice must not double
the content. Use `slug` for Project, `name` for Skill, `key` for SectionCopy, the
literal `singleton` for Profile and SeoSettings. Experience and Education have no
natural unique column — give the script a `--reset` flag that deletes rows of
those two models before inserting, and make plain runs skip them if any row
exists. Never delete a `Media` row: files are pruned by `media:prune`, and a
seed that deletes media would take the live CV with it.

#### What goes in

| Source | Count | Model |
|---|---|---|
| `data/skills.js` | 19 strings | `Skill` — `order` from array index, `status: PUBLISHED` |
| `data/experience.js` | 5 roles | `Experience` `kind: FULL_TIME` |
| `data/contractualExperiences.js` | 2 roles | `Experience` `kind: CONTRACT` |
| `data/projects.js` | 16 active | `Project` `status: PUBLISHED` |
| `data/projects.js` | 3 commented-out | `Project` `status: DRAFT` — **confirm with Samiul first** |
| `AboutMe.js` prose + education bullets | 1 + 2 | `Profile.bio`, `Education` |
| `MainComponent.js` greeting / name / headline | — | `Profile` |
| `SocialMediaLinks.js` + `Contact.js` links | 3 (duplicated across both) | `SocialLink` — one row each |
| `Footer.js` credit + attribution | — | `Profile.footerCredit`, `attributionLabel`, `attributionUrl` |
| `index.js` title + description | — | `SeoSettings` |
| Section headings | 6 | `SectionCopy` |

#### The timeline parser — the one piece with real failure modes

Seven strings, all of the form `Month YYYY <dash> Month YYYY|Present`:

```
July 2025 - Present            ← ASCII hyphen, U+002D
May 2023 – June 2024           ← en dash, U+2013
October 2022 – April 2023
February 2022 – September 2022
November 2021 – January 2022
July 2024 – September 2024     ← contractual
May 2023 – June 2024           ← contractual
```

Rules:

- Split on `/\s*[-–—]\s*/`. **Both dash characters appear in the real data** and
  a parser that handles only one silently produces a single-part string.
- `Month YYYY` → the **first of that month at UTC noon**, matching what
  `calendarDate()` does. The `@db.Date` columns hold days, and noon is what makes
  a client in any timezone read back the same calendar day.
- `Present` (case-insensitive) → `isCurrent: true`, `endDate: null`.
- Anything else → **throw, naming the string and the record**. A parser that
  guesses puts a wrong date on a CV, and nothing downstream would question it.
- Set `timelineOverride: null`. The formatter reproduces these strings from the
  dates; verify that before deciding otherwise (see the checklist).

#### Identity, deliberately discarded

`data/experience.js` uses ids `0, 1, 4, 5, 6` and `data/contractualExperiences.js`
uses `0, 3` — gapped. `data/projects.js` has **two entries sharing `id: 1`**.
Ignore all of them: generate fresh cuids, set `order` from array position so the
current on-screen order is preserved exactly, and drop the unused `tag` field
(`'One'`, `'Two'`, `'Five'` — a label for a tab index that no longer exists).

#### Section copy — the six rows, with their current values

The component renders `{numberLabel} {navLabel}` for the small accent line and
`{heading}` for the large one, which is why Contact has both.

| `key` | `numberLabel` | `heading` | `navLabel` | `anchor` | `showInNav` |
|---|---|---|---|---|---|
| `about` | `00.` | About Me | About | `about` | yes |
| `skills` | `00.0` | Skill Stack | — | — | no |
| `experience` | `01.` | Job Experiences | Experience | `exp` | yes |
| `contractual` | `01.0` | Contractual Experiences | — | — | no |
| `projects` | `10.` | Some Projects I worked on... | Work | `project` | yes |
| `contact` | `11.` | Get In Touch | Contact | `contact` | yes |

`contact.subheading` is `Feel free to contact me anytime.`

`SECTION_KEYS` in `lib/validation/sectionCopy.js` already contains exactly these
six. The nav order is about → experience → projects → contact; give `order`
values that reproduce it.

---

### All seven steps are done. What actually happened

| Step | Commit | Outcome |
|---|---|---|
| 1 — Seed script | `182436b` | `prisma/seed.js`, idempotent, timeline parser handles both dashes |
| 2 — Assets into Blob | `0a2a947` | `scripts/import-assets.mjs`; 17 files stored, alt text written per image |
| 3 — Read layer | `93fae1d` | `lib/content.js`; one `PUBLISHED` filter, no `Date` crosses the boundary |
| 4 — `getStaticProps` | `bf4e27a` | Loading gate deleted; 2,686 → 75,811 bytes of server HTML |
| 5 — Components take props | `f24671b` | Visible text identical bar one disclosed character; lint clean |
| 6 — On-demand revalidation | `639815e` | Every save rebuilds `/`; verified edit → reload → live |
| 7 — Retire the static files | `7885ced` | 24 files / 7.3 MB deleted; upload fixtures replaced |

**Verified at the end of the phase:** `npm run db:seed` twice leaves identical
row counts; all seven timeline strings reproduce exactly and none collapses to
1969/1970; all 16 covers return 200 from Blob; `/cv` serves the right PDF
byte-for-byte; the deleted paths 404 while the site is unaffected; all ten
dashboard screens still redirect signed out and render signed in; `/admin`
reports "Live". 454 tests in 19 files, 0 lint errors, 0 warnings.

#### Eight deviations from the plan above, each deliberate

1. **The seed transcribes rather than imports.** Step 1 said "import, do not
   transcribe" — but Step 7 deletes the files it would import from, which would
   leave the seed permanently broken. Its own copy is what makes it re-runnable.
2. **Education and Experience are skipped, not reset, by default.** Neither has
   a natural unique key. Plain runs leave them alone; `--reset` replaces them.
3. **The three NDA projects are behind `--include-nda`** rather than decided.
   They import as DRAFT, so nothing becomes visible either way. Default is out,
   which preserves current behaviour exactly. **Still open for Samiul.**
4. **`attributionLabel` holds the link text**, not the prefix. The footer's
   second line needs three things and `Profile` supplies two; "Web Design Idea"
   is static prose in `Footer.js`. The reasoning is in that file.
5. **`Education.note` carries the pre-degree qualifier** ("UnderGraduation"),
   which is what lets the first education sentence be reproduced word for word.
6. **The revalidate endpoint lives under `pages/api/admin/`**, not at
   `pages/api/revalidate.js`. That puts it behind `createHandler`'s
   inescapable `withAdmin` and inside the route-globbing test — the suite gained
   its 401 assertion by itself.
7. **`revalidate` stays at 60, not 3600.** On-demand busting is the primary
   mechanism and the timer is only the backstop for one that fails; an hour is a
   long time to serve a page the owner just corrected, and ISR only regenerates
   on request, so the cost of 60 is negligible.
8. **`tests/fixtures/` replaced the real-asset fixtures.** Deleting the
   screenshots broke nine byte-detection tests, including the security-relevant
   "PDF renamed as PNG". The fixtures are real encoder output at 5 KB, and cover
   both WebP sub-formats where the originals covered only lossy.

#### One disclosed visual change, and it is one character

`data/experience.js` wrote six of its seven date ranges with an en dash (U+2013)
and one — `July 2025 - Present` — with an ASCII hyphen. The shared
`formatTimeline` emits an en dash for all seven, so that row's separator
changed. The alternative was setting `timelineOverride` on it purely to preserve
a typo, which would have made the override column meaningless. The dashboard
already rendered it with an en dash, so this also removes a disagreement between
the two.

#### Step 1 detail

Seed script created: `prisma/seed.js`. Run `npm run db:seed` to populate database with:
- 1 Profile (singleton with greeting, fullName, headline, bio, emails, leetcodeUsername, footer credit, attribution)
- 1 SeoSettings (singleton with siteTitle, defaultDescription, canonicalUrl, twitterHandle)
- 19 Skills (from data/skills.js, ordered by array index, all PUBLISHED)
- 2 Education entries (from AboutMe.js: BRAC CSE, O and A Levels)
- 5 Full-time Experience rows (from data/experience.js timeline parser: July 2025 - Present, May 2023 – June 2024, etc.)
- 2 Contractual Experience rows (from data/contractualExperiences.js, July 2024 – September 2024, May 2023 – June 2024)
- 16 Published Project rows (from data/projects.js, ordered by array position with generated cuids)
- 3 Social Link rows (LinkedIn, GitHub, Facebook from SocialMediaLinks.js + Contact.js)
- 6 Section Copy rows (about, skills, experience, contractual, projects, contact with nav labels, anchors, order)

**Timeline parser note:** The script handles both U+002D (ASCII hyphen) and U+2013 (en dash) in timeline strings like "July 2025 - Present" and "May 2023 – June 2024". If a timeline doesn't match the expected format, the script throws with the original string, recording line and field.

**Upsert logic:** Profiles and SectionCopy upsert on `id: 'singleton'` and `key` respectively. Skills upsert on `name`. Projects upsert on `slug`. For Education and Experience (no natural unique keys), the script skips if rows exist; use `npm run db:seed -- --reset` to delete and recreate them.

**Committed:** `182436b feat(phase-7): seed script for idempotent database import`

---

### Step 2 — Move the assets into Blob

A second script, `scripts/import-assets.mjs`, run once:

- **19 project images** in `public/images/projects/` — 15 `.PNG`, 4 `.webp`,
  7.2 MB total, largest 2.22 MB. All are **under the 4 MB upload cap**, so
  nothing needs resizing.
- **The CV**: `public/assets/Samiul_Kabir_Resume.pdf`, 82 KB, 2 pages. Creates a
  `Media` row, then a `Resume` row, then activates it so `/cv` works.

Go through `putObject` and `describeUpload` in `lib/storage.js` / `lib/uploads.js`
rather than the SDK, so the same byte-level validation, the same generated keys
and the same dimension parsing apply. The uppercase `.PNG` extensions do not
matter: the storage key's extension comes from the file's bytes, so they all land
as `.png` with no case-collision risk.

Set `Media.alt` per image while doing this — the project name is a poor
description ("Shades Sunglases" tells a screen reader nothing about a screenshot)
and this is the only moment all 19 are in front of you.

Record the mapping from `public/images/projects/...` to the new `Media.id` and
use it to set each `Project.coverMediaId` in the same run.

`public/` afterwards keeps only `images/Logo.png`, `images/Logo1.png` and the
favicon. **Delete the originals in Step 7, not here** — git history keeps them,
but the site is still reading them until the cutover is done.

---

### Step 3 — `lib/content.js`, the read layer

One module, one exported function per section, each returning exactly the shape
the component needs:

```js
getProfile()        getSectionCopy()     getSkills()
getExperiences()    getProjects()        getSocialLinks()
getEducation()      getSeoSettings()     getActiveResume()
```

Non-negotiable properties:

1. **Every query filters `status: 'PUBLISHED'`.** This is the single predicate the
   whole schema was shaped around. A section that forgets it publishes a draft,
   and nobody notices until it is indexed. One module means one place to check.
2. **Ordered explicitly** — `[{ order: 'asc' }, …]` with the same tiebreaker the
   admin resource uses, or the dashboard's order and the site's order disagree.
3. **Returns plain JSON.** `getStaticProps` cannot serialise a `Date`, and the
   error names the field but not the cause. Convert at the boundary here, once,
   rather than in each page.
4. **Never imported by a client component.** It touches Prisma. Importing it into
   a component pulls the client into the browser bundle and fails the build.

A single `getPageContent()` that calls them inside one `prisma.$transaction([…])`
is worth having: it is one round trip instead of nine, which matters on Neon's
free tier where an idle database pays a wake-up cost on the first query.

---

### Step 4 — `pages/index.js`: `getStaticProps` and the loading gate

Two changes, and the second is the reason this phase matters for anything other
than editing convenience.

**Add `getStaticProps` with `revalidate`.** Static generation with ISR: the page
is HTML at the edge, and a save in the dashboard reaches it within the window
without a redeploy. Start at `revalidate: 60`; Step 6 makes it immediate.

**Remove the artificial loading gate.** `pages/index.js` currently renders
`<Loading />` on the first paint and swaps in the real page from a `useEffect`,
which means **the server-rendered HTML contains a spinner and nothing else** —
7.2 MB of portfolio that no search engine can see. There is a `TODO(phase-7)`
on it. Deleting it is the point of the phase as much as the CMS is; the
`Loading` component itself can stay for use elsewhere.

Guard the empty case: if `getPageContent()` returns no profile — a database that
has not been seeded — render the section from its fallback rather than crashing
the build. Keep the fallbacks until Step 7 and delete them with the static files.

---

### Step 5 — Components take props

**The markup does not change.** Each component's data source changes; its JSX,
its classes, its AOS attributes and its breakpoints do not. If a diff in this
step touches a `className`, it is out of scope.

| Component | Currently reads | Receives |
|---|---|---|
| `Header` | 4 hardcoded `<li>` | `sections` (those with `showInNav`) |
| `MainComponent` | inline greeting, name, headline; `/assets/…pdf` | `profile`; the CV link becomes `/cv` |
| `AboutMe` | `data/skills`, inline prose, inline education | `profile`, `skills`, `education`, `sectionCopy` |
| `Experience` | `data/experience` | `experiences` (FULL_TIME) |
| `ContractualExperiences` | `data/contractualExperiences` | `experiences` (CONTRACT) |
| `DemoProjects` | `data/projects`, `.slice(0, 3)` | `projects`; the first three come from `isFeatured` |
| `ProjectCard` | `e.image`, `e.name`, `e.github`, `e.liveWebsite` | a `Project` row — field names change |
| `SocialMediaLinks` | 3 inline `<a>` + `mailto:` | `links` (`showInSidebar`), `profile.publicEmail` |
| `Contact` | 3 inline `<a>` + `mailto:` | `links` (`showInContact`), `profile`, `sectionCopy` |
| `Footer` | inline credit + attribution | `profile` |
| `SkillCard` | — | unchanged |

Two clean-ups that belong here because the files are open anyway:

- **Rubik is declared in three components** (`Footer`, `Contact`, `ProjectCard`),
  each exporting its own `rubikFont`. One module, imported. `AdminLayout` already
  does this for the dashboard.
- **`<img>` → `next/image`** for the project covers, which is the one visual-layer
  change this project's rules permit, because it fixes measurable layout shift.
  It needs `images.remotePatterns` in `next.config.js` for the Blob host —
  `*.public.blob.vercel-storage.com`. `Media.width` and `Media.height` are already
  stored, so pass them and get no shift at all. This clears the three standing
  lint warnings.

`SocialLink.iconKey` maps to a component: keep a `const ICONS = { linkedin: LinkedInIcon, … }` lookup in the component. The enum in
`lib/validation/socialLink.js` is the allowlist; a key with no entry renders the
generic `link` icon rather than nothing.

---

### Step 6 — On-demand revalidation

`lib/revalidate.js` and `pages/api/revalidate.js`, then wire the Settings
screen's rebuild control — which currently says why it does not exist yet.

- The endpoint calls `res.revalidate('/')`. Authorise it with `withAdmin` if it
  is only ever called from the dashboard; if it is ever called from outside, a
  shared secret in a header, compared with `crypto.timingSafeEqual`.
- Call it from `lib/api/resource.js` after a successful mutation, or from the
  dashboard after a save. Fire-and-forget with the failure logged: a
  revalidation that fails must not turn a successful save into an error.
- Remove the "not tracked yet" note on `/admin` and store a `lastRevalidatedAt`
  somewhere it can be read back.

---

### Step 7 — Retire the static files

One commit, once every section is verified:

- Delete `data/skills.js`, `data/experience.js`, `data/projects.js`,
  `data/contractualExperiences.js`.
- Delete `public/images/projects/**` and `public/assets/Samiul_Kabir_Resume.pdf`.
- Delete the fallbacks added in Step 4.
- Update `docs/README.md` — its "Content Sources" and "Assets" sections describe
  files that no longer exist.

Git history keeps all of it recoverable. Doing this earlier removes the thing
each section is being diffed against.

---

### Verification

Per section, before moving to the next:

- **Side-by-side diff against the current site**, desktop and mobile. `git
  stash` the cutover, screenshot, unstash, screenshot, compare. Identical is the
  bar — not "close enough".
- **View source, not devtools.** The content must be in the HTML that arrives, or
  the loading gate has effectively been reintroduced. `curl -s localhost:3000 |
  grep 'Samiul Kabir'` is the whole test.
- **Edit in the dashboard → reload → the change is live.** This is the sentence
  the entire project exists for.

Once, at the end:

- `npm run db:seed` twice in a row leaves the same row counts.
- Every timeline string renders exactly as it does today — this is where the
  parser gets caught. `July 2025 – Present` must not come back as
  `July 2025 - Present` with a different dash, or as `July 2025 – December 1969`.
- The CV button downloads the right PDF through `/cv`.
- Every project image loads from Blob and none 404s.
- All three lint warnings are gone.
- Lighthouse before and after: SEO and LCP should both improve, because the page
  is now HTML rather than a spinner.

### Known traps

1. **Neon suspends when idle.** `getStaticProps` runs at build time, so a cold
   build pays the wake-up. Give the build a generous timeout and do not read a
   first-query delay as a failure.
2. **`DATABASE_URL` must exist in the Vercel build environment**, not only at
   runtime, or the build fails where the dev server worked. That belongs to
   Phase 11, but it is discovered here.
3. **`getStaticProps` cannot serialise `Date`, `undefined` or a Prisma `Decimal`.**
   Convert in `lib/content.js`, once.
4. **Two entries in `data/projects.js` share `id: 1`.** Any mapping keyed on the
   source id silently loses one. Key on array position.
5. **The `–` in the timeline strings is U+2013**, not a hyphen. It will not match
   `split('-')`, and the failure is a wrong date rather than an error.
6. **`status: 'PUBLISHED'` is easy to omit** on the ninth query. One module, and
   grep it before shipping.
7. **The three commented-out NDA projects are a decision, not a detail.** Ask
   before importing them as drafts.

---

## Phase 8 — Blog system ✅ COMPLETE

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

### What was built

The public side shipped first (`78382a3`): `/blog` (a statically generated
archive with client-side tag filtering off a query string, revalidated on
publish), `/blog/[slug]` (`getStaticPaths` + `fallback: 'blocking'`, per-post
SEO, OG/Twitter cards, JSON-LD `BlogPosting`, prev/next), the `components/Blog/`
set, a database-driven sitemap and `robots.txt`, and the Markdown pipeline
(`react-markdown` + `remark-gfm` + `rehype-sanitize` with an explicit allowlist;
no `dangerouslySetInnerHTML` for post markup).

The admin editor completes it. `components/admin/PostEditor.js` is one component
for both create and edit, with `components/admin/MarkdownEditor.js` rendering its
preview **through the same `BlogPostBody` and sanitiser the public page uses** —
so what the author previews is what publishes, sanitisation included. It is
mounted at `pages/admin/blogs/new.js` and `pages/admin/blogs/[id].js`, and the
list at `pages/admin/blogs/index.js` links into both.

### Four deviations from the plan above, each deliberate

1. **No `header.js` edit.** The plan said to enable a commented-out Blog nav item
   at line 66. Phase 7 had already replaced the hardcoded nav with one derived
   from `SectionCopy` rows, and `navFromSections` adds "Blogs" **only when a post
   is published** — a better rule than a permanently-present link to a possibly
   empty archive. The commented-out item no longer exists to enable.
2. **The editor is `.js`, not `.jsx`.** The plan named `MarkdownEditor.jsx`, but
   every component in this project is JSX-in-`.js` (Next's convention here), and
   the test suite's page-discovery reads `.js`. One file extension out of step
   would have been the odd one out for no gain.
3. **The list screen manages tags too, and hosts no inline editor.** Writing a
   post happens on its own route rather than in a row; tags are created on the
   list screen because the editor needs them to exist, and a free-text tag field
   would breed near-duplicates. Reachability is by the row's "edit" link and the
   title, so `new` and `[id]` need no nav item of their own —
   `tests/adminPages.test.js` was taught this exemption.
4. **`PostEditor` bugs from the WIP commits were fixed, not shipped.** The
   editor committed under "WIP - Stage 8" called `formValues`/`toPayload` with
   their arguments reversed, treated `validateWith`'s `{ ok, fields }` result as a
   truthy error object (so every save aborted), and read cover/share images from a
   key `formValues` never looks at. It also diffed a PATCH against a baseline that
   never advanced past first load, which would re-send every saved field and leave
   the form reading "unsaved" forever. All four are corrected against the real
   `lib/adminForm` contract that `EntityForm` already uses.

---

## Phase 9 — Security hardening and test suite ✅ COMPLETE

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

### What was built

- **Security headers.** `lib/securityHeaders.js` (pure, dev/prod-aware builders)
  applied through a new `async headers()` in `next.config.mjs`: CSP,
  `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`,
  `Permissions-Policy` on every response; HSTS and `upgrade-insecure-requests`
  production-only; `X-Robots-Tag: noindex` + `no-store` layered on `/admin/*` and
  `/api/admin/*`. `tests/securityHeaders.test.js` pins the contract, including the
  dev/prod differences, and asserts the config actually applies it.
- **A real bug, found and fixed.** `getPostNeighbours` spread `livePosts()` and
  then overwrote its `publishedAt` constraint, dropping the `lte: now` cap — a
  post scheduled for the future leaked as a "next" neighbour link, slug and title,
  before its publication date. Constraints are now merged.
  `tests/draftVisibility.test.js` proves drafts and scheduled posts are unreachable
  by slug, listing, sitemap and neighbour link, using a faithful in-memory Prisma
  stand-in rather than a real database.
- **Secret scan** across the full git history: no real secret ever committed —
  only `.env.example` (names, no values) and fake illustrative strings.
- **Dependency audit.** `npm audit fix` resolved three Next.js advisories plus
  `postcss` and `sharp`. Three remain in the Prisma **CLI** chain
  (`deepmerge-ts`), a build-time devDependency whose only "fix" downgrades Prisma
  below the schema's version — accepted and documented rather than regressed.
- **Threat model** written to `docs/security.md`: assets, the three auth gates,
  the header rationale (including why CSP keeps `'unsafe-inline'` and what that
  does and does not protect), content visibility, uploads, XSS/injection/CSRF, the
  secret-scan and audit results, and the residual risks.

### Three deviations from the plan above, each deliberate

1. **No `middleware.js` rate limiting was added.** The plan listed it, but login —
   the one thing worth throttling — is already rate-limited in `lib/rateLimit.js`,
   backed by the audit log so the limit survives serverless cold starts and is
   shared across instances. A per-IP edge limiter in front of the whole site would
   be a second, weaker limiter (in-memory, per-instance) for endpoints that are
   already static or already guarded, so it was not added.
2. **The threat model lives in `docs/security.md`, which Phase 10 also names.**
   Rather than a throwaway note now and the real doc later, the real doc is written
   now and Phase 10 links it. This follows the plan's own mitigation — keep the
   docs current at the end of each phase rather than all at the end.
3. **Most of the planned attack tests already existed.** Phases 3–8 built the
   auth-gate, upload magic-byte, injection-shaped-input and JSON-LD-escaping tests
   as they built each feature. Phase 9 audited that coverage, added the two genuine
   gaps (response headers and draft/scheduled visibility), and `docs/security.md`
   maps every claimed property to the test that guards it — rather than duplicating
   assertions that were already there.

---

## Phase 10 — Documentation and CLAUDE.md ✅ COMPLETE

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

### What was built

- **`CLAUDE.md`** (new, root) — orientation for a future session: stack, where
  things live, commands, and the nine invariants that must not be changed casually,
  each pointing at the file that enforces it.
- **`docs/setup.md`** — clean-clone-to-running: prerequisites, the env-var table,
  and the Neon / Google OAuth / Vercel Blob steps step by step (these had lived in
  `Todo/01–03`, which were deleted once done). Ends with a troubleshooting section
  for the failures that actually happen (cookie/`NEXTAUTH_URL` mismatch, private
  Blob store, pooled URL in the migration slot).
- **`docs/architecture.md`** — the two halves, rendering/freshness, the three auth
  gates, the API layer, validation, the dashboard toolkit, the data model and
  storage, each deep-linking the relevant ADR.
- **`docs/content-management.md`** — plain-language "how do I edit X" per content
  type, written for the owner (a beginner): bio, experience, projects, skills,
  links, CV, blog + tags, settings, account, and the draft/publish and
  unpublish-vs-delete distinctions.
- **`docs/deployment.md`** — the Vercel procedure and a post-deploy verification
  checklist, honestly marked where a step is Phase 11 (not yet executed live).
- **Three new ADRs** — 0007 (public-site rendering), 0008 (blog + Markdown
  sanitisation), 0009 (security headers + the CSP tradeoff) — with the index table
  updated.
- **Refreshed `AGENTS.md`** and touched-up `docs/README.md`.

### Four deviations from the plan above, each deliberate

1. **`docs/security.md` was written in Phase 9, not here.** The plan listed it
   under Phase 10, but the threat model was the natural output of the
   security-hardening pass; writing it then and linking it now beats a placeholder.
2. **The plan's premise about `styles/` was wrong, and was not acted on.** It said
   `AGENTS.md` and `docs/README.md` "reference the `styles/` directory as though it
   were never deleted" — but `styles/` **exists** (`globals.css`, imported by
   `_app.js`), so those references are correct. What was actually stale in
   `AGENTS.md` was the pre-CMS world it still described: the deleted `data/`
   directory, `public/assets/` holding the CV (now in Blob), and the dead
   client-side LeetCode host. Those were fixed instead; the false `styles/` change
   was not made. `docs/README.md` was already largely current — its real staleness
   was `next.config.js` (now `.mjs`) and a "the editor is Phase 8" note.
3. **`.env.example` needed no change.** The plan listed it as a file to write; it
   already documents every variable the code reads (verified by grepping
   `process.env.*`), so editing it would have been churn.
4. **Historical ADRs 0004 and 0006 were left intact.** 0004's reasoning about the
   type-less package still holds (`tailwind.config.js` and `postcss.config.js` are
   still CommonJS), and 0006 correctly predicted the Phase 8 editor — which ADR
   0008 now discharges. Rewriting a phase-stamped record to hide that it was
   written before a later phase would be the revisionism ADRs exist to avoid.

---

## Phase 11 — Deployment and verification ⏳ IN PROGRESS — blocked on the owner

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

### Prepared — pending the owner's production accounts

Everything that does not need the owner's credentials is done; the deploy itself
cannot be, because it needs their Neon / Google / Vercel production accounts.

- **`Todo/05-deploy-to-production.md`** — the owner-facing, plain-language
  walkthrough (create the prod database, Vercel project, env vars, OAuth redirect),
  and `Todo/README.md` now lists it as the one outstanding task.
- **`docs/deployment.md`** (written in Phase 10) — the technical reference and the
  full verification checklist.
- **`scripts/verify-deploy.mjs`** (`npm run verify:deploy <url>`) — automates the
  mechanical half of the checklist: home is real HTML not a shell, the security
  headers are present, the dashboard is `noindex`, `/api/admin/*` returns 401 while
  signed out, an unknown/draft post is a plain 404, and the sitemap, `robots.txt`
  and `/cv` resolve. This is the "pre-flight checklist that gets executed, not
  skimmed" the risk note calls for. Exercised end-to-end already; it runs against
  the live origin once one exists.

**What remains (owner):** work through `Todo/05`. As each piece comes up, the
migration, seed, `assets:import` and `admin:create` are run against production, and
then `verify:deploy` plus the manual sign-in / save / upload checks close it out.

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
