'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AuthStatus from '@/components/AuthStatus'
import { IC } from '@/components/ManagerShell'
import { Avatar, Card, EI, Hero, Icon } from '@/components/employee/EmployeeShell'
import { supabase } from '@/lib/supabaseClient'
import { toLocalDateStr } from '@/lib/dateUtils'
import { TYPE_COLOR, fmtNum } from '@/lib/useLeaveData'
import { fmtRange } from '@/lib/employeeFmt'
import { leaveName, useMgrT } from '@/lib/mgrText'
import { useApprovals } from '@/lib/useApprovals'
import { ManagerTabPage } from './ManagerTabs'

// 负责人 · 工作台(钉钉工作台):
//  · 信息卡(待审批 + 今天休假，搭配精致半透毛玻璃图标)
//  · 待办事项前几条
//  · 全部功能(带卡片背景的常用应用模块)

const FEATURES: { href: string; key: 'approvals' | 'calendar' | 'employees' | 'reports' | 'workHours' | 'holidays' | 'auditLog'; icon: string; grad: string }[] = [
  { href: '/approve', key: 'approvals', icon: IC.approve, grad: 'linear-gradient(135deg, #1677FF, #4096FF)' },
  { href: '/calendar', key: 'calendar', icon: IC.calendar, grad: 'linear-gradient(135deg, #13C2C2, #36CFC9)' },
  { href: '/manage', key: 'employees', icon: IC.people, grad: 'linear-gradient(135deg, #FA8C16, #FFA940)' },
  { href: '/reports', key: 'reports', icon: IC.reports, grad: 'linear-gradient(135deg, #722ED1, #9254DE)' },
  { href: '/work-hours', key: 'workHours', icon: IC.hours, grad: 'linear-gradient(135deg, #EB2F96, #F759AB)' },
  { href: '/holidays', key: 'holidays', icon: IC.holidays, grad: 'linear-gradient(135deg, #52C41A, #73D13D)' },
  { href: '/audit-log', key: 'auditLog', icon: IC.audit, grad: 'linear-gradient(135deg, #8C8C8C, #BFBFBF)' },
]

export default function MobileWorkspace() {
  const { auth, me, attention, loading } = useApprovals()
  const { t, lang } = useMgrT()
  const [onLeave, setOnLeave] = useState<number | null>(null)

  useEffect(() => {
    if (auth.status !== 'ready') return
    const today = toLocalDateStr(new Date())
    supabase
      .from('leave_applications')
      .select('employee_id, remarks')
      .eq('status', 'approved')
      .lte('start_date', today)
      .gte('end_date', today)
      .then(({ data }) => {
        const ids = new Set<string>()
        for (const r of (data || []) as { employee_id: string; remarks: string | null }[]) {
          if (r.remarks && r.remarks.includes('Historical import')) continue
          ids.add(r.employee_id)
        }
        setOnLeave(ids.size)
      })
  }, [auth.status])

  if (auth.status !== 'ready') return <AuthStatus state={auth} />

  const dateLabel = new Date().toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-MY', { month: 'long', day: 'numeric', weekday: 'long' })
  const top = attention.slice(0, 3)

  return (
    <ManagerTabPage tab="workspace" badge={attention.length}>
      {/* 蓝色头部:问候 + 日期 */}
      <Hero>
        <div className="flex items-center gap-3">
          <span className="rounded-full ring-2 ring-white/40"><Avatar name={me?.full_name} size={46} /></span>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{t('hello')}, {me?.full_name.split(' ')[0]}</p>
            <p className="mt-0.5 text-xs text-blue-100">{dateLabel}</p>
          </div>
        </div>
      </Hero>

      {/* 信息卡:白底盖在头部上面,左边待审批(蓝色大数字),右边今天休假 */}
      <div className="relative z-[1] -mt-10 mx-4 overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="flex divide-x divide-gray-100">
          <Link href="/approve" className="flex-1 px-4 py-4 active:bg-gray-50">
            <p className="flex items-center gap-1 text-[13px] text-gray-500"><Icon d={EI.clock} size={14} />{t('pendingCount')}</p>
            <p className={`mt-2 text-[34px] font-bold leading-none tabular-nums ${attention.length > 0 ? 'text-brand' : 'text-gray-900'}`}>
              {loading ? '–' : attention.length}
            </p>
          </Link>
          <Link href="/calendar" className="flex-1 px-4 py-4 active:bg-gray-50">
            <p className="flex items-center gap-1 text-[13px] text-gray-500"><Icon d={IC.calendar} size={14} />{t('onLeaveToday')}</p>
            <p className="mt-2 flex items-baseline text-[34px] font-bold leading-none tabular-nums text-gray-900">
              {onLeave === null ? '–' : onLeave}
              <span className="ml-1 text-sm font-normal text-gray-500">{t('staffUnit')}</span>
            </p>
          </Link>
        </div>
      </div>

      {/* 待办前几条 */}
      {top.length > 0 && (
        <>
          <div className="flex items-center justify-between px-5 pb-2 pt-4">
            <p className="text-sm font-medium text-gray-500">{t('todo')}</p>
            <Link href="/approve" className="flex items-center text-sm font-medium text-brand">
              {t('viewAll')}<Icon d={EI.chevronR} size={14} />
            </Link>
          </div>
          <Card className="shadow-xs">
            {top.map((a, i) => (
              <Link key={a.id} href={`/approve/${a.id}`} className={`flex items-center px-4 py-3.5 active:bg-gray-50 ${i ? 'border-t border-gray-100' : ''}`}>
                <Avatar name={a.person.full_name} size={38} />
                <div className="ml-3 min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-gray-900">{a.person.full_name}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-gray-500">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: TYPE_COLOR[a.leave_type] ?? '#8C8C8C' }} />
                    {leaveName(a.leave_type, lang)} · {fmtNum(Number(a.total_days))} {t('daysUnit')} · {fmtRange(a, lang, t('imported'))}
                  </p>
                </div>
                {a.status === 'approved' && <span className="ml-2 shrink-0 text-xs font-medium text-st-pending-text">{t('cancelReq')}</span>}
                <Icon d={EI.chevronR} size={16} className="ml-1 shrink-0 text-gray-300" />
              </Link>
            ))}
          </Card>
        </>
      )}

      {/* 全部功能 (增加专属钉钉卡片背景与圆角阴影) */}
      <div className="mx-4 mt-5">
        <p className="mb-2.5 px-1 text-xs font-semibold uppercase tracking-wider text-gray-500">{t('allFeatures')}</p>
        <div className="overflow-hidden rounded-2xl border border-gray-100/80 bg-white p-4 shadow-xs">
          <div className="grid grid-cols-4 gap-y-5">
            {FEATURES.map((f) => (
              <Link key={f.href} href={f.href} className="flex flex-col items-center gap-1.5 active:opacity-60">
                <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-xs transition-transform active:scale-95" style={{ background: f.grad }}>
                  <Icon d={f.icon} size={28} />
                  {f.key === 'approvals' && attention.length > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-st-rejected px-1 text-[11px] font-semibold leading-none text-white shadow-xs">
                      {attention.length > 99 ? '99+' : attention.length}
                    </span>
                  )}
                </span>
                <span className="text-center text-[12px] font-medium leading-tight text-gray-700">{t(f.key)}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </ManagerTabPage>
  )
}
