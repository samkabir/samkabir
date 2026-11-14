/** @type {import('tailwindcss').Config} */
module.exports = {
  important: true,
  content: [ 
  "./pages/**/*.{js,ts,jsx,tsx}",
  "./components/**/*.{js,ts,jsx,tsx}",
],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-itim)'],
        // The public site's families (see lib/fonts.js). Named apart from
        // `sans`/`mono` so the admin, which uses those, is untouched.
        mo: ['var(--font-inter-tight)', 'system-ui', 'sans-serif'],
        'mo-serif': ['var(--font-instrument)', 'Georgia', 'serif'],
        'mo-mono': ['var(--font-jetbrains)', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Theme tokens from styles/globals.css; they switch with `data-theme`.
        mo: {
          bg: 'var(--mo-bg)',
          elev: 'var(--mo-elev)',
          sunk: 'var(--mo-sunk)',
          fg: 'var(--mo-fg)',
          muted: 'var(--mo-muted)',
          faint: 'var(--mo-faint)',
          line: 'var(--mo-line)',
          accent: 'var(--mo-accent)',
          'accent-ink': 'var(--mo-accent-ink)',
        },
      },
    },
  },
  plugins: [],
  variants: {
    display: ['responsive', 'group-hover', 'group-focus'],
   },
}
