'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLang } from '@/lib/lang'

// 员工端手机版的外壳(和负责人端的 ManagerShell 同一个思路):
//  · TabPage:三个主页面(工作台 / 记录 / 我的),有底部栏
//  · SubPage:全屏内页,顶部 ‹ 返回 + 标题,没有底部栏,底部可放固定按钮
// 颜色用 tailwind.config.ts 里的 brand / app token,不要在页面里写死色值。

export const EI = {
  home: 'M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5zM9 21v-9h6v9',
  records: 'M6 3h12a1 1 0 011 1v16a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1zM9 8h6M9 12h6M9 16h4',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 20c0-4 3.6-7 8-7s8 3 8 7',
  plus: 'M12 5v14M5 12h14',
  chevronR: 'M9 5l7 7-7 7',
  chevronL: 'M15 5l-7 7 7 7',
  clock: 'M12 6v6l4 2m5-2a9 9 0 11-18 0 9 9 0 0118 0z',
  bell: 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0',
  key: 'M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z',
  logout: 'M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75',
  clip: 'M18.5 11.5l-6.4 6.4a4 4 0 01-5.7-5.7l7-7a2.7 2.7 0 013.8 3.8l-7 7a1.3 1.3 0 01-1.9-1.9l6.4-6.4',
}

export function Icon({ d, size = 22, className }: { d: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={d} />
    </svg>
  )
}

const TABS = [
  { key: 'home', href: '/dashboard', label: 'workspace', icon: EI.home },
  { key: 'records', href: '/dashboard/records', label: 'records', icon: EI.records },
  { key: 'me', href: '/dashboard/me', label: 'me', icon: EI.user },
] as const

export type TabKey = (typeof TABS)[number]['key']

const safeBottom = 'env(safe-area-inset-bottom, 0px)'

export function TabPage({ tab, badge, children }: { tab: TabKey; badge?: number; children: React.ReactNode }) {
  const { lang, t } = useLang()
  return (
    <div translate="no" lang={lang === 'zh' ? 'zh-Hans' : 'en'} className="min-h-[100dvh] bg-app">
      <div className="mx-auto max-w-md" style={{ paddingBottom: `calc(4.25rem + ${safeBottom})` }}>
        {children}
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white" style={{ paddingBottom: safeBottom }}>
        <div className="mx-auto flex max-w-md">
          {TABS.map((x) => {
            const active = x.key === tab
            return (
              <Link key={x.key} href={x.href} replace={!active} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${active ? 'font-semibold text-brand' : 'text-gray-400'}`}>
                <span className="relative">
                  <Icon d={x.icon} size={24} />
                  {x.key === 'records' && !!badge && (
                    <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#F5222D] px-1 text-[10px] font-bold leading-none text-white">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </span>
                {t(x.label)}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

export function SubPage({
  title, backHref, footer, children,
}: { title: string; backHref?: string; footer?: React.ReactNode; children: React.ReactNode }) {
  const router = useRouter()
  const { lang, t } = useLang()
  return (
    <div translate="no" lang={lang === 'zh' ? 'zh-Hans' : 'en'} className="min-h-[100dvh] bg-app">
      <div className="mx-auto max-w-md">
        <header className="sticky top-0 z-20 grid h-12 grid-cols-[3rem_1fr_3rem] items-center border-b border-gray-200 bg-white">
          <button
            onClick={() => (backHref ? router.push(backHref) : router.back())}
            aria-label={t('back')}
            className="flex h-12 w-12 items-center justify-center text-gray-800"
          >
            <Icon d={EI.chevronL} size={24} />
          </button>
          <h1 className="truncate text-center text-base font-semibold text-gray-900">{title}</h1>
          <span />
        </header>
        <div style={{ paddingBottom: footer ? `calc(5rem + ${safeBottom})` : `calc(1.5rem + ${safeBottom})` }}>{children}</div>
      </div>
      {footer && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white px-4 pt-3" style={{ paddingBottom: `calc(0.75rem + ${safeBottom})` }}>
          <div className="mx-auto max-w-md">{footer}</div>
        </div>
      )}
    </div>
  )
}

// ── Toast ──
export function useToast() {
  const [msg, setMsg] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const show = useCallback((m: string) => {
    setMsg(m)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setMsg(''), 3000)
  }, [])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  const node = msg ? (
    <div className="pointer-events-none fixed inset-x-0 top-1/2 z-50 flex justify-center px-8">
      <p className="rounded-xl bg-black/80 px-4 py-3 text-center text-sm text-white">{msg}</p>
    </div>
  ) : null
  return { show, node }
}

// ── 底部确认面板(取代手机上很突兀的 window.confirm)──
export function ConfirmSheet({
  open, title, message, confirmLabel, danger, busy, onConfirm, onClose,
}: {
  open: boolean; title: string; message?: string; confirmLabel: string; danger?: boolean; busy?: boolean
  onConfirm: () => void; onClose: () => void
}) {
  const { t } = useLang()
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/45" onClick={onClose}>
      <div className="mx-auto w-full max-w-md rounded-t-2xl bg-white px-4 pt-5" style={{ paddingBottom: `calc(1rem + ${safeBottom})` }} onClick={(e) => e.stopPropagation()}>
        <p className="text-center text-base font-semibold text-gray-900">{title}</p>
        {message && <p className="mt-2 text-center text-sm text-gray-500">{message}</p>}
        <button
          onClick={onConfirm}
          disabled={busy}
          className={`mt-5 w-full rounded-xl py-3 text-base font-semibold text-white disabled:opacity-50 ${danger ? 'bg-[#F5222D]' : 'bg-brand'}`}
        >
          {confirmLabel}
        </button>
        <button onClick={onClose} className="mt-2 w-full rounded-xl bg-gray-100 py-3 text-base text-gray-700">{t('cancel')}</button>
      </div>
    </div>
  )
}

// 白色卡片 + 行(钉钉的列表样式)
export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-4 overflow-hidden rounded-xl bg-white ${className}`}>{children}</div>
}
