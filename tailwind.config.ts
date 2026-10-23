import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 钉钉风格的中性色(电脑版和手机版共用)
        ink: '#1F2329',
        'ink-soft': '#646A73',
        'ink-faint': '#8F959E',
        paper: '#F5F6F8',
        surface: '#FFFFFF',
        line: '#E5E6EB',
        // 员工端(钉钉风格)
        brand: { DEFAULT: '#1677FF', deep: '#0958D9', soft: '#E6F0FF' },
        app: '#F5F6F8',
        // 状态语义色:DEFAULT 用于圆点/色块/角标,soft 用于浅底提示条,text 是过了对比度的文字色
        st: {
          pending: { DEFAULT: '#FA8C16', soft: '#FFF7E6', text: '#AD4E00' },
          approved: { DEFAULT: '#52C41A', soft: '#F6FFED', text: '#237804' },
          rejected: { DEFAULT: '#F5222D', soft: '#FFF1F0', text: '#CF1322' },
          muted: { DEFAULT: '#8C8C8C', soft: '#F5F5F5', text: '#595959' },
        },
        // 下面这几组是老版电脑页面里用的名字(pine / gold / rust / leave-*)。
        // 名字没改,颜色换成钉钉的蓝 / 橙 / 红,这样所有电脑页面一次就跟着变了。
        pine: { DEFAULT: '#1677FF', deep: '#0958D9', soft: '#E6F0FF' },
        gold: { DEFAULT: '#D46B08', soft: '#FFF7E6' },
        rust: { DEFAULT: '#CF1322', soft: '#FFF1F0' },
        leave: {
          annual: '#1677FF',
          medical: '#F5222D',
          maternity: '#EB2F96',
          paternity: '#722ED1',
          unpaid: '#8C8C8C',
          holiday: '#FA8C16',
        },
      },
      fontFamily: {
        // Manrope 没有中文字形,显式写出中文字体,各手机上的中文观感才一致
        sans: ['var(--font-manrope)', 'PingFang SC', 'Hiragino Sans GB', 'Noto Sans SC', 'Microsoft YaHei', 'sans-serif'],
        // 钉钉没有衬线标题:display 也用无衬线
        display: ['var(--font-manrope)', 'PingFang SC', 'Hiragino Sans GB', 'Noto Sans SC', 'Microsoft YaHei', 'sans-serif'],
      },
      // 代码里已经在用 shadow-xs / shadow-2xs / backdrop-blur-xs / active:scale-98,
      // 在这里定义,Tailwind v3 下也会生效
      boxShadow: {
        xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        '2xs': '0 1px rgb(0 0 0 / 0.05)',
      },
      backdropBlur: { xs: '2px' },
      scale: { 98: '0.98' },
      keyframes: {
        'sheet-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        fade: { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      animation: {
        'sheet-up': 'sheet-up .22s cubic-bezier(.2,.8,.2,1)',
        fade: 'fade .18s ease-out',
      },
    },
  },
  plugins: [],
}
export default config
