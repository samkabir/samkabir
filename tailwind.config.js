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
        sans: ['var(--font-itim)']
      },
    },
  },
  plugins: [],
  variants: {
    display: ['responsive', 'group-hover', 'group-focus'],
   },
}