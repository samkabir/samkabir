import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { z } from 'zod';

import { prisma } from './prisma.js';
import { isAdminEmail } from './adminEmails.js';
import { verifyPassword } from './password.js';
import { loginRateLimitStatus, recordLoginFailure, recordLoginSuccess } from './rateLimit.js';

/**
 * NextAuth configuration.
 *
 * Kept in `lib/` rather than inside the route file so that `getServerSession`
 * can import the same object the route uses. Two copies of this config that
 * drift apart is a way to have a session the API accepts and the sign-in flow
 * does not, or worse the reverse.
 *
 * **No database adapter.** `@next-auth/prisma-adapter` is not installed, and
 * that is deliberate — see ADR 0002 §5. The adapter creates a user row as part
 * of the OAuth handshake, *before* any application logic runs. The requirement
 * is that a rejected sign-in leaves no trace, so the order has to be: check the
 * allowlist, then persist. The `signIn` callback below writes the link row
 * itself, after the checks pass.
 *
 * Sessions are JWTs rather than database rows, which follows from having no
 * adapter, and suits a single-admin site: no session table to grow, and the
 * per-request database read still happens — in `getSessionUser`, where it also
 * re-checks the allowlist.
 */

/**
 * Session lifetime.
 *
 * Seven days. A dashboard used a few times a month is unusable at twelve hours,
 * and the exposure of a longer window is bounded by the allowlist re-check on
 * every request: removing an address from `ADMIN_EMAILS` invalidates its
 * sessions immediately, without waiting for the cookie to expire.
 */
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/**
 * Whether cookies get the `Secure` attribute.
 *
 * Derived from the configured origin rather than `NODE_ENV`, because the thing
 * that actually matters is whether the browser will be sending the cookie over
 * TLS. `Secure` on `http://localhost` means the browser silently discards the
 * cookie and sign-in appears to succeed and then not work — a genuinely
 * confusing failure.
 */
const useSecureCookies = String(process.env.NEXTAUTH_URL ?? '').startsWith('https://');

const credentialsInput = z.object({
  email: z.string().trim().toLowerCase().max(200).pipe(z.email()),
  password: z.string().min(1).max(500),
});

/** Distinguishable failures, so the form can say something useful. */
const GENERIC_FAILURE = 'Incorrect email or password.';

/**
 * Gate 2 — credentials.
 *
 * Exported so it can be tested directly. Reaching it through the provider is not
 * possible from outside NextAuth: `CredentialsProvider` returns a stub
 * (`authorize: () => null`) and stashes the real function under `options`,
 * merging it in at request time. A test that called `provider.authorize` would
 * therefore exercise NextAuth's stub, pass trivially, and assert nothing about
 * this logic — which is exactly what happened on the first attempt.
 *
 * Order matters throughout: rate limit before hashing (so a flood is cheap to
 * refuse), password check before the allowlist re-check (so the response does
 * not differ between a wrong password and a removed address), and every failure
 * path costs the same bcrypt comparison.
 */
export async function authorizeCredentials(rawCredentials, req) {
  const ip = ipFromRequest(req);

  const parsed = credentialsInput.safeParse(rawCredentials ?? {});
  if (!parsed.success) {
    // Malformed input never reaches the database or the hasher.
    throw new Error(GENERIC_FAILURE);
  }

  const { email, password } = parsed.data;

  const account = await prisma.adminUser.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, image: true, passwordHash: true },
  });

  const limit = await loginRateLimitStatus({ accountId: account?.id ?? null, ip });
  if (limit.limited) {
    throw new Error(limit.message);
  }

  // Runs even when there is no account, and even when the account has no
  // password — `verifyPassword` compares against a fixed hash in those cases so
  // the timing does not reveal which addresses exist.
  const passwordMatches = await verifyPassword(password, account?.passwordHash ?? null);

  if (!account || !passwordMatches) {
    await recordLoginFailure({
      accountId: account?.id ?? null,
      ip,
      provider: 'credentials',
      reason: !account ? 'no_such_account' : 'wrong_password',
    });
    throw new Error(GENERIC_FAILURE);
  }

  // The allowlist is re-checked here even though the account exists: an address
  // removed from ADMIN_EMAILS must stop working immediately, without anyone
  // having to remember to delete the row as well.
  if (!isAdminEmail(account.email)) {
    await recordLoginFailure({
      accountId: account.id,
      ip,
      provider: 'credentials',
      reason: 'not_allowlisted',
    });
    throw new Error(GENERIC_FAILURE);
  }

  await recordLoginSuccess({ accountId: account.id, ip, provider: 'credentials' });

  // Whatever is returned here becomes `user` in the jwt callback. The hash is
  // pointedly not part of it.
  return { id: account.id, email: account.email, name: account.name, image: account.image };
}

/**
 * Client address, for the rate limiter and the audit trail.
 *
 * Duplicated from `lib/auth.js` rather than imported, because importing it here
 * would create a cycle: `auth.js` needs `authOptions` for `getServerSession`.
 * Two short functions beat an indirection layer that exists only to break a
 * cycle.
 */
