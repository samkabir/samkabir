# Deployment

The procedure for putting this on Vercel, and the checklist for proving it
actually works there rather than assuming the local behaviour carried over.

> **Status.** This documents the intended deployment; the first production deploy
> and its verification are Phase 11. Steps here that have not yet been executed
> against a live environment are marked _(Phase 11)_.

## The shape of it

Vercel builds the Next app and runs it serverless; Neon holds the database; Vercel
Blob holds the files. Nothing about the app is Vercel-specific except the Blob
client and the Prisma engine target (`rhel-openssl-3.0.x`, already declared in
`prisma/schema.prisma`) — so the pieces could move, but this is the path built for.

## 1. Production database

Use a **separate** Neon database (or at least a separate branch) from local
development — a shared one means a local `migrate reset` can wipe production.

- `DATABASE_URL` → the production **pooled** URL.
- `DIRECT_URL` → the production **direct** URL (migrations use this).

Apply migrations against it with the deploy command, which only applies existing
migrations and never generates or resets:

```bash
npm run db:migrate:deploy      # prisma migrate deploy
npm run db:migrate:status      # confirm nothing is pending
```

## 2. Environment variables on Vercel

Set every variable from [setup.md](setup.md) in the Vercel project's
**Settings → Environment Variables**, for the Production environment:

| Variable | Production value |
|---|---|
| `DATABASE_URL` / `DIRECT_URL` | The production Neon URLs |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Same OAuth client, prod redirect added (step 4) |
| `ADMIN_EMAILS` | The allowlist |
| `NEXTAUTH_URL` | The live origin, e.g. `https://samkabir.vercel.app` — **https** |
| `NEXTAUTH_SECRET` | A **fresh** secret, not the local one (`openssl rand -base64 32`) |
| `BLOB_READ_WRITE_TOKEN` | The public Blob store's token |

Two that bite if wrong:

- **`NEXTAUTH_URL` must be the real https origin.** It decides the cookie's
  `Secure` flag and the OAuth callback URL. A mismatch is a silent "sign-in does
  nothing" — see the note in `lib/authOptions.js`.
- **`NEXTAUTH_SECRET` should differ from local.** Reusing the dev secret means a
  session minted locally is valid in production.

## 3. Build settings

Defaults are correct: build `npm run build`, output handled by Vercel's Next
preset. `prisma generate` runs via `postinstall`, so the client is built for the
serverless engine target on every deploy. No custom build command is needed.

## 4. Google OAuth for the live origin

Add the production callback to the **same** OAuth client used locally:

```
https://<your-domain>/api/auth/callback/google
```

Leave the localhost one in place so both environments work. If the consent screen
is still in "testing", either publish it or ensure every admin address is a listed
test user.

## 5. First-deploy content _(Phase 11)_

A fresh production database renders an empty site. Seed it once, from a machine
whose `.env` points at **production**:

```bash
npm run db:seed
npm run db:seed -- --include-nda    # only if the NDA projects should exist (as drafts)
npm run assets:import               # push covers + CV into the production Blob store
npm run admin:create                # the production admin account
```

`assets:import` reads the images from the repo, so run it before those files are
ever removed. It is idempotent on the media key, like the seed.

## Post-deploy verification checklist _(Phase 11)_

Do not assume local behaviour carried over — check it against the live origin:

- [ ] The home page returns real HTML (view source: it is not a loading shell).
- [ ] `/blog` lists published posts; a draft's URL 404s for a signed-out visitor.
- [ ] `/cv` redirects to the active CV file.
- [ ] `/sitemap.xml` and `/robots.txt` respond, and the sitemap lists the live posts.
- [ ] Sign in at `/admin/login` with an allowlisted address; a non-allowlisted one
      is rejected.
- [ ] Edit a section, save, reload the public page within a minute — the change is live.
- [ ] Upload a new CV; `/cv` now serves it; the old link still resolves.
- [ ] `curl -sI https://<domain>/` shows the security headers (CSP, HSTS,
      `X-Frame-Options`); `curl -sI https://<domain>/admin` adds `X-Robots-Tag: noindex`.
- [ ] `curl -s https://<domain>/api/admin/projects` returns 401, not data.

## Rollback

Vercel keeps every deployment; promoting a previous one is instant and is the
fastest fix for a bad release. A **migration**, though, is not rolled back by
redeploying — the database has already changed. Migrations here are additive by
habit for exactly this reason; a destructive one would need its own reverse
migration written before it ships.
