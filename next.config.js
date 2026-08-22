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
}

module.exports = nextConfig
