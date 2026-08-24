# Todo — things only you can do

These are the tasks that need *your* accounts and *your* credentials. I cannot
do them for me — signing up for services and clicking "Allow" has to be you.

Each task is one file. Work through them in order. **When you finish one, tell
me and I will delete that file**, so this folder always shows exactly what is
left.

## The tasks

| # | Task | Needed for | Time |
|---|---|---|---|
| ~~01~~ | ~~Create the database~~ | ~~Phase 2~~ | **done** |
| ~~02~~ | ~~Set up Google sign-in~~ | ~~Phase 4~~ | **done** |
| ~~03~~ | ~~Create the file store~~ | ~~Phase 5~~ | **done** |
| ~~04~~ | ~~Create a public Blob store~~ | ~~Phase 5~~ | **done** |

Task 04 was not in the original plan. Vercel changed its default so new Blob
stores are private, which only surfaced when the first real upload failed — task
03 was done correctly. Because the access mode is fixed at creation, the store
had to be recreated rather than reconfigured.

**Nothing is outstanding.** Every task in this folder is done, and the folder
stays only for the production deployment task, which gets written when we reach
Phase 11 — it depends on choices not yet made, so writing it now would only go
stale.

---

## Two rules that matter more than the rest

**1. Never paste a secret into our chat.**

Not the database URL, not a client secret, not an API token. You put them in a
file called `.env.local` on your own computer. I read that file when I run
commands — I never need to *see* the value, and it never ends up in our
conversation history.

**2. Never commit `.env.local`.**

I already added it to `.gitignore` in Phase 1, so Git will ignore it
automatically. You do not need to do anything — just do not go out of your way
to force it in.

To check at any point that Git is genuinely ignoring it:

```bash
git status --short
```

If `.env.local` does **not** appear in that list, you are safe. If it *does*
appear, stop and tell me.

---

## A word on jargon

You said you are a beginner, so — plain definitions of the words that come up
in these files. No shame in not knowing these; nobody is born knowing them.

- **Environment variable** — a setting your app reads at startup instead of
  having it typed into the code. Used for anything secret, so the secret can
  change without changing the code, and so it never lands in Git.
- **`.env.local`** — the plain text file where those settings live on your
  machine. One `NAME=value` per line. It stays on your computer.
- **Connection string / URL** — one long line of text containing everything
  needed to reach your database: the address, the username, the password. It
  *is* a password. Treat it like one.
- **Migration** — a versioned change to the database's structure ("add a
  `blog_post` table with these columns"). Written as a file so the exact same
  change can be replayed on another database. I write these; you never
  hand-edit them.
- **Pooled vs direct connection** — two doors into the same database. Pooled
  handles many short-lived connections and is what the running website uses.
  Direct is a single stable connection, which is what migration tools need.
  Neon gives you both; we use both.
- **Seed** — a script that fills a fresh, empty database with starting content.
  Ours will import your existing experiences, projects and skills.
- **OAuth** — the "Sign in with Google" mechanism. You register your app with
  Google once; Google then hands your app a signed confirmation of who signed
  in, so your app never sees the Google password.
