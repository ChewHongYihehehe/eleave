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

  const first = auth.employee.full_name.trim().split(/\s+/)[0]

  const stats: { href: string; label: string; count: number | null; hot: boolean; unit: string; icon: keyof typeof IC; grad: string; hint: string }[] = [
    { href: '/approve', label: t('pendingApprovals'), count: attention, hot: (attention ?? 0) > 0, unit: '', icon: 'approve', grad: 'linear-gradient(135deg, #1677FF, #4096FF)', hint: (attention ?? 0) > 0 ? (lang === 'zh' ? '有申请在等你处理' : 'Requests waiting for you') : (lang === 'zh' ? '目前没有待处理的申请' : 'Nothing waiting') },
    { href: '/calendar', label: t('onLeaveToday'), count: onLeaveToday, hot: false, unit: '', icon: 'calendar', grad: 'linear-gradient(135deg, #13C2C2, #36CFC9)', hint: lang === 'zh' ? '查看休假日历' : 'Open the leave calendar' },
  ]

  return (
    <ManagerShell>
      <div className="mx-auto max-w-6xl space-y-4 pb-4">
        {/* 欢迎卡片:蓝色渐变 + 问候 */}
        <section className="overflow-hidden rounded-xl text-white" style={{ background: 'linear-gradient(120deg, #1677FF 0%, #4096FF 100%)' }}>
          <div className="px-7 py-7">
            <div>
              <h1 className="text-2xl font-semibold">{t('hello')}, {first}</h1>
              <p className="mt-1 text-sm text-blue-100">{dateLabel}</p>
            </div>
          </div>
        </section>

        {/* 需要处理 */}
        <section className="rounded-xl border border-line bg-white">
          <h2 className="border-b border-line px-5 py-3.5 text-[15px] font-semibold text-ink">{t('needsAttention')}</h2>
          <div className="grid grid-cols-1 divide-y divide-line sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            {stats.map((r) => (
              <Link key={r.href + r.label} href={r.href} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-paper">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: r.grad }}><SvgIcon d={IC[r.icon]} size={22} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{r.label}</p>
                  <p className="mt-0.5 text-xs text-ink-faint">{r.hint}</p>
                </div>
                <span className={`text-2xl font-semibold tabular-nums ${r.hot ? 'text-pine' : 'text-ink'}`}>{r.count === null ? '–' : r.count}</span>
                <span className="text-ink-faint transition-transform group-hover:translate-x-0.5"><SvgIcon d={IC.chevronR} size={16} /></span>
              </Link>
            ))}
          </div>
        </section>

        {/* 全部功能 */}
        <section className="rounded-xl border border-line bg-white">
          <h2 className="border-b border-line px-5 py-3.5 text-[15px] font-semibold text-ink">{t('allFeatures')}</h2>
          <div className="grid grid-cols-4 gap-y-7 px-4 py-7 sm:grid-cols-7">
            {FEATURES.map((f) => (
              <Link key={f.href} href={f.href} className="group flex flex-col items-center gap-2.5 px-1 text-center">
                <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-xs transition-all group-hover:-translate-y-0.5 group-hover:shadow-md" style={{ background: f.grad }}>
                  <SvgIcon d={IC[f.icon]} size={26} />
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
