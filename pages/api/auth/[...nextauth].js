import NextAuth from 'next-auth';

import { authOptions } from '@/lib/authOptions';

/**
 * The NextAuth endpoints: sign-in, callbacks, sign-out, session, CSRF.
 *
 * The configuration lives in `lib/authOptions.js` so `getServerSession` can
 * import the same object this route uses. Two copies that drift apart is how you
 * get a session the API accepts and the sign-in flow does not.
 */
export default NextAuth(authOptions);
