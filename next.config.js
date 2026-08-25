const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the workspace root. A stray lockfile in the home directory makes Next
  // infer ~/ as the root, which slows every build and dev start to a crawl.
  turbopack: {
    root: path.join(__dirname),
  },
  outputFileTracingRoot: path.join(__dirname),

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
}

module.exports = nextConfig
