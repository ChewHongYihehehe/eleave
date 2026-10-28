'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useLang, type DictKey } from '@/lib/lang'
import HelpDocModal from '@/components/HelpDocModal'

export function SvgIcon({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

export const IC = {
  approve: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  calendar: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
  people: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.75 3.75 0 11-6.75 0 3.75 3.75 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  reports: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
  holidays: 'M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z',
  hours: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
  audit: 'M9 12h3.75M9 15h3.75M9 18h3.75M3.75 6.75h16.5a1.5 1.5 0 011.5 1.5v10.5a1.5 1.5 0 01-1.5 1.5H3.75a1.5 1.5 0 01-1.5-1.5V8.25a1.5 1.5 0 011.5-1.5zM3.75 6.75l7.5 5.25a1.5 1.5 0 001.5 0l7.5-5.25',
  logout: 'M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75',
  key: 'M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z',
  bell: 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0',
  leaf: 'M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418',
  grid: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z',
  user: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
  chevronD: 'M19.5 8.25l-7.5 7.5-7.5-7.5',
  chevronL: 'M15.75 19.5L8.25 12l7.5-7.5',
  chevronR: 'M8.25 4.5l7.5 7.5-7.5 7.5',
}

type IconKey = keyof typeof IC

// ── 电脑版侧边栏 ──
const WORKSPACE: { href: string; key: DictKey; icon: IconKey }[] = [
  { href: '/workspace', key: 'workspace', icon: 'grid' },
  { href: '/approve', key: 'approvals', icon: 'approve' },
  { href: '/calendar', key: 'calendar', icon: 'calendar' },
]
const MANAGE: { href: string; key: DictKey; icon: IconKey }[] = [
  { href: '/manage', key: 'employees', icon: 'people' },
  { href: '/reports', key: 'reports', icon: 'reports' },
  { href: '/holidays', key: 'holidays', icon: 'holidays' },
  { href: '/work-hours', key: 'workHours', icon: 'hours' },
  { href: '/audit-log', key: 'auditLog', icon: 'audit' },
]

// ── 手机版 ──
// 只有这 4 个页面显示底部栏。其他页面一律"全屏":没有底部栏,顶部是 ‹ 返回键 + 标题。
const BOTTOM_TABS: { href: string; key: DictKey; icon: IconKey; showBadge?: boolean }[] = [
  { href: '/workspace', key: 'workspace', icon: 'grid' },
  { href: '/approve', key: 'approvals', icon: 'approve', showBadge: true },
  { href: '/calendar', key: 'calendarTab', icon: 'calendar' },
  { href: '/me', key: 'me', icon: 'user' },
]
const TAB_ROOTS = BOTTOM_TABS.map((t) => t.href)

// 全屏页面顶部显示的标题
const TITLE_KEY: Record<string, DictKey> = {
  '/manage': 'employees',
  '/reports': 'reports',
  '/holidays': 'holidays',
  '/work-hours': 'workHours',
  '/audit-log': 'auditLog',
  '/change-password': 'changePassword',
  '/notifications': 'telegram',
}
// 这些页面是从"我的"点进去的,返回时回到"我的";其他全屏页面返回时回到"工作台"
const PARENT: Record<string, string> = {
  '/change-password': '/me',
  '/notifications': '/me',
}

export default function ManagerShell({
  children,
  pendingCount,
}: {
  children: React.ReactNode
  pendingCount?: number
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { lang, setLang, t } = useLang()
  const [user, setUser] = useState<{ name: string; initials: string } | null>(null)
  const [attentionCount, setAttentionCount] = useState<number | undefined>(pendingCount)
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user: u } }) => {
      if (!u) return
      const { data } = await supabase
        .from('employees')
        .select('full_name')
        .eq('auth_user_id', u.id)
        .maybeSingle()
      if (data && data.full_name) {
        const safe = (data.full_name || '').trim()
        const parts = safe.split(' ')
        const initials = ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase() || 'M'
        setUser({ name: data.full_name, initials })
      }
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    supabase
      .from('leave_applications')
      .select('id', { count: 'exact', head: true })
      .or('status.eq.pending,cancellation_status.eq.requested')
      .then(({ count }) => { if (!cancelled && typeof count === 'number') setAttentionCount(count) })
    return () => { cancelled = true }
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  // ── 手机:是不是"全屏内页" ──
  const isInner = !TAB_ROOTS.includes(pathname)
  const section = Object.keys(TITLE_KEY).find((p) => pathname === p || pathname.startsWith(p + '/'))
  const innerTitle = section ? t(TITLE_KEY[section]) : ''

  function goBack() {
    if (section && pathname !== section) router.push(section) // 子页面 → 回到它的列表页
    else if (PARENT[pathname]) router.push(PARENT[pathname])
    else if (section) router.push('/workspace')
    else router.back()
  }

  // ── 电脑版:右上角用户菜单(点外面自动收起)──
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  // 当前页面是不是这个菜单项(子页面,如 /manage/123,也算)
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const navItem = ({ href, key, icon }: { href: string; key: DictKey; icon: IconKey }) => {
    const active = isActive(href)
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? 'page' : undefined}
        className={[
          'group flex h-10 items-center gap-2.5 rounded-md px-3 text-sm transition-colors',
          active ? 'bg-pine-soft font-medium text-pine' : 'text-ink hover:bg-paper',
        ].join(' ')}
      >
        <span className={active ? 'text-pine' : 'text-ink-soft group-hover:text-ink'}><SvgIcon d={IC[icon]} size={18} /></span>
        <span className="flex-1 truncate">{t(key)}</span>
        {href === '/approve' && !!attentionCount && (
          <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rust px-1.5 text-[11px] font-medium leading-none text-white">
            {attentionCount > 99 ? '99+' : attentionCount}
          </span>
        )}
      </Link>
    )
  }

  return (
    // translate="no":告诉浏览器不要自动翻译这些页面(名字、月份、术语都会被翻错)
    <div translate="no" lang={lang === 'zh' ? 'zh-Hans' : 'en'} className="min-h-screen bg-paper">
      {/* ══ 电脑版顶部栏(钉钉后台:白底、左边产品名、右边语言 / 通知 / 用户)══ */}
      <header className="fixed inset-x-0 top-0 z-40 hidden h-14 items-center justify-between border-b border-line bg-white px-5 print:hidden lg:flex">
        <Link href="/workspace" className="flex items-center gap-2.5">
          <img src="/logo.png" alt="Puro" width={32} height={32} className="h-8 w-8 shrink-0 rounded-lg" />
          <span className="text-base font-semibold tracking-tight text-ink">eLeave</span>
          <span className="rounded bg-pine-soft px-1.5 py-0.5 text-xs font-medium text-pine">{t('manager')}</span>
        </Link>

        <div className="flex items-center gap-1">
          <div className="mr-2 flex rounded-md bg-paper p-0.5 text-xs">
            {(['zh', 'en'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${lang === l ? 'bg-white text-pine shadow-xs' : 'text-ink-soft hover:text-ink'}`}
              >
                {l === 'zh' ? '中文' : 'EN'}
              </button>
            ))}
          </div>
          <button onClick={() => setHelpOpen(true)} title="使用指南 / Help" aria-label="使用指南" className="flex h-9 w-9 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-paper hover:text-ink"><svg width="19" height="19" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></button>
          <Link href="/notifications" title={t('telegram')} aria-label={t('telegram')} className="flex h-9 w-9 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-paper hover:text-ink">
            <SvgIcon d={IC.bell} size={19} />
          </Link>
          <span className="mx-2 h-5 w-px bg-line" />
          {user && (
            <div className="relative" ref={menuRef}>
              <button onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen} className="flex items-center gap-2 rounded-md py-1 pl-1 pr-2 transition-colors hover:bg-paper">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-pine text-xs font-semibold text-white">{user.initials}</span>
                <span className="max-w-[10rem] truncate text-sm font-medium text-ink">{user.name}</span>
                <span className="text-ink-faint"><SvgIcon d={IC.chevronD} size={14} /></span>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full z-50 mt-1.5 w-60 overflow-hidden rounded-lg border border-line bg-white py-1.5 shadow-lg">
                  <div className="flex items-center gap-3 border-b border-line px-4 pb-3 pt-2">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pine text-sm font-semibold text-white">{user.initials}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{user.name}</p>
                      <p className="text-xs text-ink-faint">{t('manager')}</p>
                    </div>
                  </div>
                  <button onClick={() => { setMenuOpen(false); router.push('/change-password') }} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-ink transition-colors hover:bg-paper">
                    <span className="text-ink-soft"><SvgIcon d={IC.key} size={17} /></span>{t('changePassword')}
                  </button>
                  <button onClick={() => { setMenuOpen(false); router.push('/notifications') }} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-ink transition-colors hover:bg-paper">
                    <span className="text-ink-soft"><SvgIcon d={IC.bell} size={17} /></span>{t('telegram')}
                  </button>
                  <div className="my-1 border-t border-line" />
                  <button onClick={handleLogout} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-rust transition-colors hover:bg-rust-soft">
                    <SvgIcon d={IC.logout} size={17} />{t('logout')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>
      <HelpDocModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} defaultRole="manager" />

      <div className="flex min-h-screen lg:pt-14">
        {/* ══ 电脑版左侧菜单(钉钉后台:白底、选中项浅蓝底蓝字)══ */}
        <aside className="hidden w-[216px] shrink-0 print:hidden lg:block">
          <div className="fixed bottom-0 top-14 w-[216px] overflow-y-auto border-r border-line bg-white px-3 py-3">
            <nav className="flex flex-col gap-0.5">{WORKSPACE.map(navItem)}</nav>
            <p className="px-3 pb-1.5 pt-5 text-xs text-ink-faint">{t('allFeatures')}</p>
            <nav className="flex flex-col gap-0.5">{MANAGE.map(navItem)}</nav>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* 手机 · 全屏内页的顶部:‹ 返回 + 标题 */}
          {isInner && (
            <div className="sticky top-0 z-10 grid h-14 flex-shrink-0 grid-cols-[3rem_1fr_3rem] items-center border-b border-gray-200 bg-white lg:hidden print:hidden">
              <button onClick={goBack} aria-label={t('back')} className="flex h-14 w-12 items-center justify-center text-gray-700">
                <SvgIcon d={IC.chevronL} size={24} />
              </button>
              <p className="truncate text-center text-base font-semibold text-gray-900">{innerTitle}</p>
              <span />
            </div>
          )}

          {/* 平板 / 手机顶部栏:只在 4 个底部栏页面显示(电脑版用上面那条顶部栏) */}
          {!isInner && (
            <div className="sticky top-0 z-10 flex h-14 flex-shrink-0 items-center border-b border-gray-200 bg-white px-4 shadow-sm lg:hidden print:hidden">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-pine text-white"><SvgIcon d={IC.leaf} size={14} /></div>
                <span className="text-sm font-bold tracking-tight text-gray-900">eLeave</span>
              </div>
              <div className="flex flex-1 justify-end">
                {user && (
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-pine text-xs font-semibold text-white">{user.initials}</div>
                    <span className="hidden text-sm font-medium text-gray-700 md:block">{user.name}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 全屏内页:顶部已经有标题了,手机上把页面自己的大标题藏起来,避免重复 */}
          <main className={`flex-1 px-4 py-5 md:px-8 md:py-8 lg:px-6 lg:py-6 lg:pb-8 ${isInner ? 'pb-8 max-lg:[&_h1]:hidden' : 'pb-24'}`}>
            {children}
          </main>
        </div>
      </div>

      {/* 手机底部栏:只在 4 个主页面显示 */}
      {!isInner && (
        <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white lg:hidden print:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <div className="flex">
            {BOTTOM_TABS.map(({ href, key, icon, showBadge }) => {
              const active = pathname === href
              return (
                <Link key={href} href={href} className={['relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-medium transition-colors', active ? 'text-pine' : 'text-gray-400'].join(' ')}>
                  {active && <span className="absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-full bg-pine" />}
                  <div className="relative">
                    <SvgIcon d={IC[icon]} size={22} />
                    {showBadge && !!attentionCount && (
                      <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rust px-1 text-[10px] font-bold leading-none text-white">
                        {attentionCount > 99 ? '99+' : attentionCount}
                      </span>
                    )}
                  </div>
                  <span>{t(key)}</span>
                </Link>
              )
            })}
          </div>
        </nav>
      )}
    </div>
  )
}
