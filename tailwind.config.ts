import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        chemvault: {
          ink: '#0f172a',
          paper: '#f8fafc',
          accent: '#0369a1',
          muted: '#334155',
          halo: '#0ea5e9'
        }
      },
      backgroundImage: {
        academic: 'linear-gradient(140deg, #f8fafc 0%, #eef2ff 45%, #e8f1ff 100%)'
      },
      boxShadow: {
        card: '0 18px 40px rgba(2, 6, 23, 0.10)'
      },
      animation: {
        fade: 'fadeIn 0.35s ease both',
        pulseSlow: 'pulse 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      }
    }
  },
  plugins: []
};

export default config;
