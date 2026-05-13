import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx,js,jsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: '#070713',
        surface: '#0f0f1f',
        card: '#13132a',
        border: '#1f1f3a',
        neon: {
          DEFAULT: '#ff2d75',
          cyan: '#00f0ff',
          purple: '#9b5cff',
          green: '#39ff14',
          orange: '#ff7a00',
        },
      },
      fontFamily: {
        display: ['"Orbitron"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        neon: '0 0 14px rgba(255, 45, 117, 0.45), 0 0 32px rgba(155, 92, 255, 0.25)',
        glow: '0 0 24px rgba(0, 240, 255, 0.35)',
      },
      backgroundImage: {
        'grid-fade':
          'radial-gradient(circle at 50% 0%, rgba(155,92,255,0.18), transparent 60%), radial-gradient(circle at 80% 80%, rgba(255,45,117,0.18), transparent 60%)',
      },
    },
  },
  plugins: [],
};
export default config;
