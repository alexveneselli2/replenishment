/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: '#C9A96E',
        'gold-light': '#E8D5A3',
        'gold-dim': '#9A7A4A',
        navy: '#0D0D0F',
        charcoal: '#1A1A2E',
        surface: '#16213E',
        'surface-2': '#0F3460',
        'off-white': '#E8E4DD',
        'muted': '#A09D97',
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'luxury-dark': 'linear-gradient(135deg, #0D0D0F 0%, #1A1A2E 100%)',
      },
      boxShadow: {
        'gold': '0 0 20px rgba(201,169,110,0.15)',
        'gold-lg': '0 0 40px rgba(201,169,110,0.2)',
        'critical': '0 0 12px rgba(239,68,68,0.3)',
        'high': '0 0 12px rgba(245,158,11,0.3)',
        'medium': '0 0 12px rgba(16,185,129,0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
