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
