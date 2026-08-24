# 0004 — Authentication: three gates, no registration path

**Phase:** 4
**Status:** accepted

## Context

The requirement, from the brief:

> The system must ensure that an authenticated user cannot simply register
> another account and gain access to the dashboard.
> …
> Do not rely solely on frontend route protection. An API request made directly
> outside the dashboard must still verify authorization.
> …
> Do NOT hardcode the password in source code, Git, database seed files that
> expose it, or frontend code.

Two sign-in methods were asked for — Google and email/password — which means two
paths to the same authority, and therefore two places to get the check wrong.

## Decision

### 1. Three gates, each independently sufficient to refuse

**Gate 1, the provider.** Every sign-in passes through NextAuth's `signIn`
callback. It returns `false` unless the address is on `ADMIN_EMAILS` *and* an
`AdminUser` row already exists for it. Default is deny: an unrecognised provider
falls through to `return false`, so adding a provider without considering this
callback fails closed.

**Gate 2, credentials.** bcrypt at 12 rounds, with the allowlist re-checked after
the password matches, and a rate limit checked before the hash is computed.

**Gate 3, the request.** `withAdmin` wraps every `/api/admin/*` handler and
resolves the session server-side. This is the gate that matters — curl, Postman
and any cross-origin caller hit exactly the same check as the dashboard.

`proxy.js` (the `/admin` page redirect) is deliberately **not** on that list. It
is a convenience so a human with a bookmark lands on a login form rather than a
broken page. If it were deleted, the dashboard would render empty shells and
every request behind it would still return 401. Saying so plainly, because the
opposite assumption is the mistake the brief calls out by name.

### 2. The allowlist is environment configuration, and fails closed

`ADMIN_EMAILS` rather than a database column or a table. A table can be written
to by a bug, and whoever can add a row has added themselves an account.
Environment configuration can only be changed by whoever controls the deployment.

`isAdminEmail` returns `false` when `ADMIN_EMAILS` is unset or empty, rather than
treating "no allowlist" as "no restriction". A missing environment variable is a
plausible accident; this makes its consequence *nobody can sign in* rather than
*anybody can*.

### 3. No database adapter

`@next-auth/prisma-adapter` is not installed. The adapter creates a user row as
part of the OAuth handshake, before any application logic runs — so a stranger
with a valid Google account would leave a row behind even when rejected. The
requirement is that a rejected sign-in leaves no trace, so the order has to be
allowlist first, persist second. The `signIn` callback writes the `OAuthAccount`
link itself, after the checks pass.

This is why `OAuthAccount` in the schema does not match the adapter's shape,
decided back in [ADR 0002 §5](0002-database-schema.md).

Consequence: sessions are JWTs, not database rows. That suits a single admin —
no session table to grow — and the per-request database read still happens, in
`getSessionUser`, where it also does the work below.

### 4. The allowlist is re-checked on every request

A JWT is self-contained and stays cryptographically valid until it expires.
Without a per-request check, removing an address from `ADMIN_EMAILS` would have
no effect for up to seven days.

So `getSessionUser` does three things on every admin request: confirms the token
carries an id, confirms the row still exists, and confirms the address is *still*
allowlisted. The cost is one indexed primary-key lookup on a dashboard used by
one person — a good trade for revocation that actually works.

Verified end to end: a live session cookie, still valid, is refused the moment
the address stops matching, and accepted again when it is restored.

### 5. Account creation is CLI-only

`npm run admin:create` is the only way an admin account comes into existence.
There is no registration endpoint, no signup form, and no seed file containing a
password. That is what makes "an authenticated user cannot register another
account" true by construction rather than by a check that could be missed.

The password is read from hidden stdin. The alternatives all leak:

| Route | Leak |
|---|---|
| Echoed to the terminal | Shoulder-surfing, screen recordings, pairing sessions |
| `--password` flag | Visible in `ps` to every user on the machine; written to shell history |
| Environment variable | Inherited by every child process; often printed by CI logs |
| A file | Needs deleting, and is one careless `git add -f` from being committed |

Typed into a prompt and passed in memory to bcrypt avoids all four.

Raw-mode handling is forty lines written by hand rather than a dependency,
because a dependency that touches the password is a dependency whose every
future version touches the password. Ctrl-C is handled explicitly — without it,
raw mode swallows the interrupt and leaves the user's terminal with echo
disabled, which looks like a broken shell.

### 6. Recovery is CLI-only too

No "forgot password" email flow. That would need an email provider, an API key,
a token table, and a public endpoint that accepts an address and acts on it — a
meaningful amount of new attack surface for a single-user dashboard whose owner
has shell access to a machine that can reach the database.

The trade-off is real: losing the password while away from such a machine means
being locked out until you reach one. Google sign-in is the mitigation — two
independent ways in, so one failing does not lock you out. This was the option
chosen when the question was put during the audit.

