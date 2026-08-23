# Task 01 — Create the database

**Needed for:** Phase 2. This is blocking right now — I cannot create the
database structure until this exists.

**Time:** about 5 minutes.

**Cost:** free, and no credit card is asked for.

---

## What you are actually doing

Your portfolio content currently lives in JavaScript files in this repo. It is
moving into a database — a separate service that stores it and lets the
dashboard change it without touching code.

You are going to create an empty database at **Neon** and copy two long lines
of text into a file on your computer. That is the whole task. You will not
write any SQL, and you will not design anything — I do that in Phase 2.

**Why Neon and not something simpler:** you asked about SQLite. SQLite keeps
the database in a file next to your code, which sounds simpler and is — right
up until you deploy. Vercel makes your files **read-only** in production, so
the public site could read your content but every "Save" in the dashboard
would fail. Since saving is the entire point, SQLite is out. Neon's free tier
has no card requirement and it sleeps when unused, so it genuinely costs
nothing.

---

## Step 1 — Make a Neon account

1. Open **https://neon.com** in your browser.
2. Click **Sign up**.
3. Choose **Continue with GitHub**. You already have a GitHub account
   (`samkabir`), so this is the fastest route and means one less password.
4. GitHub will ask you to authorize Neon. Click the green **Authorize** button.

If it asks you to pick a plan, choose the **Free** one.

---

## Step 2 — Create the project

Neon will likely walk you through this automatically right after signup. If
not, look for a **New Project** button.

Fill it in like this:

| Field | What to put |
|---|---|
| Project name | `samkabir-portfolio` |
| Database name | `portfolio` (or leave the default) |
| Postgres version | Leave the default |
| Region | Pick whichever is **geographically closest to you** |

> **About the region:** it affects how fast your dashboard feels. If you are in
> Bangladesh, `Asia Pacific (Singapore)` or `Asia Pacific (Mumbai)` is the
> closest. This cannot be changed later without recreating the project, but
> honestly for a portfolio either is fine — do not agonise over it.

Click **Create project**.

---

## Step 3 — Copy the two connection strings

After creating the project, Neon shows you a **Connection string** — one long
line starting with `postgresql://`.

**You need two versions of it.** Look for a dropdown or toggle near the
connection string, usually labelled **Connection pooling** or **Pooled
connection**.

1. **With pooling turned ON** — copy that string. This is your `DATABASE_URL`.
   It contains `-pooler` somewhere in the host name.
2. **With pooling turned OFF** — copy that string too. This is your
   `DIRECT_URL`. It looks almost identical but has **no** `-pooler`.

They will look roughly like this (yours will differ — this is an example, not
a value to use):

```
postgresql://portfolio_owner:AbC123xyz@ep-cool-name-12345-pooler.ap-southeast-1.aws.neon.tech/portfolio?sslmode=require
postgresql://portfolio_owner:AbC123xyz@ep-cool-name-12345.ap-southeast-1.aws.neon.tech/portfolio?sslmode=require
```

> **These are passwords.** That `AbC123xyz` part is a real database password.
> Anyone holding this string can read and delete all your content. Do not paste
> either string into our chat, into a GitHub issue, into a screenshot, or
> anywhere public.
>
> **If you leak one by accident:** it is fixable, not a disaster. Go to Neon →
> your project → **Roles** → **Reset password**, then redo Step 4 with the new
> string. Tell me and I will help.

If you cannot find the pooled/unpooled toggle, do not worry — copy whichever
string you can see, put it in as `DATABASE_URL`, and tell me. I will find the
other one with you.

---

## Step 4 — Put them in a file

In the project folder (`/home/samiul/Personal/samkabir`), create a new file
called exactly:

```
.env
```

The leading dot matters. In VS Code: right-click in the file explorer →
**New File** → type `.env`.

Or, quicker, copy the template I have already committed — it has every variable
name in it with the values left blank:

```bash
cp .env.example .env
```

Then fill in the two database lines. If you created the file by hand instead,
paste this in, replacing the example values with your real strings:

```bash
# Database — from Neon. Never commit this file.
DATABASE_URL="postgresql://...-pooler...?sslmode=require"
DIRECT_URL="postgresql://...?sslmode=require"
```

Points that trip people up:

- **Keep the double quotes.** The strings contain characters that confuse
  things without them.
- **No spaces around the `=`.** `DATABASE_URL="..."`, not
  `DATABASE_URL = "..."`.
- **Each one on a single line.** If your editor wraps a long line visually that
  is fine, but do not press Enter in the middle of one.
- **Save the file.**

---

## Step 5 — Check it worked

Run this in the terminal, from the project folder:

```bash
git status --short
```

**`.env` must NOT appear in the output.** If it does not appear, Git is
correctly ignoring it and you are safe. If it *does* appear, stop and tell me
before committing anything.

Then confirm the file is readable and shaped right — this prints only the
variable *names*, never the secret values, so it is safe output:

```bash
grep -o '^[A-Z_]*' .env
```

You should see at least these two:

```
DATABASE_URL
DIRECT_URL
```

If you copied `.env.example`, you will see all eight names. That is fine — the
other six stay empty until tasks 02 and 03.

---

## Step 6 — Tell me

Say **"task 01 done"** and I will:

1. Verify I can reach the database.
2. Apply the migration I have already written — it creates all 16 tables.
3. Run `npm run db:smoke`, which writes a row into every table, checks the
   relationships behave as designed, and deletes everything it created. That is
   the point where we know the database is genuinely correct and not just
   connected.
4. Delete this file from `Todo/`.

The schema and the migration are already written and committed, so this is the
only thing standing between here and a working database.

You do not need to give me the connection string. My commands read
`.env` directly from your disk.

---

## If something goes wrong

**"I cannot find the connection string again."**
Neon dashboard → your project → **Dashboard** or **Connect**. It is always
retrievable; you have not lost anything.

**"Neon is asking for a credit card."**
You have probably landed on a paid plan by accident. Look for a **Free** or
**Hobby** tier. If there genuinely is no free option visible, tell me and we
will reconsider — Neon's free tier does exist, so this would mean something
changed.

**"I already clicked something wrong / made two projects."**
Harmless. Delete the extra project, or just ignore it. Nothing is broken and
nothing is billed.

**"I do not understand a word in here."**
Check the jargon list at the bottom of [README.md](README.md), and if it is
still unclear just ask. A confusing instruction is my fault, not yours.
