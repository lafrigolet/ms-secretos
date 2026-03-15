/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        cream:      '#F7F4EF',
        'off-white': '#FDFCFA',
        sage:       '#6B7B5E',
        'sage-dark': '#4A5740',
        'sage-light': '#C8D4BE',
        earth:      '#8C6E52',
        'earth-light': '#D4B99A',
        charcoal:   '#2C2C28',
        muted:      '#8A8880',
        border:     '#E2DDD6',
        gold:       '#B8963C',
        error:      '#8B3A2F',
        success:    '#4A7054',
      },
      fontFamily: {
        serif: ['Cormorant Garamond', 'serif'],
        sans:  ['DM Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
