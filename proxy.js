import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * Redirects anonymous visitors away from `/admin` to the sign-in page.
 *
 * Named `proxy` rather than `middleware`: Next.js 16 deprecated the `middleware`
 * file convention in favour of this one, and building on a deprecated convention
 * on day one is a migration scheduled for an inconvenient moment.
 *
 * **This is a convenience, not a security boundary.** It exists so that a human
 * who opens a bookmarked dashboard URL lands on a login form instead of a broken
 * page. It protects nothing: it runs on the page request, and the data behind
 * those pages comes from `/api/admin/*`, which is guarded independently by
 * `withAdmin` in `lib/auth.js`. If this file were deleted, the dashboard would
 * render empty shells and every request behind it would still return 401.
 *
 * Stated plainly because the opposite assumption — that hiding a route is
 * protection — is the mistake this project's brief calls out by name.
 *
 * Only the JWT is inspected. This runs on the edge runtime, where Prisma cannot,
 * so the "does this account still exist and is it still allowlisted" check
 * cannot happen here. It happens in `getSessionUser`, per request, where the
 * database is reachable — another reason this cannot be the boundary.
 */
export async function proxy(req) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    // Must match the cookie name in authOptions, which varies with the scheme:
    // getToken looks for the wrong name otherwise and reads every visitor as
    // anonymous, producing a redirect loop for signed-in users.
    secureCookie: String(process.env.NEXTAUTH_URL ?? '').startsWith('https://'),
  });

  if (token?.adminUserId) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/admin/login', req.url);

  // Where to return to after signing in. Only the path and query are carried
  // over — taking a full URL from the request would let a crafted link bounce
  // the admin to another origin after a successful sign-in.
  const returnTo = `${req.nextUrl.pathname}${req.nextUrl.search}`;
  if (returnTo !== '/admin/login') {
    loginUrl.searchParams.set('from', returnTo);
  }

  return NextResponse.redirect(loginUrl);
}

export const config = {
  /**
   * Everything under /admin except the login page itself, which would otherwise
   * redirect to itself forever.
   *
   * `/api/admin/*` is deliberately absent: those routes must answer 401 to a
   * programmatic caller, not 307 to an HTML page. A redirect would also make the
   * dashboard's own fetches silently return the login page's markup where JSON
   * was expected.
   */
  matcher: ['/admin', '/admin/((?!login).*)'],
};
