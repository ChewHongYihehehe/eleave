'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

// ─── Inline SVG icon helper ───────────────────────────────────────────────────

function SvgIcon({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

const IC = {
  approve: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  calendar: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
  people: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  reports: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
  holidays: 'M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z',
  hours: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
  audit: 'M9 12h3.75M9 15h3.75M9 18h3.75M3.75 6.75h16.5a1.5 1.5 0 011.5 1.5v10.5a1.5 1.5 0 01-1.5 1.5H3.75a1.5 1.5 0 01-1.5-1.5V8.25a1.5 1.5 0 011.5-1.5zM3.75 6.75l7.5 5.25a1.5 1.5 0 001.5 0l7.5-5.25',
  menu: 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5',
  x: 'M6 18L18 6M6 6l12 12',
  logout: 'M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75',
  key: 'M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z',
  bell: 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0',
  leaf: 'M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418',
}

const WORKSPACE = [
  { href: '/approve', label: 'Approvals', icon: 'approve' as const },
  { href: '/calendar', label: 'Team Calendar', icon: 'calendar' as const },
]
const MANAGE = [
  { href: '/manage', label: 'Employees', icon: 'people' as const },
  { href: '/reports', label: 'Reports', icon: 'reports' as const },
  { href: '/holidays', label: 'Holidays', icon: 'holidays' as const },
  { href: '/work-hours', label: 'Work Hours', icon: 'hours' as const },
  { href: '/audit-log', label: 'Audit Log', icon: 'audit' as const },
]

// ─── Main component ───────────────────────────────────────────────────────────

export default function ManagerShell({
  children,
  pendingCount,
}: {
  children: React.ReactNode
  pendingCount?: number
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [user, setUser] = useState<{ name: string; initials: string } | null>(null)
  // 需要经理处理的件数(待审批 + 等待确认的取消申请),放在这里统一抓,
  // 这样不管经理现在在哪一页,侧边栏的红点数字都是准的,不是只有在 /approve 才看得到。
  const [attentionCount, setAttentionCount] = useState<number | undefined>(pendingCount)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user: u } }) => {
      if (!u) return
      const { data } = await supabase
        .from('employees')
        .select('full_name')
        .eq('auth_user_id', u.id)
        .maybeSingle()
      if (data) {
        const parts = data.full_name.trim().split(' ')
        const initials = (parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')
        setUser({ name: data.full_name, initials: initials.toUpperCase() })
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

  // ── Sidebar content (reused for desktop + mobile) ──
  const SidebarContent = () => (
    <div
      style={{ width: 256, flexShrink: 0 }}
      className="flex h-full flex-col border-r border-gray-200 bg-white px-4 py-5"
    >
      {/* Brand */}
      <div className="mb-8 flex items-center gap-2.5 px-2">
        <img src="/logo.png" alt="Puro" width={32} height={32} className="h-8 w-8 rounded-lg" />
        <span className="text-base font-bold tracking-tight text-gray-900">eLeave</span>
      </div>

      {/* Workspace section */}
      <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
        Workspace
      </p>
      <nav className="flex flex-col gap-0.5">
        {WORKSPACE.map(({ href, label, icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={[
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                active
                  ? 'bg-pine/10 font-medium text-pine'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900',
              ].join(' ')}
            >
              <SvgIcon d={IC[icon]} size={17} />
              <span className="flex-1">{label}</span>
              {href === '/approve' && !!attentionCount && (
                <span className="rounded-md bg-pine/15 px-2 py-0.5 text-xs font-semibold text-pine">
                  {attentionCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Manage section */}
      <p className="mb-1.5 mt-8 px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
        Manage
      </p>
      <nav className="flex flex-col gap-0.5">
        {MANAGE.map(({ href, label, icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={[
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                active
                  ? 'bg-pine/10 font-medium text-pine'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900',
              ].join(' ')}
            >
              <SvgIcon d={IC[icon]} size={17} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom: account + user */}
      <div className="mt-auto">
        <div className="mb-1 flex flex-col gap-0.5">
          <button
            onClick={() => router.push('/change-password')}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            <SvgIcon d={IC.key} size={17} />
            Change Password
          </button>
          <button
            onClick={() => router.push('/notifications')}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            <SvgIcon d={IC.bell} size={17} />
            Telegram Notifications
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <SvgIcon d={IC.logout} size={17} />
            Log Out
          </button>
        </div>

        {user && (
          <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 mt-1">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pine/20 text-xs font-bold text-pine">
              {user.initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-400">Manager</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop sidebar — always visible */}
      <div className="hidden lg:flex lg:flex-shrink-0 print:hidden">
        <div style={{ width: 256 }} className="flex flex-col">
          <div className="flex h-full flex-col">
            <SidebarContent />
          </div>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="relative flex flex-col" style={{ width: 256 }}>
            <div className="absolute right-0 top-0 -mr-12 pt-2">
              <button
                onClick={() => setMobileOpen(false)}
                className="ml-1 flex h-10 w-10 items-center justify-center rounded-full text-white"
              >
                <SvgIcon d={IC.x} />
              </button>
            </div>
            <SidebarContent />
          </div>
          <div
            className="w-14 flex-shrink-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
        </div>
      )}

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <div className="sticky top-0 z-10 flex h-14 flex-shrink-0 items-center border-b border-gray-200 bg-white px-4 shadow-sm print:hidden">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(true)}
            className="mr-3 text-gray-500 lg:hidden"
          >
            <SvgIcon d={IC.menu} />
          </button>

          <div className="flex flex-1 justify-end">
            {user && (
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-pine/20 text-xs font-bold text-pine">
                  {user.initials}
                </div>
                <span className="hidden text-sm font-medium text-gray-700 md:block">
                  {user.name}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 px-6 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
