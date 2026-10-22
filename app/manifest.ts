import type { MetadataRoute } from 'next'

// 应用设定(PWA manifest):员工把网站"添加到主屏幕"后,看起来、用起来都像一个 App ——
// 有自己的图标和名字,打开时没有浏览器的地址栏(standalone)。
// Next.js 会自动把它放在 /manifest.webmanifest,并在每个页面的 <head> 里加上链接。
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'E-Leave',
    short_name: 'E-Leave',
    description: 'Company leave application & approval system',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    // 启动画面(手机系统自动生成的那一屏)的底色:和登录页的浅蓝背景接近,两屏衔接成一屏
    background_color: '#E7F5FC',
    theme_color: '#F6F4EE',
    icons: [
      // "any":原本的圆角 logo,iPhone / 电脑 / 一般安卓用
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // "maskable":安卓会把图标切成圆形或圆角,所以 logo 缩小放在安全区里,不会被切掉
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
