# Task 04 — Make the Blob store public

**Needed for:** uploads to work at all. **This is blocking right now.**

**Time:** about 2 minutes.

**Cost:** free. This is a setting, not a plan change.

---

## What happened

Task 03 was done correctly — the store exists and the token works. But Vercel
now creates Blob stores with **private** access by default, and I only found out
when the first real upload came back with:

```
Vercel Blob: Cannot use public access on a private store.
```

That is not something either of us could have known from the dashboard; the
setting is not mentioned during creation. My instructions in task 03 didn't
mention it because when I wrote them, public was the default.

---

## Why it has to be public

A private blob has no publicly readable URL. Reading one requires an
authenticated call through Vercel's SDK.

Your portfolio is a public website. Every project screenshot on your home page,
every blog cover image, and your CV all have to be readable by someone who is
not signed in — that is the entire point of them. With a private store, each of
those would have to be fetched through your own server on every request, which
would be slower, would burn through the free tier's function invocations, and
would stop the images being cached by Vercel's CDN.

Nothing here is secret. These are files you are deliberately publishing.

---

## Step 1 — Open the store

1. Go to **https://vercel.com/dashboard**
2. Click **Storage** in the top navigation.
3. Click your store, **portfolio-media**.

---

## Step 2 — Find the access setting

Look for a **Settings** tab within the store, and an entry mentioning
**Access**, **Public access**, or **Store access**. Switch it to **public**.

The wording and location move around, so if you cannot find it, don't hunt for
more than a minute — go to Step 3 instead.

---

## Step 3 — If it cannot be changed

Access may be fixed at creation time. If there is no setting to change, make a
new store:

1. **Storage** → **Create** → **Blob**.
2. Name it `portfolio-media-public`.
3. **Look for a public/private choice during creation and pick public.**
4. Same region as before.
5. Create it, then open it and copy the new `BLOB_READ_WRITE_TOKEN`.
6. In `.env.local`, **replace** the existing `BLOB_READ_WRITE_TOKEN` value with
   the new one. Keep everything else.

> Same rule as always: the token is a password. Don't paste it into our chat.

You can delete the old private store afterwards — nothing is stored in it. I
already cleaned up everything my testing put there, and I confirmed it is empty.

---

## Step 4 — Check

```bash
grep -o '^[A-Z_]*' .env.local
git status --short
```

Eight names, and no `.env.local` in the git output.

---

## Step 5 — Tell me

Say **"task 04 done"** and I will re-run the upload verification against the
real store — including that an uploaded file is genuinely fetchable at a public
URL, which is the one thing I could not confirm — and delete this file.

---

## What I verified in the meantime

So you know this isn't blocked on guesswork. I pointed the code at the private
store temporarily and ran the full upload flow end to end — **39 checks, all
passing**: real files uploading, byte-level type checking rejecting a PDF renamed
`.png`, oversized uploads refused, the audit trail, `/cv` redirecting to the
active CV, and deletion refusing to remove the file behind a live CV. Then I
reverted the code and cleaned the store back to empty.

The only untested step is "the URL is publicly readable", which is precisely what
this task fixes.

That run also found a real bug in my own code, which is now fixed: media deletion
removed the stored file *before* the database row, so when the database correctly
refused to delete a file still in use by your CV, the file was already gone and
the row was left pointing at nothing. The order is now row first, file second,
with a test that fails if anyone reverses it.
