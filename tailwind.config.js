/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          red:    '#E63232',
          dark:   '#C42020',
          orange: '#FF6B00',
          black:  '#111111',
          gray:   '#1A1A1A',
          card:   '#222222',
          paper:  '#F6F1E8',
          ink:    '#171717',
          line:   '#E8D8C6',
          muted:  '#6D655C',
        },
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        display: ['"Bebas Neue"', 'cursive'],
      },
      animation: {
        'slide-up':   'slideUp 0.3s ease-out',
        'fade-in':    'fadeIn 0.2s ease-out',
        'bounce-in':  'bounceIn 0.4s ease-out',
      },
      keyframes: {
        slideUp:   { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        fadeIn:    { from: { opacity: 0 }, to: { opacity: 1 } },
        bounceIn:  { '0%': { transform: 'scale(0.8)', opacity: 0 }, '70%': { transform: 'scale(1.05)' }, '100%': { transform: 'scale(1)', opacity: 1 } },
      },
    },
  },
  plugins: [],
};
