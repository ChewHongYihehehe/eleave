import type { ReactNode } from 'react'

// 电脑版统一页头(钉钉后台:左边标题 + 副标题,右边放主操作按钮)。
// 所有电脑版页面都用这一个,标题大小、间距才会一致。
// 注意:ManagerShell 在手机上会把页面里的 <h1> 藏起来(手机顶部已经有标题),所以这里保持 <h1>。
export default function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold leading-7 text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13px] text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

// 主操作按钮(蓝底白字,32px 高,钉钉后台的标准按钮尺寸)
export function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-8 items-center gap-1.5 rounded-md bg-pine px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-pine-deep disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  )
}

// 次要按钮(白底灰边)
export function DefaultButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-white px-3.5 text-[13px] text-ink transition-colors hover:border-pine hover:text-pine disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  )
}
