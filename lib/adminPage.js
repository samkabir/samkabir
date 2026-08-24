import { getSessionUser } from './auth.js';
import { loginUrlFor } from './returnPath.js';

/**
 * The server-side guard every dashboard page goes through.
 *
 * There are three layers of protection on the dashboard and it is worth being
 * precise about what each one is for, because two of them are not security:
 *
 *   1. `proxy.js` redirects anonymous visitors away from `/admin`. It inspects
 *      only the JWT, because it runs on the edge runtime where Prisma cannot. It
 *      is a convenience so a bookmarked URL lands on a login form.
 *
 *   2. **This function.** It runs on the server for every page render, calls the
 *      same `getSessionUser` the API calls, and so applies the same three checks:
 *      a valid session, an account that still exists, and an address still on
 *      `ADMIN_EMAILS`. Middleware cannot do the last two.
 *
 *   3. `withAdmin` on every `/api/admin/*` route. This is the one that actually
 *      protects the data, because the data is not in the page — the screens fetch
 *      it after they mount. If this file were deleted, every dashboard page would
 *      render an empty shell whose requests all returned 401.
 *
 * So the reason this exists is not that the pages hold secrets. It is that
 * showing a signed-out visitor a working-looking dashboard which then fails ten
 * requests is a bad experience, and that a page render is the right moment to
 * discover a revoked session.
 *
 * Usage — either bare, or wrapping a loader that needs the request:
 *
 *     export const getServerSideProps = withAdminPage();
 *
 *     export const getServerSideProps = withAdminPage(async ({ user }) => ({
 *       props: { counts: await countEverything() },
 *     }));
 */
export function withAdminPage(loadProps) {
  return async function getServerSideProps(context) {
    const user = await getSessionUser(context.req, context.res);

    if (!user) {
      return {
        redirect: {
          // Carries where they were trying to go, so signing in resumes it
          // rather than dumping them on the Overview.
          destination: loginUrlFor(context.resolvedUrl),
          // Never permanent: the answer changes the moment they sign in, and a
          // 308 would be cached by the browser and keep redirecting afterwards.
          permanent: false,
        },
      };
    }

    const result = loadProps ? await loadProps({ ...context, user }) : { props: {} };

    // A loader is allowed to redirect or 404 on its own terms — a missing record,
    // say — and that decision must not be overwritten by merging props into it.
    if (result?.redirect || result?.notFound) return result;

    return {
      ...result,
      props: { ...(result?.props ?? {}), adminUser: serialiseUser(user) },
    };
  };
}

/**
 * The admin, reduced to something Next can put in props.
 *
 * Two reasons this is explicit rather than a spread. `lastLoginAt` is a `Date`,
 * and Next refuses to serialise one — the error names the field but not the
 * cause, and it only appears when an account has actually signed in before.
 * And the field list is an allowlist: `getSessionUser` already excludes
 * `passwordHash`, but props are rendered into the HTML the browser receives, so
 * this is the last place a sensitive column could leak into a page source.
 */
export function serialiseUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    image: user.image ?? null,
    role: user.role,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
  };
}
