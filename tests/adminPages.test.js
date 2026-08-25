import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { ADMIN_NAV } from '@/lib/adminNav';

/**
 * The Phase 6 counterpart to `tests/adminRoutes.test.js`.
 *
 * Every dashboard page must resolve the session on the server before it renders,
 * and the page list is **discovered from the filesystem** rather than written
 * down here — for the same reason the route list is. A hand-maintained list is
 * exactly as good as whoever last remembered to update it, and the failure it
 * misses is a new screen that renders for anyone who types its URL.
 *
 * ## Why this reads the source instead of importing it
 *
 * Every component in this project is JSX inside a `.js` file, which is Next's
 * convention and predates this suite. Vite transforms `.jsx` and `.ts(x)` but
 * leaves `.js` alone, so importing a page module here fails to parse — and the
 * ways round that are a new dependency (`@vitejs/plugin-react`) or a bundler
 * hack, both a large price for one assertion.
 *
 * Reading the file is the same technique `tests/schemaAlignment.test.js` and
 * `tests/mediaRelations.test.js` already use, and the guarantee is split in two
 * to keep it honest:
 *
 *   * **This file** proves every page delegates its guard to `withAdminPage` —
 *     that none has its own, and none has none.
 *   * **`tests/adminPage.test.js`** proves `withAdminPage` actually redirects,
 *     by calling it.
 *
 * Together those are stronger than importing each page and checking it redirects,
 * which would pass for a page that hand-rolled a check with a subtle hole in it.
 */
const PAGES_DIR = path.join(import.meta.dirname, '..', 'pages', 'admin');

const pageFiles = readdirSync(PAGES_DIR).filter((name) => name.endsWith('.js')).sort();

/**
 * The login page is the deliberate exception.
 *
 * It is the one screen that must render *without* a session — guarding it would
 * redirect a signed-out visitor to the page they are already on, forever. It has
 * its own `getServerSideProps` that does the opposite: it sends a signed-in
 * visitor away. Named here so that "not guarded" is a decision this file records
 * rather than an omission it failed to notice.
 */
const UNGUARDED = ['login.js'];

const guardedPages = pageFiles.filter((name) => !UNGUARDED.includes(name));

const sourceOf = (name) => readFileSync(path.join(PAGES_DIR, name), 'utf8');

/** `index.js` → `/admin`, `skills.js` → `/admin/skills`. */
const routeOf = (name) =>
  name === 'index.js' ? '/admin' : `/admin/${name.replace(/\.js$/, '')}`;

describe('dashboard page discovery', () => {
  it('finds the screens', () => {
    // A floor, not an exact count. A wrong directory would otherwise make every
    // assertion below pass by iterating over nothing — the failure mode this
    // guards against.
    expect(guardedPages.length).toBeGreaterThanOrEqual(9);
  });

  it('still has the login page, so its exclusion stays deliberate', () => {
    expect(pageFiles).toContain('login.js');
  });
});

describe('every dashboard page is guarded server-side', () => {
  for (const name of guardedPages) {
    it(`${routeOf(name)} exports getServerSideProps`, () => {
      expect(sourceOf(name)).toMatch(/export const getServerSideProps\b/);
    });

    it(`${routeOf(name)} builds it with withAdminPage`, () => {
      const source = sourceOf(name);

      expect(source).toMatch(/export const getServerSideProps = withAdminPage\(/);
      expect(source).toMatch(/import \{ withAdminPage \} from '@\/lib\/adminPage'/);
    });

    it(`${routeOf(name)} wraps its component in adminScreen`, () => {
      // The theme and the toast provider have to sit *above* the screen. Rendering
      // them from inside it — which is what `AdminLayout` used to do — puts them
      // below every hook the screen calls, and every screen that fetched anything
      // threw on its first render. Asserted here so it cannot come back quietly.
      const source = sourceOf(name);

      expect(source).toMatch(/export default adminScreen\(/);
      expect(source).toMatch(/import AdminLayout, \{ adminScreen \} from '@\/components\/admin\/AdminLayout'/);
    });

    it(`${routeOf(name)} does not resolve the session itself`, () => {
      // A page calling `getSessionUser` directly would be a second
      // implementation of the guard, and the second one is the one that
      // eventually forgets a check. `withAdminPage` is the only caller.
      expect(sourceOf(name)).not.toMatch(/getSessionUser/);
    });
  }
});

describe('the login page', () => {
  const source = sourceOf('login.js');

  it('has its own server-side check', () => {
    expect(source).toMatch(/export async function getServerSideProps/);
  });

  it('resolves the session with the same function the API uses', () => {
    // Not `useSession` on the client, which would trust the cookie without
    // re-checking the allowlist — and so would offer the dashboard to someone
    // whose address had been removed.
    expect(source).toMatch(/getSessionUser/);
  });

  it('sends a signed-in visitor somewhere safe', () => {
    // Through `safeReturnPath`, so a crafted `?from=` cannot bounce the admin to
    // another origin immediately after authenticating.
    expect(source).toMatch(/safeReturnPath/);
  });
});

describe('the navigation matches the screens that exist', () => {
  const hrefs = ADMIN_NAV.map((item) => item.href);

  it('points every nav item at a real page', () => {
    // A nav item pointing at a route with no file is a 404 the author never
    // clicks — they know where their own screens are — so something else has to
    // notice.
    const routes = new Set(guardedPages.map(routeOf));

    for (const href of hrefs) {
      expect(routes.has(href), `${href} has no page file`).toBe(true);
    }
  });

  it('has a nav item for every page', () => {
    // The other direction: a screen with no way to reach it is a screen nobody
    // uses. `/admin/blogs` covers tags too, which is why the check is by page
    // rather than by feature.
    for (const name of guardedPages) {
      expect(hrefs, `${routeOf(name)} is not in ADMIN_NAV`).toContain(routeOf(name));
    }
  });

  it('describes each item, for the sidebar tooltip and the Overview', () => {
    for (const item of ADMIN_NAV) {
      expect(item.label, `${item.href} label`).toBeTruthy();
      expect(item.description, `${item.href} description`).toBeTruthy();
    }
  });

  it('has no duplicate hrefs', () => {
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
