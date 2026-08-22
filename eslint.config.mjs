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
    },
  },
]

export default config
