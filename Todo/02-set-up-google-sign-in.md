# Task 02 — Set up "Sign in with Google"

**Needed for:** Phase 4. Not urgent — do task 01 first. Come back to this when
I say Phase 4 is starting.

**Time:** about 10 minutes. This is the fiddliest task in the folder, mostly
because Google's console is cluttered. Nothing here is difficult, there is just
a lot of screen.

**Cost:** free.

---

## What you are actually doing

You want to log into your own dashboard by clicking "Sign in with Google"
instead of typing a password. For that to work, Google needs to know your app
exists. You register it once, and Google gives you two values: a **Client ID**
and a **Client Secret**.

You will *also* be able to log in with email and password (that comes from
task 01's database, no setup needed). Google is the convenient option; the
password is the always-works fallback. Having both means one can break without
locking you out.

---

## Step 1 — Open Google Cloud Console

1. Go to **https://console.cloud.google.com**
2. Sign in with the Google account you want to log in *with*. This matters —
   whichever account you use here should be the one you intend to use as admin.
3. If this is your first time, accept the terms of service.

Do not be alarmed by how enterprise-y this looks. You are using a very small
corner of it, and none of it costs money.

---

## Step 2 — Create a project

1. At the very top of the page there is a project dropdown — it may say
   "Select a project" or show an existing project name. Click it.
2. Click **New Project**.
3. Name it `samkabir-portfolio`. Leave Location as **No organization**.
4. Click **Create**, then wait a few seconds.
5. **Make sure the project dropdown at the top now shows
   `samkabir-portfolio`.** This is the single most common mistake — people
   configure the wrong project and then wonder why nothing works. Check it.

---

## Step 3 — Configure the consent screen

This is the "App wants access to your Google account" screen you have clicked
through a hundred times on other sites. You are writing yours.

1. In the left sidebar, find **APIs & Services** → **OAuth consent screen**.
   (If the sidebar is hidden, click the ☰ hamburger icon top-left.)
2. Choose **External**, then **Create**.

> **"External" sounds wrong for a private dashboard, but it is correct.**
> "Internal" only exists for Google Workspace organisations. External with a
> restricted test-user list is the right choice, and it is what we are doing.

3. Fill in the **App information** page:

| Field | What to put |
|---|---|
| App name | `Samiul Kabir Portfolio Admin` |
| User support email | Your own email, from the dropdown |
| App logo | Skip it |
| Application home page | Skip for now |
| Developer contact email | Your own email again |

4. Click **Save and Continue**.
5. On the **Scopes** page — change nothing. Click **Save and Continue**.
6. On the **Test users** page, click **+ Add users** and add **your own email
   address**. Click **Save and Continue**.

> **This is a real security layer, not a formality.** While the app stays in
> "Testing" mode, only the emails on this list can even reach the Google
> sign-in step. Combined with the allowlist I build in the app itself, that is
> two independent gates before anyone touches your dashboard.

7. Click **Back to Dashboard**. Leave publishing status as **Testing** — do
   not click "Publish app". You do not want strangers at this screen.

---

## Step 4 — Create the credentials

1. Left sidebar → **APIs & Services** → **Credentials**.
2. Click **+ Create Credentials** at the top → **OAuth client ID**.
3. Application type: **Web application**.
4. Name: `Portfolio Admin Local`.

Now the part that actually matters. Two lists to fill in — and they must match
**exactly**, character for character. A trailing slash or `http` vs `https`
will silently break sign-in.

Under **Authorised JavaScript origins**, click **+ Add URI**:

```
http://localhost:3000
```

Under **Authorised redirect URIs**, click **+ Add URI**:

```
http://localhost:3000/api/auth/callback/google
```

Check both against the above one more time. `http` not `https` for localhost.
No trailing slash on the origin. The redirect path is exactly
`/api/auth/callback/google`.

5. Click **Create**.

---

## Step 5 — Copy the two values

A dialog appears with **Your Client ID** and **Your Client Secret**.

- The **Client ID** ends in `.apps.googleusercontent.com`.
- The **Client Secret** is a shorter random string, usually starting `GOCSPX-`.

> The **secret is a password.** Do not paste it into our chat, a screenshot, or
> anywhere public. The Client ID is not especially sensitive, but treat the
> pair as one secret and you cannot go wrong.

The secret is retrievable later from the Credentials page, so if you close the
dialog too early you have not lost anything.

---

## Step 6 — Add them to your file

Open the same `.env.local` you made in task 01 and **add these lines to the
bottom** — do not delete what is already there:

```bash
# Google sign-in
GOOGLE_CLIENT_ID="...apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-..."

# Who is allowed to sign in. Comma-separated, no spaces.
ADMIN_EMAILS="samkabir26@gmail.com"

# Where the app lives, and the key that signs your login cookie.
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="GENERATE_THIS_SEE_STEP_7"
```

Change `ADMIN_EMAILS` if you want a different address as admin. It must be the
same address you added as a test user in Step 3.

---

## Step 7 — Generate the session key

`NEXTAUTH_SECRET` is a random key that signs your login cookie so nobody can
forge one. You do not choose it — you generate it. Run:

```bash
openssl rand -base64 32
```

Copy the output and replace `GENERATE_THIS_SEE_STEP_7` with it, keeping the
quotes. It will look something like `k9Jx2mQ...=` — 44 characters ending in
`=`.

If `openssl` is not available, tell me and I will generate one for you.

---

## Step 8 — Check the file

This prints only the variable **names**, never the values, so the output is
safe to share:

```bash
grep -o '^[A-Z_]*' .env.local
```

You should see all six:

```
DATABASE_URL
DIRECT_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
ADMIN_EMAILS
NEXTAUTH_URL
NEXTAUTH_SECRET
```

And confirm Git is still ignoring the file:

```bash
git status --short
```

`.env.local` must **not** appear.

---

## Step 9 — Tell me

Say **"task 02 done"** and I will wire up authentication, test that a
non-allowlisted Google account is properly rejected, and delete this file.

---

## If something goes wrong

**"Error 400: redirect_uri_mismatch"**
The single most common failure. The redirect URI in Google does not exactly
match what the app sent. Go back to Step 4 and compare character by character —
usually it is a trailing slash, or `https` where it should be `http`.

**"This app is blocked" / "Access blocked"**
Your email is not in the Test users list. Step 3, item 6.

**"I lost the client secret."**
Credentials page → click your OAuth client → there is an option to add a new
secret. Old ones can be deleted. Nothing is permanently lost.

**"I made the credentials in the wrong project."**
Delete them, switch to the right project using the dropdown at the top, and
redo Step 4. Harmless.

**Production note.** These credentials only work on `localhost`. When we deploy
in Phase 11, a second redirect URI gets added for the live domain. That is
covered in task 04, which I will write then.
