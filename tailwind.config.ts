import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1B2A28',
        'ink-soft': '#57655F',
        'ink-faint': '#8B9791',
        paper: '#F6F4EE',
        surface: '#FFFFFF',
        line: '#E3DFD3',
        pine: {
          DEFAULT: '#2F6B5E',
          deep: '#234F45',
          soft: '#E7F0EC',
        },
        gold: {
          DEFAULT: '#C9A227',
          soft: '#F6EDCF',
        },
        rust: {
          DEFAULT: '#B54A2A',
          soft: '#F5E4DC',
        },
        leave: {
          annual: '#2F6B5E',
          medical: '#B54A2A',
          maternity: '#6B5B95',
          paternity: '#3B6E91',
          unpaid: '#8A8377',
          holiday: '#C9A227',
        },
      },
      fontFamily: {
        sans: ['var(--font-manrope)', 'sans-serif'],
        display: ['var(--font-fraunces)', 'serif'],
      },
    },
  },
  plugins: [],
}
export default config
