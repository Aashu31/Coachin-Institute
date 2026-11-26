/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          900: '#0F172A',
          800: '#1E293B',
          700: '#334155',
        },
        primary: {
          600: '#2563EB',
          500: '#3B82F6',
          50: '#EFF6FF',
        },
        status: {
          present: '#16A34A',
          'present-light': '#DCFCE7',
          absent: '#DC2626',
          'absent-light': '#FEE2E2',
          warning: '#D97706',
          'warning-light': '#FEF3C7',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        red: '0 0 20px 2px rgba(220, 38, 38, 0.35)',
      },
      minHeight: {
        touch: '48px',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(18px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'sheet-in': {
          from: { opacity: '0', transform: 'translateY(32px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'alert-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(220, 38, 38, 0.42)' },
          '50%': { boxShadow: '0 0 0 10px rgba(220, 38, 38, 0)' },
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(-10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out both',
        'slide-up': 'slide-up 320ms ease-out both',
        'sheet-in': 'sheet-in 240ms ease-out both',
        'alert-pulse': 'alert-pulse 1.8s ease-in-out infinite',
        'toast-in': 'toast-in 200ms ease-out both',
      },
    },
  },
  plugins: [],
};
