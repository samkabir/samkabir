# 05 — Put the site live (production deployment)

This is the last "only you can do it" task. It is clicking through three
dashboards you already have accounts on, and telling me when each piece is ready
so I can run the commands and check the result.

Take it slowly and in order. The single most common way a deploy like this fails
is a small mismatch — one variable missing, one URL typed wrong — so there is a
checklist at the end that I will actually run, not skim.

The technical reference for all of this is `docs/deployment.md`. This file is the
plain-language walkthrough; that one is the detail.

---

## Before you start

You need the three accounts from the earlier tasks, all still working:

- **Neon** (the database)
- **Google Cloud** (the "Sign in with Google")
- **Vercel** (where the site will live)

And decide one thing: **what web address the site will use.** To begin, the free
`something.vercel.app` address Vercel gives you is completely fine — a custom
domain like `samiulkabir.com` can be added later without redoing any of this.

> **A rule that has not changed: never paste a secret into our chat.** Every value
> below goes into a box in a dashboard, or into `.env.local` on your machine. I
> read that file when I run commands; I never need to see the value.

---

## Step 1 — A separate production database

Do **not** reuse your development database for the live site. A mistake while
developing could wipe it, and you do not want that to be your live site.

1. In Neon, create a **new project** (or a new branch) for production.
2. Copy its **two** connection strings, exactly as before:
   - the **pooled** one (host contains `-pooler`)
   - the **direct** one (no `-pooler`)
3. Keep them somewhere safe for Step 3. They are passwords.

Tell me when this exists — I will run the migration that builds the tables, and a
smoke test that confirms the database behaves.

---

## Step 2 — Create the Vercel project

1. In Vercel, **Add New → Project**, and import this Git repository.
2. Vercel will detect Next.js. **Do not deploy yet** — the environment variables
   in Step 3 have to be in place first, or the first build goes live broken.
3. If it forces a first deploy, that is fine; it will fail or render empty, and we
   redeploy after Step 3.

---

## Step 3 — Set the environment variables in Vercel

In the Vercel project: **Settings → Environment Variables**, and add each of these
for the **Production** environment. These are the same names as your local
`.env`, with production values:

| Name | What to put |
|---|---|
| `DATABASE_URL` | The production **pooled** Neon string (Step 1) |
| `DIRECT_URL` | The production **direct** Neon string (Step 1) |
| `GOOGLE_CLIENT_ID` | Same as local |
| `GOOGLE_CLIENT_SECRET` | Same as local |
| `ADMIN_EMAILS` | The address(es) allowed to sign in, comma-separated, no spaces |
| `NEXTAUTH_URL` | Your live address, **with https** — e.g. `https://your-app.vercel.app` |
| `NEXTAUTH_SECRET` | A **brand-new** secret — see below |
| `BLOB_READ_WRITE_TOKEN` | Your public Blob store's token |

Two that cause silent failures if wrong, so double-check them:

- **`NEXTAUTH_URL`** must be the real `https://…` address people will visit. If it
  is wrong, sign-in appears to do nothing. No trailing slash.
- **`NEXTAUTH_SECRET`** should be a *fresh* value, not the one from your laptop.
  Generate one by running this in a terminal and pasting the output into the box:

  ```bash
  openssl rand -base64 32
  ```

---

## Step 4 — Tell Google about the live address

Your "Sign in with Google" only works for addresses it has been told about.

1. In the Google Cloud Console → **APIs & Services → Credentials**, open the OAuth
   client you made in task 02.
2. Under **Authorised redirect URIs**, **add** (do not replace the localhost one):

   ```
   https://YOUR-LIVE-ADDRESS/api/auth/callback/google
   ```

   Use your real address in place of `YOUR-LIVE-ADDRESS`.
3. If your app's consent screen is still "Testing", either publish it, or make
   sure every address in `ADMIN_EMAILS` is added as a **test user**.

---

## Step 5 — Deploy, then fill it with content

1. Back in Vercel, trigger a deploy (it happens automatically on a push, or use
   **Redeploy**). Wait for it to go green.
2. Tell me it is live. From a terminal whose `.env.local` points at the
   **production** database, I will run — once — the commands that:
   - fill the database with your content (`db:seed`),
   - push your project covers and CV into the production file store
     (`assets:import`),
   - create your production admin login (`admin:create`).

   You will type your admin email and password when `admin:create` asks; I never
   see them.

---

## Step 6 — The checklist I will run

Once it is live and seeded, I run an automated check against your address:

```bash
npm run verify:deploy https://YOUR-LIVE-ADDRESS
```

It confirms, without guesswork:

- the home page is real content, not an empty shell;
- the security headers are present (and the dashboard is marked "do not index");
- the admin API refuses anyone signed out (returns 401);
- an unknown or draft blog address returns a plain 404;
- the sitemap, `robots.txt` and the `/cv` link all work.

Then, together, we check the few things a script cannot:

- [ ] You can sign in with **Google**.
- [ ] You can sign in with **email and password**.
- [ ] You edit something in the dashboard, save, and the public page updates within
      a minute — **without any redeploy**.
- [ ] You upload a new CV and `/cv` serves it; an old shared link still works.
- [ ] You publish a real post, see it live, unpublish it, see it gone.
- [ ] A signed-out visitor cannot reach any `/admin` page.

When those all pass, the project is done: a live portfolio you manage entirely
from the dashboard, with nothing to edit in code to change your own content.

---

## If something goes wrong

Most first-deploy problems are one of these — all covered in more detail in
`docs/deployment.md`:

- **Sign-in does nothing / bounces back.** Usually `NEXTAUTH_URL` does not match
  the address you are visiting, or the Google redirect URI in Step 4 is missing or
  mistyped, or your address is not in `ADMIN_EMAILS`.
- **Broken image squares.** The Blob store is private (it must be public), or a
  different storage host needs allowlisting.
- **A build or database error mentioning a connection.** Migrations use the
  **direct** URL; a pooled one in the `DIRECT_URL` slot is the usual cause.

Tell me the symptom and I will read the logs. Nothing here is one-way — a bad
deploy is fixed by promoting the previous one in Vercel, which is instant.
