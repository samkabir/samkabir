import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'out/**', 'build/**'],
  },
  ...nextCoreWebVitals,
  {
    rules: {
      // The portfolio still uses plain <img> in several components. Migrating to
      // next/image is planned work, so surface it as a warning, not an error.
      '@next/next/no-img-element': 'warn',

      // eslint-config-next does not enable this, so unused imports went
      // unreported until a manual sweep in Phase 3 found two. An unused import
      // is usually a leftover from a refactor and occasionally a sign that the
      // intended call was never wired up, which is worth hearing about.
      // Arguments are exempt: a handler signature is often `(req, res)` even
      // when only one is used, and renaming those to `_res` is noise.
      'no-unused-vars': ['error', { args: 'none', ignoreRestSiblings: true }],
    },
  },
]

export default config
