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
        // The public site's families (components/site). `sans` stays as it was so
        // the admin's unthemed text is untouched.
        geist: ['var(--font-geist)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        'geist-mono': ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
        serif: ['var(--font-newsreader)', 'Georgia', 'serif'],
      },
      // Theme tokens for the public site; each is a CSS variable that flips with
      // `data-theme` (see `.ss` in globals.css).
      colors: {
        ss: {
          bg: 'var(--ss-bg)',
          elev: 'var(--ss-elev)',
          subtle: 'var(--ss-subtle)',
          fg: 'var(--ss-fg)',
          muted: 'var(--ss-muted)',
          faint: 'var(--ss-faint)',
          line: 'var(--ss-line)',
          accent: 'var(--ss-accent)',
          'accent-soft': 'var(--ss-accent-soft)',
        },
      },
    },
  },
  plugins: [],
  variants: {
    display: ['responsive', 'group-hover', 'group-focus'],
   },
}