### 7. Rate limiting is backed by the audit log, not memory

The obvious implementation is a `Map` of attempts, and on Vercel it would be
close to useless: each serverless instance has its own memory, so requests spread
across instances each see a fresh counter, and every cold start forgets
everything. A limit that only holds under conditions production does not have is
worse than none, because it reads as protection.

Every failure is already written to `AuditLog`. Counting recent rows gives a
limit that is shared across instances, survives restarts, and needs no new table
or dependency. Login is rare enough that the extra query costs nothing.

Five failures per account or ten per address in fifteen minutes. The account
limit is tighter because it is the specific thing being attacked; the address
limit is looser because one address is also a whole office behind NAT, and
locking out a legitimate admin is its own kind of failure.

The limit is checked **before** the password is verified, so even a correct
password is refused while it holds — otherwise it would only slow down an
attacker who never guesses right. Confirmed end to end: the correct password
succeeds at four failures and is refused at five.

### 8. Failure responses are uniform, and so is their timing

Wrong password, unknown address, and an account removed from the allowlist all
return `Incorrect email or password.` A response that distinguishes them tells an
attacker which addresses have accounts.

Timing is equalised too. `verifyPassword` compares against a fixed bcrypt hash
when there is no account or no stored hash, so "no such user" does not return in
microseconds while a real comparison takes ~250 ms.

Unrecognised addresses are **not** recorded in the audit log. An audit log full
of addresses someone guessed is a liability, not a record.

### 9. Google linking by email, safely

Linking a Google identity to an account by matching email address is normally an
account-takeover risk: anyone who can get a provider to issue a token for an
address could claim the account.

It is safe here for one specific reason — the address was already on
`ADMIN_EMAILS`, which is server-side configuration and not something a user can
influence. Linking is enabled *only* after that check passes. `email_verified`
is also required, because an unverified address proves nothing about who owns it
and Google will happily issue a token for one.

### 10. `Secure` is derived from the origin, not `NODE_ENV`

What matters is whether the browser will send the cookie over TLS. `Secure` on
`http://localhost` means the browser silently discards it, so sign-in appears to
succeed and then does not work — a genuinely confusing failure to debug. Derived
from `NEXTAUTH_URL`, so production gets `Secure` and the `__Secure-` prefix while
local development works.

`SameSite=Lax` rather than `Strict`: `Strict` would drop the cookie on the
top-level redirect back from Google, breaking OAuth entirely.

### 11. `proxy.js`, not `middleware.js`

Next.js 16 deprecated the `middleware` file convention in favour of `proxy`.
Building on a deprecated convention on day one is a migration scheduled for an
inconvenient moment.

## Consequences

- Phase 3's routes needed no changes. One function was replaced.
- Removing an address from `ADMIN_EMAILS` revokes its sessions immediately.
- Rotating `NEXTAUTH_SECRET` invalidates every session — the only "sign out
  everywhere" available without a session table, which the reset script says.
- The first sign-in requires a terminal. There is no bootstrap through the UI,
  by design.

## What this does not do

- **No 2FA.** Google sign-in with 2FA on the Google account covers the
  convenient path; the password path does not have a second factor. Worth adding
  if the dashboard ever holds more than portfolio content.
- **No session table**, so individual sessions cannot be listed or revoked one
  at a time — only all at once, via the secret.
- **Google sign-in is not covered by automated tests end to end.** The callback
  logic is tested directly, including that a rejected sign-in creates no row, but
  completing a real OAuth round trip needs a real Google account and a browser.
  Verified by hand instead.

## Bugs and surprises found while building this

**`CredentialsProvider` discards the `authorize` you give it.** It returns
`{ authorize: () => null, options }` and NextAuth merges the real function from
`options` at request time. The first version of the test suite called
`provider.authorize(...)` — which exercised NextAuth's stub, returned `null`, and
asserted nothing about the actual logic. `authorizeCredentials` is now exported
and tested directly.

**bcrypt silently truncates at 72 bytes.** Verified rather than assumed: a
90-character passphrase and a truncated variant sharing its first 72 bytes
authenticate identically, so the user believes they have more entropy than they
do. The policy rejects anything longer, counted in *bytes* — emoji and
non-Latin scripts reach the limit far sooner than their length suggests.

**A test that counted `adminUser.update` calls failed for the wrong reason.**
`recordLoginSuccess` also updates the row to stamp `lastLoginAt`, so "did the
Google name overwrite the dashboard name" had to be asserted on *what* was
written, not how many writes happened.

**Every CLI invocation printed a Node warning.** `MODULE_TYPELESS_PACKAGE_JSON`,
because the scripts import ESM `lib/*.js` files from a package with no
`"type": "module"`. Adding that field would break `next.config.js`,
`tailwind.config.js` and `postcss.config.js`, all CommonJS. Silencing the single
warning is the smaller change.
