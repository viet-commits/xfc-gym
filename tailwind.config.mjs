/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        'xfc-black': '#0D0D0D',
        'xfc-dark': '#1C1C1C',
        'xfc-gold': '#B8962E',
        'xfc-gold-light': '#FDF6E3',
        'xfc-white': '#FFFFFF',
        'xfc-muted': '#AAAAAA',
      },
      fontFamily: {
        'bebas': ['"Bebas Neue"', 'sans-serif'],
        'montserrat': ['Montserrat', 'sans-serif'],
        'inter': ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}