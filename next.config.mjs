import path from 'node:path';

import { ADMIN_HEADERS, baseSecurityHeaders } from './lib/securityHeaders.js';

// ESM has no `__dirname`; `import.meta.dirname` is the direct replacement (Node
// 20.11+), and this is why the file is `.mjs` — the header builders live in
// `lib/` as ES modules, and a `require` of them from a CommonJS config would not
// resolve.
const projectRoot = import.meta.dirname;

// The security headers differ by environment: HSTS and `upgrade-insecure-requests`
// are production-only, and the two dev conveniences (`'unsafe-eval'`, the HMR
// WebSocket) are dev-only. `next dev` sets NODE_ENV to `development`, and
// `next build` / `next start` set it to `production`.
const isDev = process.env.NODE_ENV !== 'production';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the workspace root. A stray lockfile in the home directory makes Next
  // infer ~/ as the root, which slows every build and dev start to a crawl.
  turbopack: {
    root: path.join(projectRoot),
  },
  outputFileTracingRoot: path.join(projectRoot),

  images: {
    /**
     * Project covers and blog images are served from Vercel Blob, and
     * `next/image` refuses a remote host it has not been told about — otherwise
     * any page could point the optimiser at any URL and use this deployment as
     * an image proxy.
     *
     * Scoped to the `public.blob` subdomain deliberately. The private variant
     * (`*.private.blob.vercel-storage.com`) has no publicly readable URL, so
     * allowing it would only ever produce broken images while widening what the
     * optimiser will fetch.
     */
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
        pathname: '/**',
      },
    ],
  },

  async rewrites() {
    return [
      // `/cv` is the link that goes on a CV, in an email signature, on LinkedIn.
      // It resolves through pages/api/cv.js to whichever Resume row is active,
      // so replacing the file never breaks a link anyone has already shared.
      { source: '/cv', destination: '/api/cv' },
    ];
  },

  /**
   * Security headers.
   *
   * The base set is applied to every route through the catch-all source; the
   * admin pair is layered on top for `/admin/*` and `/api/admin/*`. Next merges
   * matching sources, so an admin page ends up with the base policy *and*
   * `noindex` + `no-store`. The rationale for each header — and why the CSP keeps
   * `'unsafe-inline'` — is in `lib/securityHeaders.js`.
   */
  async headers() {
    const base = baseSecurityHeaders({ dev: isDev });

    return [
      { source: '/:path*', headers: base },
      { source: '/admin/:path*', headers: ADMIN_HEADERS },
      { source: '/api/admin/:path*', headers: ADMIN_HEADERS },
    ];
  },
};

export default nextConfig;
