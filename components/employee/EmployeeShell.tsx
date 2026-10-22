'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLang, type Lang } from '@/lib/lang'
import { toLocalDateStr } from '@/lib/dateUtils'

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
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6L6 18',
  minus: 'M6 12h12',
  alert: 'M12 9v4m0 4h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
}

export function Icon({ d, size = 22, className, filled }: { d: string; size?: number; className?: string; filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} fillOpacity={filled ? 0.16 : undefined} stroke="currentColor" strokeWidth={filled ? 2 : 1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
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
const safeTop = 'env(safe-area-inset-top, 0px)'

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
              <Link key={x.key} href={x.href} replace={!active} className={`flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px] ${active ? 'font-semibold text-brand' : 'text-gray-500'}`}>
                <span className="relative">
                  <Icon d={x.icon} size={24} filled={active} />
                  {x.key === 'records' && !!badge && (
                    <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-st-rejected px-1 text-[10px] font-bold leading-none text-white">
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
  title, backHref, footer, right, children,
}: { title: string; backHref?: string; footer?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode }) {
  const router = useRouter()
  const { lang, t } = useLang()
  return (
    <div translate="no" lang={lang === 'zh' ? 'zh-Hans' : 'en'} className="min-h-[100dvh] bg-app">
      <div className="mx-auto max-w-md">
        <header className="sticky top-0 z-20 border-b border-gray-200 bg-white" style={{ paddingTop: safeTop }}>
          <div className="grid h-12 grid-cols-[4rem_1fr_4rem] items-center">
            <button
              onClick={() => (backHref ? router.push(backHref) : router.back())}
              aria-label={t('back')}
              className="flex h-12 w-12 items-center justify-center text-gray-800"
            >
              <Icon d={EI.chevronL} size={24} />
            </button>
            <h1 className="truncate text-center text-[17px] font-semibold text-gray-900">{title}</h1>
            <div className="flex justify-end pr-4">{right}</div>
          </div>
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

// ── 通用底部面板:带遮罩淡入 + 面板滑入 + 顶部拖拽条,所有底部抽屉都用它 ──
export function BottomSheet({
  onClose, children, className = '', pb = '1rem',
}: { onClose: () => void; children: React.ReactNode; className?: string; pb?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex animate-fade items-end bg-black/45 motion-reduce:animate-none" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={`mx-auto w-full max-w-md animate-sheet-up rounded-t-2xl bg-white motion-reduce:animate-none ${className}`}
        style={{ paddingBottom: `calc(${pb} + ${safeBottom})` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-gray-200" />
        {children}
      </div>
    </div>
  )
}

// ── 底部确认面板(取代手机上很突兀的 window.confirm)──
// message 建议写清楚"谁 / 什么 / 几天",让确认有内容。
export function ConfirmSheet({
  open, title, message, confirmLabel, danger, busy, onConfirm, onClose,
}: {
  open: boolean; title: string; message?: string; confirmLabel: string; danger?: boolean; busy?: boolean
  onConfirm: () => void; onClose: () => void
}) {
  const { t } = useLang()
  if (!open) return null
  return (
    <BottomSheet onClose={() => !busy && onClose()}>
      <div className="px-4 pt-3">
        <p className="text-center text-base font-semibold text-gray-900">{title}</p>
        {message && <p className="mt-2 text-center text-sm text-gray-600">{message}</p>}
        <button
          onClick={onConfirm}
          disabled={busy}
          className={`mt-5 w-full rounded-xl py-3 text-base font-semibold text-white disabled:opacity-50 ${danger ? 'bg-st-rejected-text' : 'bg-brand'}`}
        >
          {confirmLabel}
        </button>
        <button onClick={onClose} disabled={busy} className="mt-2 w-full rounded-xl bg-gray-100 py-3 text-base text-gray-700 disabled:opacity-50">{t('cancel')}</button>
      </div>
    </BottomSheet>
  )
}

// 白色卡片 + 行(钉钉的列表样式)
export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-4 overflow-hidden rounded-xl bg-white ${className}`}>{children}</div>
}

// ── 加载骨架:代替一行"加载中…" ──(bare = 不带外层白卡片,放在已有 Card 里用)
export function ListSkeleton({ rows = 4, bare = false }: { rows?: number; bare?: boolean }) {
  const body = Array.from({ length: rows }, (_, i) => (
    <div key={i} className={`flex animate-pulse items-center gap-3 px-4 py-3.5 motion-reduce:animate-none ${i ? 'border-t border-gray-100' : ''}`}>
      <span className="h-10 w-10 shrink-0 rounded-full bg-gray-100" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-1/3 rounded bg-gray-100" />
        <div className="h-3 w-3/4 rounded bg-gray-100" />
      </div>
    </div>
  ))
  return bare ? <div aria-busy="true">{body}</div> : <div aria-busy="true" className="mx-4 mt-2 overflow-hidden rounded-xl bg-white">{body}</div>
}

// ── 空状态 / 错误状态:图标 + 一句话 + 可选的下一步 ──
export function EmptyState({
  icon, title, hint, tone = 'brand', children,
}: { icon: string; title: string; hint?: string; tone?: 'brand' | 'warn'; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-8 py-16 text-center">
      <span className={`flex h-16 w-16 items-center justify-center rounded-full ${tone === 'warn' ? 'bg-st-pending-soft text-st-pending-text' : 'bg-brand-soft text-brand'}`}>
        <Icon d={icon} size={28} />
      </span>
      <p className="mt-4 text-[15px] font-medium text-gray-900">{title}</p>
      {hint && <p className="mt-1 text-sm text-gray-500">{hint}</p>}
      {children}
    </div>
  )
}

// ───────────────────────── 钉钉风格的公共部件 ─────────────────────────

// ── 头像:按名字取固定颜色(负责人端 / 员工端共用)──
const AVATAR_PALETTE = ['#1677FF', '#13C2C2', '#FA8C16', '#722ED1', '#EB2F96', '#52C41A', '#2F54EB', '#FA541C']
export function Avatar({ name, size = 40 }: { name?: string | null; size?: number }) {
  const safe = (name || '').trim()
  const parts = safe ? safe.split(/\s+/) : []
  let initials = '?'
  if (parts.length === 1 && parts[0]) {
    initials = parts[0].slice(0, 2).toUpperCase()
  } else if (parts.length > 1) {
    initials = ((parts[0][0] || '') + (parts[parts.length - 1][0] || '')).toUpperCase() || '?'
  }
  let h = 0
  for (let i = 0; i < safe.length; i++) h = (h * 31 + safe.charCodeAt(i)) >>> 0
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white" style={{ width: size, height: size, background: AVATAR_PALETTE[h % AVATAR_PALETTE.length], fontSize: Math.max(10, Math.round(size * 0.36)) }}>
      {initials}
    </span>
  )
}

// ── 主页面顶部导航栏(钉钉:白底、标题居中、左右各一个文字/图标按钮)。children 放在标题下面,和导航栏一起吸顶(下划线标签页放这里)──
export function TabHeader({ title, left, right, children }: { title: string; left?: React.ReactNode; right?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-20 bg-white" style={{ paddingTop: safeTop }}>
      <div className="grid h-12 grid-cols-[1fr_auto_1fr] items-center gap-2 px-3">
        <div className="flex justify-start">{left}</div>
        <h1 className="max-w-[56vw] truncate text-center text-[17px] font-semibold text-gray-900">{title}</h1>
        <div className="flex justify-end">{right}</div>
      </div>
      {children}
      <div className="h-px bg-gray-200" />
    </header>
  )
}

// 导航栏上的文字按钮
export function NavButton({ onClick, href, children, strong, disabled }: { onClick?: () => void; href?: string; children: React.ReactNode; strong?: boolean; disabled?: boolean }) {
  const cls = `flex h-9 items-center gap-0.5 whitespace-nowrap rounded-md px-1.5 text-[15px] active:opacity-60 disabled:opacity-40 ${strong ? 'font-medium text-brand' : 'text-gray-700'}`
  if (href) return <Link href={href} className={cls}>{children}</Link>
  return <button onClick={onClick} disabled={disabled} className={cls}>{children}</button>
}

// ── 下划线标签页(钉钉审批 / 消息顶部那种:选中蓝字 + 底部短蓝条)──
export function UnderlineTabs<T extends string>({
  items, value, onChange, scroll,
}: { items: { key: T; label: string; count?: number }[]; value: T; onChange: (k: T) => void; scroll?: boolean }) {
  return (
    <div role="tablist" className={`flex bg-white ${scroll ? 'no-scrollbar overflow-x-auto' : ''}`}>
      {items.map((i) => {
        const on = i.key === value
        return (
          <button
            key={i.key} role="tab" aria-selected={on} onClick={() => onChange(i.key)}
            className={`relative flex h-11 items-center justify-center gap-1 whitespace-nowrap px-4 text-[15px] ${scroll ? 'shrink-0' : 'flex-1'} ${on ? 'font-semibold text-brand' : 'text-gray-600'}`}
          >
            {i.label}
            {!!i.count && <span className={`text-[13px] ${on ? 'text-brand' : 'text-gray-400'}`}>{i.count > 99 ? '99+' : i.count}</span>}
            {on && <span className="absolute bottom-0 left-1/2 h-[3px] w-6 -translate-x-1/2 rounded-full bg-brand" />}
          </button>
        )
      })}
    </div>
  )
}

// ── 蓝色渐变头部(钉钉工作台 / 我的 的顶部)。下面的白卡片用 -mt-10 盖上来 ──
export function Hero({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`px-4 pb-14 text-white ${className}`} style={{ background: 'linear-gradient(180deg, #1677FF 0%, #3D90FF 100%)', paddingTop: `calc(1.25rem + ${safeTop})` }}>
      {children}
    </div>
  )
}

// ── 审批结果印章(钉钉审批详情右上角那个斜着的章)──
export function Stamp({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="pointer-events-none inline-block -rotate-12 select-none rounded-md px-2.5 py-1 text-[17px] font-bold leading-none tracking-wider"
      style={{ color, boxShadow: `inset 0 0 0 2px ${color}, inset 0 0 0 4px #fff, inset 0 0 0 5px ${color}`, opacity: 0.88 }}
    >
      {label}
    </span>
  )
}

// ── 审批流:头像 + 右下角状态角标 + 竖线(钉钉审批详情的样式)──
// generic = 这一步的人没有具体名字(比如"负责人"),头像用通用人形图标
export type FlowStep = { title: string; name?: string; generic?: boolean; time?: string | null; sub?: string | null; tone: 'done' | 'active' | 'bad' | 'muted' }
const FLOW = {
  done: { bg: '#52C41A', text: '#237804', icon: EI.check },
  active: { bg: '#FA8C16', text: '#AD4E00', icon: EI.clock },
  bad: { bg: '#F5222D', text: '#CF1322', icon: EI.x },
  muted: { bg: '#BFBFBF', text: '#595959', icon: EI.minus },
}
export function FlowTimeline({ steps }: { steps: FlowStep[] }) {
  return (
    <div>
      {steps.map((s, i) => {
        const f = FLOW[s.tone]
        const last = i === steps.length - 1
        return (
          <div key={i} className={`relative flex gap-3 ${last ? '' : 'pb-5'}`}>
            {!last && <span className="absolute bottom-0 left-[17px] top-10 w-px bg-gray-200" />}
            <span className="relative h-9 w-9 shrink-0">
              {s.name && !s.generic
                ? <Avatar name={s.name} size={36} />
                : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-brand"><Icon d={EI.user} size={18} /></span>}
              <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-white ring-2 ring-white" style={{ background: f.bg }}>
                <Icon d={f.icon} size={10} />
              </span>
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-[15px] font-medium text-gray-900">{s.name ?? s.title}</p>
                {s.time && <span className="shrink-0 text-xs text-gray-500">{s.time}</span>}
              </div>
              {s.name && <p className="mt-0.5 text-[13px]" style={{ color: f.text }}>{s.title}</p>}
              {s.sub && <p className="mt-1.5 rounded-lg bg-gray-50 px-3 py-2 text-sm leading-snug text-gray-600">{s.sub}</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── 带彩色图标方块的设置行(钉钉「我的」页的行)──
export function MenuRow({ icon, tint, label, value, onClick, danger }: { icon: string; tint: string; label: string; value?: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-gray-50">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: tint }}><Icon d={icon} size={18} /></span>
      <span className={`flex-1 text-[15px] ${danger ? 'text-st-rejected-text' : 'text-gray-900'}`}>{label}</span>
      {value && <span className="text-sm text-gray-400">{value}</span>}
      <Icon d={EI.chevronR} size={16} className="text-gray-300" />
    </button>
  )
}

// ── 审批卡片里的「标签 + 值」行 ──
export function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-[14px] leading-6">
      <span className="w-[4.5rem] shrink-0 text-gray-500">{k}</span>
      <span className="min-w-0 flex-1 text-gray-900">{v}</span>
    </div>
  )
}

// ── 单选底部面板(选假种 / 选员工等)──
export function PickerSheet({
  open, title, options, value, onPick, onClose,
}: { open: boolean; title: string; options: { value: string; label: string }[]; value: string; onPick: (v: string) => void; onClose: () => void }) {
  if (!open) return null
  return (
    <BottomSheet onClose={onClose} className="flex max-h-[70dvh] flex-col" pb="0px">
      <p className="border-b border-gray-100 py-3.5 text-center text-base font-semibold text-gray-900">{title}</p>
      <div className="overflow-y-auto">
        {options.map((o) => (
          <button key={o.value} onClick={() => { onPick(o.value); onClose() }} className="flex w-full items-center justify-between border-b border-gray-50 px-5 py-3.5 text-left text-[15px] text-gray-900 active:bg-gray-50">
            <span className={o.value === value ? 'font-semibold text-brand' : ''}>{o.label}</span>
            {o.value === value && <Icon d="M5 12.5l4.5 4.5L19 7.5" size={18} className="text-brand" />}
          </button>
        ))}
      </div>
    </BottomSheet>
  )
}

// ── 日期选择底部面板(钉钉式月历):点一天就选中并关闭;min 之前的日子灰掉不能点 ──
function DateSheetBody({ title, value, min, lang, onPick, onClose }: { title: string; value: string; min?: string; lang: Lang; onPick: (v: string) => void; onClose: () => void }) {
  const base = value || min || toLocalDateStr(new Date())
  const [cur, setCur] = useState(() => new Date(Number(base.slice(0, 4)), Number(base.slice(5, 7)) - 1, 1))
  const y = cur.getFullYear(), m = cur.getMonth()
  const todayKey = toLocalDateStr(new Date())
  const cells: (number | null)[] = Array(new Date(y, m, 1).getDay()).fill(null)
  for (let d = 1; d <= new Date(y, m + 1, 0).getDate(); d++) cells.push(d)
  const weekdays = lang === 'zh' ? ['日', '一', '二', '三', '四', '五', '六'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  const heading = lang === 'zh' ? `${y}年${m + 1}月` : cur.toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })
  // 不让翻到 min 所在月份之前
  const canPrev = !min || new Date(y, m, 0) >= new Date(Number(min.slice(0, 4)), Number(min.slice(5, 7)) - 1, 1)
  return (
    <BottomSheet onClose={onClose}>
      <p className="pb-1 pt-3 text-center text-base font-semibold text-gray-900">{title}</p>
      <div className="flex items-center justify-between px-3 py-1">
        <button onClick={() => setCur(new Date(y, m - 1, 1))} disabled={!canPrev} aria-label="prev" className="flex h-10 w-10 items-center justify-center text-gray-700 disabled:opacity-25"><Icon d={EI.chevronL} size={20} /></button>
        <span className="text-[15px] font-medium text-gray-900">{heading}</span>
        <button onClick={() => setCur(new Date(y, m + 1, 1))} aria-label="next" className="flex h-10 w-10 items-center justify-center text-gray-700"><Icon d={EI.chevronR} size={20} /></button>
      </div>
      <div className="grid grid-cols-7 px-3 text-center text-xs text-gray-500">
        {weekdays.map((d, i) => <div key={i} className="py-1.5">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1 px-3 pb-2">
        {cells.map((day, i) => {
          if (day === null) return <div key={i} className="h-11" />
          const key = toLocalDateStr(new Date(y, m, day))
          const disabled = !!min && key < min
          const sel = key === value
          return (
            <button
              key={i} disabled={disabled} onClick={() => { onPick(key); onClose() }}
              className="flex h-11 items-center justify-center"
            >
              <span className={`flex h-9 w-9 items-center justify-center rounded-full text-[15px] ${sel ? 'bg-brand font-semibold text-white' : disabled ? 'text-gray-300' : key === todayKey ? 'font-bold text-brand' : 'text-gray-900'}`}>{day}</span>
            </button>
          )
        })}
      </div>
    </BottomSheet>
  )
}

export function DatePickerSheet({ open, ...rest }: { open: boolean; title: string; value: string; min?: string; lang: Lang; onPick: (v: string) => void; onClose: () => void }) {
  if (!open) return null
  return <DateSheetBody {...rest} />
}
