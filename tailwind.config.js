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
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
        itim: ['var(--font-itim)'],
      },
      colors: {
        ink: {
          950: '#070b16',
          900: '#0b1222',
          800: '#111a2e',
          700: '#1a2540',
        },
        accent: {
          DEFAULT: '#7a61ff',
          soft: '#a594ff',
        },
        mint: '#64ffda',
      },
    },
  },
  plugins: [],
  variants: {
    display: ['responsive', 'group-hover', 'group-focus'],
   },
}
