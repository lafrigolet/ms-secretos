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
      boxShadow: {
        'card':     '0 2px 16px rgba(44,44,40,0.06), 0 1px 4px rgba(44,44,40,0.04)',
        'elevated': '0 8px 32px rgba(44,44,40,0.12), 0 2px 8px rgba(44,44,40,0.06)',
        'float':    '0 -4px 24px rgba(44,44,40,0.08)',
        'btn':      '0 4px 16px rgba(74,87,64,0.28)',
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        '.scrollbar-none': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        },
      })
    },
  ],
}
