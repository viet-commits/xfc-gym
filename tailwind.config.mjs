/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      // Declared as channel triplets so Tailwind can compose an alpha channel.
      // `bg-[var(--accent-primary)]/10` can never work: Tailwind has no channels to
      // work with inside a var(), so the utility is silently never generated.
      // These read the same --*-rgb vars the global CSS uses, so there is one
      // source of truth for each colour.
      colors: {
        'xfc-black': 'rgb(var(--bg-primary-rgb) / <alpha-value>)',
        'xfc-dark': 'rgb(var(--bg-secondary-rgb) / <alpha-value>)',
        'xfc-gold': 'rgb(var(--accent-primary-rgb) / <alpha-value>)',
        'xfc-gold-light': 'rgb(var(--accent-light-rgb) / <alpha-value>)',
        'xfc-white': 'rgb(var(--text-primary-rgb) / <alpha-value>)',
        'xfc-muted': 'rgb(var(--text-muted-rgb) / <alpha-value>)',
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