'use client'

import MobileWorkspace from '@/components/manager/MobileWorkspace'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { toLocalDateStr } from '@/lib/dateUtils'
import ManagerShell, { IC, SvgIcon } from '@/components/ManagerShell'
import PageHeader from '@/components/PageHeader'
import { useEmployee } from '@/lib/useEmployee'
import AuthStatus from '@/components/AuthStatus'
import { useLang, type DictKey } from '@/lib/lang'

// 工作台(手机版的首页):
//  · 上面:需要处理的事(待审批、今天谁休假),点一下就跳过去
//  · 下面:全部功能的图标格子
// 想增加/删除功能图标,改下面的 FEATURES 就好。

type Feature = { href: string; key: DictKey; icon: keyof typeof IC; grad: string; badge?: 'attention' }

// 图标渐变色和手机版工作台一致
const FEATURES: Feature[] = [
  { href: '/approve', key: 'approvals', icon: 'approve', grad: 'linear-gradient(135deg, #1677FF, #4096FF)', badge: 'attention' },
  { href: '/calendar', key: 'calendar', icon: 'calendar', grad: 'linear-gradient(135deg, #13C2C2, #36CFC9)' },
  { href: '/manage', key: 'employees', icon: 'people', grad: 'linear-gradient(135deg, #FA8C16, #FFA940)' },
  { href: '/reports', key: 'reports', icon: 'reports', grad: 'linear-gradient(135deg, #722ED1, #9254DE)' },
  { href: '/work-hours', key: 'workHours', icon: 'hours', grad: 'linear-gradient(135deg, #EB2F96, #F759AB)' },
  { href: '/holidays', key: 'holidays', icon: 'holidays', grad: 'linear-gradient(135deg, #52C41A, #73D13D)' },
  { href: '/audit-log', key: 'auditLog', icon: 'audit', grad: 'linear-gradient(135deg, #8C8C8C, #BFBFBF)' },
]

function DesktopWorkspace() {
  const auth = useEmployee({ requireManager: true })
  const { lang, t } = useLang()
  const [attention, setAttention] = useState<number | null>(null)
  const [onLeaveToday, setOnLeaveToday] = useState<number | null>(null)
  const [monthLeave, setMonthLeave] = useState<number | null>(null)
  const [staffCount, setStaffCount] = useState<number | null>(null)

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

    // 本月请假:已批准、日期和本月有重叠;历史导入的记录不算
    const now = new Date()
    const monthStart = toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), 1))
    const monthEnd = toLocalDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0))
    supabase
      .from('leave_applications')
      .select('id, remarks')
      .eq('status', 'approved')
      .lte('start_date', monthEnd)
      .gte('end_date', monthStart)
      .then(({ data }) => {
        if (cancelled || !data) return
        setMonthLeave((data as { id: string; remarks: string | null }[]).filter((r) => !(r.remarks && r.remarks.includes('Historical import'))).length)
      })

    // 在职员工:启用中的全职员工
    supabase
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('employment_type', 'full_time')
      .then(({ count }) => { if (!cancelled && typeof count === 'number') setStaffCount(count) })

    return () => { cancelled = true }
  }, [auth.status])

  if (auth.status !== 'ready') return <AuthStatus state={auth} />

  const dateLabel = new Date().toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-MY', {
    month: 'long', day: 'numeric', weekday: 'long',
  })

  const first = auth.employee.full_name.trim().split(/\s+/)[0]

  const pending = (attention ?? 0) > 0
  const stats: { href: string; label: string; count: number | null; hot: boolean; icon: keyof typeof IC; grad: string; hint: string }[] = [
    { href: '/approve', label: t('pendingApprovals'), count: attention, hot: pending, icon: 'approve', grad: 'linear-gradient(135deg, #1677FF, #4096FF)', hint: pending ? t('statHintPending') : t('statHintNone') },
    { href: '/calendar', label: t('onLeaveToday'), count: onLeaveToday, hot: false, icon: 'calendar', grad: 'linear-gradient(135deg, #13C2C2, #36CFC9)', hint: t('statHintCalendar') },
    { href: '/reports', label: t('statMonthLeave'), count: monthLeave, hot: false, icon: 'reports', grad: 'linear-gradient(135deg, #722ED1, #9254DE)', hint: t('statHintMonth') },
    { href: '/manage', label: t('statStaff'), count: staffCount, hot: false, icon: 'people', grad: 'linear-gradient(135deg, #FA8C16, #FFA940)', hint: t('statHintStaff') },
  ]

  return (
    <ManagerShell>
      <div className="mx-auto max-w-[1360px] space-y-4 pb-6">
        <PageHeader title={`${t('hello')}, ${first}`} subtitle={dateLabel} />

        {/* 数据概览:4 张可点击的卡片 */}
        <section className="grid grid-cols-4 gap-4">
          {stats.map((r) => (
            <Link
              key={r.href + r.label}
              href={r.href}
              className="group flex items-start justify-between rounded-lg border border-line bg-white p-5 transition-colors hover:border-pine/50"
            >
              <div className="min-w-0">
                <p className="text-[13px] text-ink-soft">{r.label}</p>
                <p className={`mt-2 text-[32px] font-semibold leading-none tabular-nums ${r.hot ? 'text-pine' : 'text-ink'}`}>
                  {r.count === null ? '–' : r.count}
                </p>
                <p className="mt-3 truncate text-xs text-ink-faint group-hover:text-pine">{r.hint}</p>
              </div>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: r.grad }}>
                <SvgIcon d={IC[r.icon]} size={20} />
              </span>
            </Link>
          ))}
        </section>

        {/* 快捷入口 */}
        <section className="rounded-lg border border-line bg-white">
          <h2 className="border-b border-line px-5 py-3.5 text-[15px] font-semibold text-ink">{t('quickEntry')}</h2>
          <div className="grid grid-cols-7 gap-y-6 px-4 py-6">
            {FEATURES.map((f) => (
              <Link key={f.href} href={f.href} className="group flex flex-col items-center gap-2.5 px-1 text-center">
                <span className="relative flex h-12 w-12 items-center justify-center rounded-xl text-white transition-transform group-hover:-translate-y-0.5" style={{ background: f.grad }}>
                  <SvgIcon d={IC[f.icon]} size={24} />
                  {f.badge === 'attention' && !!attention && (
                    <span className="absolute -right-2 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rust px-1 text-[11px] font-medium leading-none text-white ring-2 ring-white">
                      {attention > 99 ? '99+' : attention}
                    </span>
                  )}
                </span>
                <span className="text-[13px] leading-tight text-ink transition-colors group-hover:text-pine">{t(f.key)}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </ManagerShell>
  )
}

// 手机/平板(< lg)用手机版;电脑(≥ lg)用后台版。断点和 ManagerShell 一致。
export default function WorkspacePage() {
  return (
    <>
      <div className="lg:hidden">
        <MobileWorkspace />
      </div>
      <div className="hidden lg:block">
        <DesktopWorkspace />
      </div>
    </>
  )
}
