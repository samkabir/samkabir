# Task 04 — Create a public Blob store

**Needed for:** uploads to work at all. **This is blocking right now.**

**Time:** about 3 minutes.

**Cost:** free.

---

## Where this stands

You checked the store's settings and found:

> **Store Access — Private.** This is a private store. Blobs uploaded here
> require a token to read. Use this for sensitive data. **The access mode cannot
> be changed after creation.**

So there is nothing to toggle. The store has to be replaced. That is the whole
task, and it is quick — the store is empty, so nothing is lost.

Task 03 was done correctly. Vercel changed its default so that new stores are
private, and there was no way to know from the creation screen.

---

## Why a private store cannot work here

A private blob has no publicly readable URL — reading one requires an
authenticated call through Vercel's SDK, using your token.

Your portfolio is a public website. Every project screenshot on the home page,
every blog cover, and your CV have to be readable by someone who is not signed
in and does not have your token. That is the entire point of them.

**I did consider keeping the private store** and serving every file through your
own server instead, so you know the recommendation is informed rather than
lazy. It would work, and I decided against it: it means a serverless function
runs for every image that is not already cached, it adds a round trip to a page
whose whole job is loading fast, it spends free-tier invocations on serving
static pictures, and it is a permanent piece of extra machinery to maintain — all
to avoid three minutes of clicking today.

Nothing being uploaded is sensitive. These are files you are deliberately
publishing.

---

## Step 1 — Create a new store

1. Go to **https://vercel.com/dashboard** → **Storage**.
2. Click **Create Database** (or **Create Store**) → **Blob**.
3. Name it `portfolio-media-public`.
4. **Look for the access setting and choose public.** This is the only step
   that matters, and it is the one that cannot be fixed later. If you are not
   certain which you picked, stop and check before continuing — the store's
   Settings tab will say `Store Access: Public`.
5. Region: the same one you chose before.
6. Create.

> **If there is no public option at all**, stop and tell me. That would mean
> Vercel has stopped offering public stores, and we switch to **Cloudinary** —
> free indefinitely, no card. I built the storage layer so that it is the only
> file that knows which provider is in use, so that swap is a one-file change.
> This is a planned fallback, not a problem.

---

## Step 2 — Copy the new token

Open the new store, find `BLOB_READ_WRITE_TOKEN`, and copy its value. It starts
with `vercel_blob_rw_`.

> Still a password. Don't paste it into our chat.

---

## Step 3 — Replace the old value

Open `.env.local` and **replace** the existing `BLOB_READ_WRITE_TOKEN` value
with the new one. Keep every other line as it is — you are changing one value,
not adding a line.

Save.

---

## Step 4 — Delete the old store

Go back to **Storage**, open `portfolio-media`, and delete it.

Safe to do: it is empty. I cleaned up everything my testing put there and
confirmed the store held zero objects.

This is worth doing rather than leaving it — an unused private store next to a
used public one is exactly the kind of thing that leads to pasting the wrong
token in six months.

---

## Step 5 — Check

```bash
grep -o '^[A-Z_]*' .env.local
git status --short
```

Still eight names, and `.env.local` must not appear in the git output.

---

## Step 6 — Tell me

Say **"task 04 done"** and I will re-run the upload verification against the
new store — including the one check I could not perform, that an uploaded file
is genuinely readable at a public URL by someone with no token — and delete this
file.

---

## What is already verified

So you know this is not blocked on guesswork. I pointed the code at the private
store temporarily and ran the whole upload flow end to end — **39 checks, all
passing**: real files uploading with the right type, size and dimensions;
byte-level checking refusing a PDF renamed `.png`; oversized uploads refused;
the audit trail; `/cv` redirecting to the active CV; and deletion refusing to
remove the file behind a live CV. Then I reverted the code and left the store
empty.

The only untested step is the one this task unblocks.

That run also found a real bug in my own code, now fixed: media deletion removed
the stored file *before* the database row, so when the database correctly refused
to delete a file still in use by your CV, the file was already gone and the row
was left pointing at nothing. It is now row first, file second, with a test that
fails if anyone reverses it.