function ipFromRequest(req) {
  const forwarded = req?.headers?.['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (first?.split(',')[0] ?? req?.socket?.remoteAddress ?? '').trim() || null;
}

export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          // No refresh token is requested, because nothing here calls a Google
          // API on the user's behalf — the only thing needed is proof of which
          // address signed in. Asking for less is one fewer credential to hold.
          prompt: 'select_account',
          access_type: 'online',
        },
      },
    }),

    CredentialsProvider({
      name: 'Email and password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: authorizeCredentials,
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: SESSION_MAX_AGE_SECONDS,
  },

  jwt: { maxAge: SESSION_MAX_AGE_SECONDS },

  pages: {
    signIn: '/admin/login',
    error: '/admin/login',
  },

  cookies: {
    /**
     * Stated explicitly rather than left to the defaults.
     *
     * NextAuth's defaults are already these values, but a session cookie's flags
     * are exactly the kind of thing that should be visible in the repository
     * rather than inherited: `httpOnly` keeps it away from any script on the
     * page, and `SameSite=Lax` is what stops a third-party site from making an
     * authenticated request on the admin's behalf while still allowing the
     * top-level redirect back from Google.
     */
    sessionToken: {
      name: useSecureCookies ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
      },
    },
  },

  callbacks: {
    /**
     * Gate 1 — the provider level.
     *
     * Every sign-in, by either method, passes through here. The default is to
     * deny: an unrecognised provider returns false rather than falling through
     * to true, so adding a provider without thinking about this callback fails
     * closed.
     */
    async signIn({ user, account, profile }) {
      if (account?.provider === 'credentials') {
        // Already fully checked in `authorize`, which would have thrown.
        return true;
      }

      if (account?.provider === 'google') {
        const email = String(profile?.email ?? user?.email ?? '').trim().toLowerCase();
        const ip = null; // Not available in this callback; the audit row records the provider.

        // An unverified Google address proves nothing about who owns it, and
        // Google will happily issue a token for one.
        if (!email || profile?.email_verified === false) {
          await recordLoginFailure({ accountId: null, ip, provider: 'google', reason: 'email_unverified' });
          return false;
        }

        if (!isAdminEmail(email)) {
          await recordLoginFailure({ accountId: null, ip, provider: 'google', reason: 'not_allowlisted' });
          return false;
        }

        // The account must already exist. Google sign-in links an identity to an
        // admin; it does not create one. This is what makes "an authenticated
        // user cannot register another account and gain access" true by
        // construction rather than by a check somewhere.
        const admin = await prisma.adminUser.findUnique({
          where: { email },
          select: { id: true, name: true, image: true },
        });

        if (!admin) {
          await recordLoginFailure({ accountId: null, ip, provider: 'google', reason: 'no_such_account' });
          return false;
        }

        /**
         * Link the Google identity, now that it has earned it.
         *
         * Linking by matching email address would normally be an account
         * takeover risk — anyone who can get Google to issue a token for an
         * address could claim the account. It is safe here for one specific
         * reason: the address was already on `ADMIN_EMAILS`, which is
         * server-side configuration and not something a user can influence.
         */
        await prisma.oAuthAccount.upsert({
          where: {
            provider_providerAccountId: {
              provider: 'google',
              providerAccountId: String(account.providerAccountId),
            },
          },
          create: {
            userId: admin.id,
            provider: 'google',
            providerAccountId: String(account.providerAccountId),
          },
          update: { userId: admin.id },
        });

        // Backfill display details from Google only where we have none, so a
        // name set deliberately in the dashboard is not overwritten on every
        // sign-in.
        if ((!admin.name && user?.name) || (!admin.image && user?.image)) {
          await prisma.adminUser.update({
            where: { id: admin.id },
            data: {
              ...(admin.name ? {} : { name: user.name ?? null }),
              ...(admin.image ? {} : { image: user.image ?? null }),
            },
          });
        }

        await recordLoginSuccess({ accountId: admin.id, ip, provider: 'google' });
        return true;
      }

      return false;
    },

    /**
     * Puts our own `AdminUser.id` in the token.
     *
     * Resolved by email rather than by trusting `user.id`, which for Google is
     * the provider's subject identifier and means nothing to our database. Doing
     * the lookup here rather than mutating `user` in `signIn` keeps it
     * provider-agnostic — a third provider would need no change.
     *
     * Only on sign-in: subsequent requests reuse the token, and the
     * still-authorised check happens in `getSessionUser` against the database.
     */
    async jwt({ token, user }) {
      if (user?.email) {
        const admin = await prisma.adminUser.findUnique({
          where: { email: String(user.email).toLowerCase() },
          select: { id: true, role: true },
        });

        if (admin) {
          token.adminUserId = admin.id;
          token.role = admin.role;
        }
      }

      return token;
    },

    /** Shapes what client-side code can see. Never more than this. */
    async session({ session, token }) {
      return {
        ...session,
        user: {
          id: token.adminUserId ?? null,
          email: token.email ?? null,
          name: token.name ?? null,
          image: token.picture ?? null,
          role: token.role ?? null,
        },
      };
    },
  },

  // Verbose auth logs are useful while wiring this up and noisy afterwards.
  debug: process.env.NEXTAUTH_DEBUG === 'true',
};

export const AUTH_CONSTANTS = { SESSION_MAX_AGE_SECONDS, useSecureCookies };
