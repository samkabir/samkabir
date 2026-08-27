import NextAuth from 'next-auth';

import { authOptions } from '@/lib/authOptions';

/**
 * The NextAuth endpoints: sign-in, callbacks, sign-out, session, CSRF.
 *
 * The configuration lives in `lib/authOptions.js` so `getServerSession` can
 * import the same object this route uses. Two copies that drift apart is how you
 * get a session the API accepts and the sign-in flow does not.
 */
/**
 * Headroom for a cold start. Neon's free tier suspends an idle database, so the
 * first sign-in after a quiet period pays a wake-up cost on top of the several
 * queries `authorizeCredentials` makes. Vercel's 10s default can clip that; 30s
 * absorbs it without ever mattering to a warm request.
 */
export const config = { maxDuration: 30 };

export default NextAuth(authOptions);
