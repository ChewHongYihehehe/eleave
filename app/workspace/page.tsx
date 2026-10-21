'use client'

import MobileWorkspace from '@/components/manager/MobileWorkspace'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { toLocalDateStr } from '@/lib/dateUtils'
import ManagerShell, { IC, SvgIcon } from '@/components/ManagerShell'
import { useEmployee } from '@/lib/useEmployee'
import AuthStatus from '@/components/AuthStatus'
import { useLang, type DictKey } from '@/lib/lang'

// 工作台(手机版的首页):
//  · 上面:需要处理的事(待审批、今天谁休假),点一下就跳过去
//  · 下面:全部功能的图标格子
// 想增加/删除功能图标,改下面的 FEATURES 就好。

type Feature = { href: string; key: DictKey; icon: keyof typeof IC; tone: string; badge?: 'attention' }

const FEATURES: Feature[] = [
  { href: '/approve', key: 'approvals', icon: 'approve', tone: 'bg-rust-soft text-rust', badge: 'attention' },
  { href: '/calendar', key: 'calendar', icon: 'calendar', tone: 'bg-pine-soft text-pine-deep' },
  { href: '/manage', key: 'employees', icon: 'people', tone: 'bg-leave-annual/15 text-leave-annual' },
  { href: '/reports', key: 'reports', icon: 'reports', tone: 'bg-leave-maternity/15 text-leave-maternity' },
  { href: '/work-hours', key: 'workHours', icon: 'hours', tone: 'bg-gold-soft text-amber-700' },
  { href: '/holidays', key: 'holidays', icon: 'holidays', tone: 'bg-gold-soft text-amber-700' },
  { href: '/audit-log', key: 'auditLog', icon: 'audit', tone: 'bg-gray-100 text-gray-500' },
]

function DesktopWorkspace() {
  const auth = useEmployee({ requireManager: true })
  const { lang, t } = useLang()
  const [attention, setAttention] = useState<number | null>(null)
  const [onLeaveToday, setOnLeaveToday] = useState<number | null>(null)

  useEffect(() => {
    if (auth.status !== 'ready') return
    let cancelled = false

    // 待审批 + 等待决定的取消申请(和审批页、底部栏的数字一致)
    supabase
      .from('leave_applications')
      .select('id', { count: 'exact', head: true })
      .or('status.eq.pending,cancellation_status.eq.requested')
      .then(({ count }) => { if (!cancelled && typeof count === 'number') setAttention(count) })

    // 今天谁休假:已批准、日期包含今天;历史导入的记录不算;同一个人只算一次
    const today = toLocalDateStr(new Date())
    supabase
      .from('leave_applications')
      .select('employee_id, remarks')
      .eq('status', 'approved')
      .lte('start_date', today)
      .gte('end_date', today)
      .then(({ data }) => {
        if (cancelled || !data) return
        const ids = new Set<string>()
        for (const r of data as { employee_id: string; remarks: string | null }[]) {
          if (r.remarks && r.remarks.includes('Historical import')) continue
          ids.add(r.employee_id)
        }
        setOnLeaveToday(ids.size)
      })

    return () => { cancelled = true }
  }, [auth.status])

  if (auth.status !== 'ready') return <AuthStatus state={auth} />

  const dateLabel = new Date().toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-MY', {
    month: 'long', day: 'numeric', weekday: 'long',
  })

  const rows: { href: string; label: string; count: number | null; hot: boolean; unit: string; icon: keyof typeof IC; iconTone: string }[] = [
    { href: '/approve', label: t('pendingApprovals'), count: attention, hot: (attention ?? 0) > 0, unit: '', icon: 'approve', iconTone: 'bg-rust-soft text-rust' },
    { href: '/calendar', label: t('onLeaveToday'), count: onLeaveToday, hot: false, unit: ` ${t('staffUnit')}`, icon: 'calendar', iconTone: 'bg-pine-soft text-pine-deep' },
  ]

  return (
    <ManagerShell>
      <div className="space-y-6 pb-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">{t('workspace')}</h1>
          <p className="mt-0.5 text-sm text-ink-soft">{dateLabel}</p>
        </div>

        {/* 需要处理 */}
        <section>
          <h2 className="mb-2 text-sm font-medium text-ink-soft">{t('needsAttention')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {rows.map((r) => (
              <Link
                key={r.href + r.label}
                href={r.href}
                className="flex items-center justify-between gap-3 p-4 rounded-xl border border-line bg-surface hover:border-gray-300 transition-all shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${r.iconTone}`}>
                    <SvgIcon d={IC[r.icon]} size={22} />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-ink">{r.label}</p>
                    <p className="text-xs text-ink-faint">
                      {r.hot ? (lang === 'zh' ? '需要尽快处理' : 'Action needed') : (lang === 'zh' ? '点击查看详情' : 'Click to view')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-2xl font-bold tabular-nums ${r.hot ? 'text-rust' : 'text-ink'}`}>
                    {r.count === null ? '–' : `${r.count}${r.unit}`}
                  </span>
                  <span className="text-ink-faint"><SvgIcon d={IC.chevronR} size={16} /></span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* 全部功能 */}
        <section>
          <h2 className="mb-3 text-sm font-medium text-ink-soft">{t('allFeatures')}</h2>
          <div className="rounded-2xl border border-line bg-surface p-6 shadow-xs">
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-y-6 gap-x-2">
              {FEATURES.map((f) => (
                <Link
                  key={f.href}
                  href={f.href}
                  className="flex flex-col items-center gap-2.5 px-1 text-center group transition-transform active:scale-95"
                >
                  <span className={`relative flex h-13 w-13 items-center justify-center rounded-2xl shadow-xs transition-shadow group-hover:shadow-md ${f.tone}`}>
                    <SvgIcon d={IC[f.icon]} size={24} />
                    {f.badge === 'attention' && !!attention && (
                      <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rust px-1 text-[11px] font-semibold leading-none text-white shadow-xs">
                        {attention > 99 ? '99+' : attention}
                      </span>
                    )}
                  </span>
                  <span className="text-xs font-medium leading-tight text-ink group-hover:text-brand transition-colors">{t(f.key)}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </ManagerShell>
  )
}

// 手机(< md)用钉钉风格的新版页面;电脑(≥ md)保持原来的版面。
export default function WorkspacePage() {
  return (
    <>
      <div className="md:hidden">
        <MobileWorkspace />
      </div>
      <div className="hidden md:block">
        <DesktopWorkspace />
      </div>
    </>
  )
}
