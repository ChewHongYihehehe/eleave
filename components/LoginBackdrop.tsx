// 出 logo 那一屏的背景:纯 SVG + CSS,不需要图片文件,没有任何动画。
// 设计来源是 logo 本身:蓝色渐变 + 蜂窝纹理 → 浅蓝渐变底 + 淡淡的蜂窝 + 一团柔光。

const BLUE = '#0198DD' // 取自 logo 的亮蓝色

// 背景:浅蓝渐变(往下慢慢变回 App 通用的米白底)+ 淡蜂窝纹理 + 一团柔光
export function LoginBackdrop() {
  const fade = 'linear-gradient(to bottom, #000 0%, rgba(0,0,0,0.55) 38%, transparent 72%)'
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#D3ECFA_0%,#E7F5FC_34%,#F6F4EE_74%)]" />
      <svg className="absolute inset-0 h-full w-full" style={{ WebkitMaskImage: fade, maskImage: fade }}>
        <defs>
          <pattern id="login-hex" width="34.64" height="60" patternUnits="userSpaceOnUse">
            <path d="M17.32 0.00 L34.64 10.00 L34.64 30.00 L17.32 40.00 L0.00 30.00 L0.00 10.00 Z M0.00 30.00 L17.32 40.00 L17.32 60.00 L0.00 70.00 L-17.32 60.00 L-17.32 40.00 Z M34.64 30.00 L51.96 40.00 L51.96 60.00 L34.64 70.00 L17.32 60.00 L17.32 40.00 Z M0.00 -30.00 L17.32 -20.00 L17.32 0.00 L0.00 10.00 L-17.32 0.00 L-17.32 -20.00 Z M34.64 -30.00 L51.96 -20.00 L51.96 0.00 L34.64 10.00 L17.32 0.00 L17.32 -20.00 Z" fill="none" stroke={BLUE} strokeOpacity="0.17" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#login-hex)" />
      </svg>
      <div className="absolute left-1/2 top-[6%] h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(1,152,221,0.22),transparent)]" />
    </div>
  )
}

// Logo:静态,不带任何动画(登录页和"载入中"画面共用,两个画面看起来是同一屏)
export function LogoMark({ alt = 'Puro' }: { alt?: string }) {
  return (
    <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt={alt}
        width={96}
        height={96}
        className="h-24 w-24 drop-shadow-[0_10px_18px_rgba(48,41,134,0.28)]"
      />
    </div>
  )
}
