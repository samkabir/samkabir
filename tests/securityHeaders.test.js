import { describe, expect, it } from 'vitest';

import nextConfig from '../next.config.mjs';
import {
  ADMIN_HEADERS,
  PERMISSIONS_POLICY,
  baseSecurityHeaders,
  contentSecurityPolicy,
} from '@/lib/securityHeaders';

/**
 * The response-header contract.
 *
 * These headers are defence in depth, not the boundary, but a regression in them
 * is silent — the site still renders, and nothing fails until the day the missing
 * header would have mattered. So the shape is pinned here: a directive removed
 * from the CSP, or HSTS leaking into a dev build, is a failing test rather than a
 * discovery in production.
 *
 * The builders are tested for both environments directly, and `next.config.mjs`
 * is imported to prove the config actually applies them — a correct builder wired
 * to nothing would pass every assertion below except the last block.
 */

/** Parses a CSP string into `{ directive: [values] }` for order-independent checks. */
function parseCsp(csp) {
  const map = {};
  for (const part of csp.split(';')) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name) map[name] = values;
  }
  return map;
}

const keysOf = (headers) => headers.map((h) => h.key);
const valueOf = (headers, key) => headers.find((h) => h.key === key)?.value;

describe('the content security policy', () => {
  const prod = parseCsp(contentSecurityPolicy({ dev: false }));
  const dev = parseCsp(contentSecurityPolicy({ dev: true }));

  it('locks down the directives an injection would need', () => {
    // Even with 'unsafe-inline' on scripts, these close the exfiltration and
    // clickjacking paths — see the essay in lib/securityHeaders.js.
    expect(prod['default-src']).toEqual(["'self'"]);
    expect(prod['base-uri']).toEqual(["'self'"]);
    expect(prod['object-src']).toEqual(["'none'"]);
    expect(prod['frame-ancestors']).toEqual(["'none'"]);
    expect(prod['form-action']).toEqual(["'self'"]);
    expect(prod['connect-src']).toEqual(["'self'"]);
  });

  it('allows exactly the image origins the site serves from', () => {
    expect(prod['img-src']).toContain("'self'");
    expect(prod['img-src']).toContain('https://*.public.blob.vercel-storage.com');
    expect(prod['img-src']).toContain('https://*.googleusercontent.com');
  });

  it('self-hosts fonts, so no external font origin is allowed', () => {
    // next/font bakes Rubik into the build; a Google Fonts origin here would widen
    // the policy for a request that never happens.
    expect(prod['font-src']).toEqual(["'self'", 'data:']);
  });

  it('keeps unsafe-inline for MUI and Next hydration, on both scripts and styles', () => {
    expect(prod['style-src']).toContain("'unsafe-inline'");
    expect(prod['script-src']).toContain("'unsafe-inline'");
  });

  it('grants the two dev-only relaxations only in development', () => {
    expect(dev['script-src']).toContain("'unsafe-eval'");
    expect(dev['connect-src']).toContain('ws:');

    expect(prod['script-src']).not.toContain("'unsafe-eval'");
    expect(prod['connect-src']).not.toContain('ws:');
  });

  it('upgrades insecure subresources in production only', () => {
    expect(prod).toHaveProperty('upgrade-insecure-requests');
    expect(dev).not.toHaveProperty('upgrade-insecure-requests');
  });
});

describe('the base header set', () => {
  const prod = baseSecurityHeaders({ dev: false });
  const dev = baseSecurityHeaders({ dev: true });

  it('carries the non-negotiable headers', () => {
    expect(valueOf(prod, 'X-Content-Type-Options')).toBe('nosniff');
    expect(valueOf(prod, 'Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(valueOf(prod, 'X-Frame-Options')).toBe('DENY');
    expect(valueOf(prod, 'Permissions-Policy')).toBe(PERMISSIONS_POLICY);
    expect(valueOf(prod, 'Content-Security-Policy')).toContain("default-src 'self'");
  });

  it('sends HSTS in production but never over http://localhost', () => {
    // Sent in dev it would be remembered by the browser and force https on
    // localhost for two years, breaking `next dev` past the session that set it.
    expect(valueOf(prod, 'Strict-Transport-Security')).toMatch(/max-age=\d+/);
    expect(keysOf(dev)).not.toContain('Strict-Transport-Security');
  });
});

describe('the admin-only headers', () => {
  it('keep the dashboard out of every index and every cache', () => {
    expect(valueOf(ADMIN_HEADERS, 'X-Robots-Tag')).toBe('noindex, nofollow');
    expect(valueOf(ADMIN_HEADERS, 'Cache-Control')).toContain('no-store');
  });
});

describe('next.config.mjs actually applies them', () => {
  it('puts the base set on every route and the admin pair on admin routes', async () => {
    const rules = await nextConfig.headers();

    const bySource = Object.fromEntries(rules.map((rule) => [rule.source, rule.headers]));

    // The catch-all carries the base policy.
    expect(bySource['/:path*']).toBeTruthy();
    expect(keysOf(bySource['/:path*'])).toContain('Content-Security-Policy');

    // Both admin trees carry noindex + no-store, layered on top of the base set
    // that the catch-all already matched.
    for (const source of ['/admin/:path*', '/api/admin/:path*']) {
      expect(bySource[source], `${source} missing`).toBeTruthy();
      expect(keysOf(bySource[source])).toContain('X-Robots-Tag');
      expect(keysOf(bySource[source])).toContain('Cache-Control');
    }
  });
});
