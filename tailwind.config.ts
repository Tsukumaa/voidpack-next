import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: {
          bg:       '#06010e',
          surface:  '#0a0816',
          purple:   '#7b2bff',
          cyan:     '#00c896',
          text:     '#f6f1ff',
          muted:    'rgba(255,255,255,0.45)',
          border:   'rgba(255,255,255,0.08)',
        },
        rarity: {
          common:    '#9ca3af',
          rare:      '#3b82f6',
          epic:      '#a855f7',
          legendary: '#f59e0b',
          void:      '#7b2bff',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'booster-float': 'boosterFloat 6.5s ease-in-out infinite',
        'aura-pulse':    'auraPulse 4.8s ease-in-out infinite',
        'badge-pulse':   'badgePulse 2s ease-in-out infinite',
        'rock-float':    'rockerFloat 11s ease-in-out infinite',
      },
      keyframes: {
        boosterFloat: {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%':     { transform: 'translateY(-10px)' },
        },
        auraPulse: {
          '0%,100%': { opacity: '0.52', scale: '0.96' },
          '50%':     { opacity: '0.92', scale: '1.08' },
        },
        badgePulse: {
          '0%,100%': { boxShadow: '0 0 10px rgba(0,200,150,0.25)' },
          '50%':     { boxShadow: '0 0 22px rgba(0,200,150,0.55)' },
        },
        rockerFloat: {
          '0%,100%': { transform: 'translate(0px, 0px) rotate(0deg)' },
          '25%':     { transform: 'translate(3px, -9px) rotate(0.25deg)' },
          '50%':     { transform: 'translate(-2px, -16px) rotate(-0.2deg)' },
          '75%':     { transform: 'translate(4px, -7px) rotate(0.15deg)' },
        },
      },
      backgroundImage: {
        'void-bg': "linear-gradient(rgba(3,3,8,0.62), rgba(3,3,8,0.62)), url('/assets/bg-void.png')",
      },
    },
  },
  plugins: [],
}

export default config
