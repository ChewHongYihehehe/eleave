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
        // 员工端(钉钉风格)
        brand: { DEFAULT: '#1677FF', deep: '#0958D9', soft: '#E6F0FF' },
        app: '#F5F6F8',
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
      // 登录页动效:logo 弹入、内容上浮、水纹向外扩散
      keyframes: {
        pop: { from: { opacity: '0', transform: 'scale(.85)' }, to: { opacity: '1', transform: 'scale(1)' } },
        rise: { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        ripple: {
          '0%': { opacity: '0', transform: 'scale(1)' },
          '12%': { opacity: '.4' },
          '100%': { opacity: '0', transform: 'scale(3.4)' },
        },
      },
      animation: {
        pop: 'pop .55s cubic-bezier(.2,.8,.2,1) both',
        rise: 'rise .5s ease-out both',
        ripple: 'ripple 4.4s ease-out infinite both',
      },
    },
  },
  plugins: [],
}
export default config
