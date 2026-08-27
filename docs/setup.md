# Setup — from a clean clone to a running site

This is the local-development path. Deployment to production is a separate,
shorter doc: [deployment.md](deployment.md). The acceptance test for *this* file
is literal — follow it from a fresh clone against an empty database, and if a step
is missing, the doc is wrong, not you.

## Prerequisites

- **Node 20.11 or newer.** The config uses `import.meta.dirname`, and the scripts
  rely on Node's ES-module syntax detection.
- **npm** (bundled with Node).
- Accounts for three services, all with a free tier: **Neon** (Postgres),
  **Google Cloud** (sign-in), **Vercel** (file storage, and later hosting).

You do not need Postgres installed locally — the database lives on Neon from the
start, so dev and production differ only by which database URL is in the env file.

## 1. Install

```bash
git clone <this repo>
cd samkabir
npm install
```

`npm install` runs `prisma generate` automatically (the `postinstall` hook), so
the Prisma client is built against the schema before anything else runs.

## 2. Environment variables

Copy the template and fill in real values. `.env.example` holds **names only** and
is committed; `.env` holds the real values and is gitignored. Both the Prisma CLI
and Next read `.env`; Next also reads `.env.local`. One file that both tools see is
simpler, so use `.env`.

```bash
cp .env.example .env
```

The variables, and where each comes from:

| Variable | What it is | Source |
|---|---|---|
| `DATABASE_URL` | **Pooled** Postgres URL — the running app uses this | Neon (step 3) |
| `DIRECT_URL` | **Direct** Postgres URL — migrations use this | Neon (step 3) |
| `GOOGLE_CLIENT_ID` | OAuth client id | Google Cloud (step 4) |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret | Google Cloud (step 4) |
| `ADMIN_EMAILS` | Comma-separated allowlist of addresses allowed to sign in | You choose |
| `NEXTAUTH_URL` | The app's own origin (`http://localhost:3000` locally) | You |
| `NEXTAUTH_SECRET` | Signs the session cookie | `openssl rand -base64 32` |
| `BLOB_READ_WRITE_TOKEN` | Read/write token for the file store | Vercel Blob (step 5) |

`ADMIN_EMAILS` is the primary access control: anyone not on this list is rejected
by **both** sign-in methods, and no account row is created for them. No spaces
between addresses — `me@example.com,you@example.com`.

**Never paste any of these values into a chat or commit them.** Only `.env.example`
(names, no values) belongs in Git.

## 3. Database (Neon)

1. Create a project at [neon.tech](https://neon.tech). Any region is fine; closer
   to you means a faster dev loop.
2. From the project's connection details, copy **two** connection strings:
   - the **pooled** one (its host contains `-pooler`) → `DATABASE_URL`
   - the **direct** one (no `-pooler`) → `DIRECT_URL`
   Both end with `?sslmode=require`. Both are passwords — treat them as such.
3. Apply the schema:

   ```bash
   npm run db:migrate
   ```

   This runs `prisma migrate dev`, which creates the tables from
   `prisma/schema.prisma`. On an empty database it applies the single existing
   migration (`_init`). If it reports the database is already up to date, you are
   done here.

Pooled vs direct: the pooled connection handles many short-lived serverless
connections and is what the app uses; the direct connection is a single stable one
that migration tooling needs. Neon gives you both.

## 4. Google sign-in

1. In the [Google Cloud Console](https://console.cloud.google.com/), create (or
   pick) a project and open **APIs & Services → Credentials**.
2. Configure the **OAuth consent screen** (External, and add your own address as a
   test user is enough for a single-admin site).
3. Create an **OAuth client ID** of type **Web application**. Under *Authorised
   redirect URIs* add exactly:

   ```
   http://localhost:3000/api/auth/callback/google
   ```

   (In production, add the live equivalent — see [deployment.md](deployment.md).)
4. Copy the client id and secret into `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

The address you sign in with must also be in `ADMIN_EMAILS`, or sign-in is
rejected after Google confirms you — by design, and it leaves no account row.

## 5. File storage (Vercel Blob)

1. In the Vercel dashboard, create a **Blob** store.
2. **Create it as a _public_ store.** Vercel's default is private, whose URLs are
   not publicly readable — a private store only ever produces broken images here.
   The access mode is fixed at creation, so a private store must be recreated, not
   reconfigured.
3. Copy its read/write token into `BLOB_READ_WRITE_TOKEN`.

Storage is swappable: everything goes through `lib/storage.js`, so moving to
Cloudinary is a change in that one file.

## 6. Create the admin account

There is no sign-up page. The account is created from the command line:

```bash
npm run admin:create
```

It prompts for an email (which must be in `ADMIN_EMAILS`) and a password. This is
also the only recovery path — `npm run admin:reset-password` — because there is no
reset-by-email flow.

## 7. (Optional) Seed starting content

An empty database renders an empty site. To populate it with the owner's real
content, imported from the arrays Phase 7 archived:

```bash
npm run db:seed                    # content
npm run db:seed -- --include-nda   # …plus three NDA projects, imported as drafts
npm run db:seed -- --reset         # replace Experience and Education (no natural key)
npm run assets:import              # push the project covers and CV into Blob
```

The seed is idempotent — it upserts on natural keys — so running it twice does not
duplicate anything. `assets:import` is a one-off; read the note at the top of
`scripts/import-assets.mjs` first.

## 8. Run it

```bash
npm run dev      # http://localhost:3000  (site) and /admin (dashboard)
npm test         # the full suite — no database required
npm run lint
```

Sign in at `/admin/login` with the account from step 6. Edits are live on the
next reload: each save rebuilds the affected public page on demand.

## Troubleshooting

- **Sign-in succeeds at Google then bounces back to the login form.** The address
  is authenticated but not in `ADMIN_EMAILS`, or no admin account exists for it
  yet (step 6). Both are deliberate — a valid Google identity is not authorisation.
- **The cookie never sticks / login appears to do nothing.** `NEXTAUTH_URL` must
  match the origin you are actually using. Over `http://localhost` the cookie is
  intentionally not `Secure`; if `NEXTAUTH_URL` is `https://…` while you browse
  `http://…`, the browser discards the cookie.
- **Images are broken squares.** Either the Blob store is private (step 5), or the
  storage host is not in `next.config.mjs`'s `images.remotePatterns`.
- **`prisma migrate` cannot connect.** Migrations use `DIRECT_URL` (the non-pooled
  one). A pooled URL in that slot is the usual cause.
