# Task 03 — Create the file store

**Needed for:** Phase 5. Not urgent. Do tasks 01 and 02 first.

**Time:** about 5 minutes.

**Cost:** free on Vercel's Hobby plan, which your portfolio qualifies for
(Hobby is free for non-commercial use, and a personal portfolio is
non-commercial).

---

## What you are actually doing

Your CV, your project screenshots and your blog cover images have to live
somewhere the dashboard can write to. Right now they sit in the `public/`
folder in this repo — which means replacing your CV requires editing code and
redeploying. That is exactly what we are getting rid of.

**Why they cannot just stay in `public/`:** once deployed, Vercel makes your
project's files read-only. An upload from the dashboard would have nowhere to
land. This is the same constraint that ruled out SQLite in task 01 — same
cause, different symptom.

So: a **Blob store**. A small piece of Vercel storage your app can write files
into and serve them from a public URL.

---

## Step 1 — Make a Vercel account

If you already have one, skip to Step 2.

1. Go to **https://vercel.com/signup**
2. Choose **Continue with GitHub** — same reasoning as Neon, one less password.
3. Authorize Vercel when GitHub asks.
4. If it asks about a plan, pick **Hobby**. If it asks for a team name, your
   own name is fine.

**Do not connect this repository to Vercel yet.** Deploying is Phase 11, and
doing it now would publish a half-finished dashboard to the internet. We only
want the storage right now.

---

## Step 2 — Create the Blob store

1. In the Vercel dashboard, click **Storage** in the top navigation.
2. Click **Create Database** (or **Create Store** — the wording moves around).
3. Choose **Blob**.
4. Name it `portfolio-media`.
5. Region: pick the one closest to you, same reasoning as Neon.
6. Click **Create**.

---

## Step 3 — Copy the token

Once created, Vercel shows the store's settings. Find the section with
environment variables or tokens, and look for:

```
BLOB_READ_WRITE_TOKEN
```

Copy its value. It is a long string starting with `vercel_blob_rw_`.

There may be a **Show secret** or eye icon to reveal it first, and often a
one-click **Copy Snippet** button — either is fine.

> **This token is a password.** Anyone holding it can upload files to your
> store and delete your CV. Do not paste it into our chat or anywhere public.
>
> **If it leaks:** revoke it from the store's settings and generate a new one,
> then redo Step 4. Recoverable, not a catastrophe.

---

## Step 4 — Add it to your file

Open `.env` and **add to the bottom**, keeping everything already there:

```bash
# File storage — Vercel Blob
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."
```

Save.

---

## Step 5 — Check the file

Names only, no values — safe to share:

```bash
grep -o '^[A-Z_]*' .env
```

All eight should now have values:

```
DATABASE_URL
DIRECT_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
ADMIN_EMAILS
NEXTAUTH_URL
NEXTAUTH_SECRET
BLOB_READ_WRITE_TOKEN
```

And once more:

```bash
git status --short
```

`.env` must **not** appear.

---

## Step 6 — Tell me

Say **"task 03 done"** and I will build the upload handling — including the
security checks that stop someone disguising an executable as an image — and
delete this file.

---

## If something goes wrong

**"I cannot find Storage in the dashboard."**
It is in the top nav of the Vercel dashboard, sometimes under your team name
rather than a specific project. A Blob store does not need to belong to a
project.

**"It is asking me to add a payment method."**
You may have landed on Pro. Check you are on **Hobby**. If Blob genuinely
requires payment for your account, **stop and tell me** — we switch to
**Cloudinary**, which is free indefinitely with no card. I built the storage
layer behind an interface precisely so this swap is a one-file change. This is
a planned fallback, not a problem.

**"How much can I store?"**
Far more than you need. Your entire current asset set — every project
screenshot plus the CV — is a few megabytes. Blog covers might add a few more.
You will not come close to a limit.

---

## A note on what I will build here

So you know what is being protected against, since you are trusting this thing
with your public website:

- **Type checking by content, not by name.** A file called `photo.png` that is
  actually a program gets rejected, because the check reads the file's actual
  first bytes rather than believing its extension.
- **Size limits** per file type.
- **Generated storage names.** Your uploaded filename is never used as the
  storage path, which closes off a class of path-traversal tricks.
- **Authentication on the upload route itself.** Not just on the page with the
  upload button — on the endpoint, so a direct request from outside the
  dashboard is rejected too.
