import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        background: '#ffffff',
        foreground: '#0f172a',
        muted: '#f8fafc',
        accent: '#1f2937'
      },
      keyframes: {
        'toast-in': {
          '0%': {
            opacity: '0',
            transform: 'translateY(-12px) scale(0.98)'
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0) scale(1)'
          }
        },
        'toast-out': {
          '0%': {
            opacity: '1',
            transform: 'translateY(0) scale(1)'
          },
          '100%': {
            opacity: '0',
            transform: 'translateY(-8px) scale(0.96)'
          }
        },
        'toast-bar': {
          '0%': {
            transform: 'scaleX(1)'
          },
          '100%': {
            transform: 'scaleX(0)'
          }
        }
      },
      animation: {
        'toast-in': 'toast-in 0.28s cubic-bezier(0.22, 1, 0.36, 1) both',
        'toast-out': 'toast-out 0.2s ease forwards',
        'toast-bar': 'toast-bar var(--toast-duration, 3000ms) linear forwards'
      }
    }
  },
  plugins: []
};

export default config;
