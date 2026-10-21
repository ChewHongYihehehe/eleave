'use client'

import Link from 'next/link'
import AuthStatus from '@/components/AuthStatus'
import { useLang, leaveTypeName } from '@/lib/lang'
import { useLeaveData, fmtNum, TYPE_COLOR } from '@/lib/useLeaveData'
import { toLocalDateStr } from '@/lib/dateUtils'
import { getYearsOfService } from '@/lib/leaveRules'
import { Card, EI, Icon, TabPage } from './EmployeeShell'

// 员工手机版 · 工作台(参考钉钉工作台:上面一张信息卡,下面"常用应用"图标格子,再往下是列表)

export default function EmployeeHome() {
  const { auth, employee, apps, balances, upcoming, error, unseenCount } = useLeaveData()
  const { lang, t } = useLang()
  if (auth.status !== 'ready') return <AuthStatus state={auth} />
  if (!employee) return null

  const initials = employee.full_name.trim().split(/\s+/).map((p, i, a) => (i === 0 || i === a.length - 1 ? p[0] : '')).join('').toUpperCase()
  const pendingCount = apps.filter((a) => a.status === 'pending' || a.cancellation_status === 'requested').length
  const annual = balances.find((b) => b.type === 'annual')
  const others = balances.filter((b) => b.type !== 'annual')
  const today = toLocalDateStr(new Date())
  const year = new Date().getFullYear()

  const tiles = [
    { href: '/dashboard/apply', label: t('applyLeave'), icon: EI.plus, tone: 'bg-brand-soft text-brand' },
    { href: '/dashboard/records', label: t('myRecords'), icon: EI.records, tone: 'bg-orange-50 text-orange-500' },
    { href: '/dashboard/records?tab=pending', label: t('pendingTile'), icon: EI.clock, tone: 'bg-green-50 text-green-600', badge: pendingCount },
    { href: '/notifications', label: t('telegram'), icon: EI.bell, tone: 'bg-purple-50 text-purple-600' },
  ]

  return (
    <TabPage tab="home" badge={unseenCount}>
      {/* 顶部:头像 + 问候 */}
      <div className="flex items-center gap-3 px-4 pb-3 pt-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{initials}</div>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-gray-900">{t('hello')}, {employee.full_name.split(' ')[0]}</p>
          <p className="text-xs text-gray-400">
            {employee.employee_no ? `#${employee.employee_no} · ` : ''}
            {getYearsOfService(employee.date_of_commencement).toFixed(1)} {t('yearsOfService')}
          </p>
        </div>
      </div>

      {error && <p className="mx-4 mb-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</p>}

      {unseenCount > 0 && (
        <Link href="/dashboard/records" className="mx-4 mb-3 flex items-center justify-between rounded-xl bg-orange-50 px-4 py-2.5 text-sm text-orange-600">
          <span>{unseenCount} {t('updatesOn')}</span>
          <Icon d={EI.chevronR} size={16} />
        </Link>
      )}

      {/* 信息卡:年假剩余 + 其他假种 */}
      {annual && (
        <Link href={`/dashboard/balance/annual`} className="mx-4 block overflow-hidden rounded-2xl bg-gradient-to-br from-brand to-[#4096FF] text-white">
          <div className="px-5 py-4">
            <p className="text-xs text-blue-100">{leaveTypeName('annual', lang)} · {year}</p>
            <p className="mt-1 text-3xl font-bold leading-none">
              {fmtNum(annual.remaining)}<span className="ml-1.5 text-sm font-normal text-blue-100">{t('daysLeft')}</span>
            </p>
          </div>
          {others.length > 0 && (
            <div className="flex border-t border-white/20">
              {others.map((b) => (
                <div key={b.type} className="flex-1 border-r border-white/20 px-2 py-2.5 text-center last:border-r-0">
                  <p className="text-sm font-semibold">{fmtNum(b.remaining)}</p>
                  <p className="mt-0.5 text-[11px] text-blue-100">{leaveTypeName(b.type, lang).replace(/( \(MC\)| Leave)/g, '')}</p>
                </div>
              ))}
            </div>
          )}
        </Link>
      )}

      {/* 常用应用 */}
      <Card className="mt-3 px-2 py-4">
        <p className="mb-3 px-2 text-sm font-medium text-gray-500">{t('quickActions')}</p>
        <div className="grid grid-cols-4">
          {tiles.map((x) => (
            <Link key={x.href} href={x.href} className="flex flex-col items-center gap-1.5 px-1 active:opacity-60">
              <span className={`relative flex h-12 w-12 items-center justify-center rounded-2xl ${x.tone}`}>
                <Icon d={x.icon} size={24} />
                {!!x.badge && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#F5222D] px-1 text-[11px] font-semibold leading-none text-white">{x.badge}</span>
                )}
              </span>
              <span className="text-center text-xs leading-tight text-gray-700">{x.label}</span>
            </Link>
          ))}
        </div>
      </Card>

      {/* 假期余额 */}
      <p className="px-5 pb-2 pt-4 text-sm font-medium text-gray-500">{t('leaveBalance')}</p>
      <Card>
        {balances.map((b, i) => (
          <Link key={b.type} href={`/dashboard/balance/${b.type}`} className={`flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 ${i ? 'border-t border-gray-100' : ''}`}>
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: TYPE_COLOR[b.type] }} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] text-gray-900">{leaveTypeName(b.type, lang)}</p>
              <p className="mt-0.5 text-xs text-gray-400">{t('total')} {fmtNum(b.total)} {t('daysUnit')}</p>
            </div>
            <div className="text-right">
              <p className="text-base font-semibold text-gray-900">{fmtNum(b.remaining)}</p>
              <p className="text-[11px] text-gray-400">{t('daysLeft')}</p>
            </div>
            <Icon d={EI.chevronR} size={16} className="text-gray-300" />
          </Link>
        ))}
        <Link href="/dashboard/records" className="flex items-center justify-between border-t border-gray-100 px-4 py-3.5 text-[15px] text-gray-900 active:bg-gray-50">
          {t('viewAllRecords')}<Icon d={EI.chevronR} size={16} className="text-gray-300" />
        </Link>
      </Card>

      {/* 公假 */}
      {upcoming.length > 0 && (
        <>
          <p className="px-5 pb-2 pt-4 text-sm font-medium text-gray-500">{t('upcomingHolidays')}</p>
          <Card>
            {upcoming.map((h, i) => {
              const dt = new Date(h.holiday_date + 'T00:00:00')
              return (
                <div key={h.holiday_date} className={`flex items-center gap-3 px-4 py-3 ${i ? 'border-t border-gray-100' : ''}`}>
                  <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-soft text-brand">
                    <span className="text-[10px] leading-none">{lang === 'zh' ? `${dt.getMonth() + 1}月` : dt.toLocaleDateString('en-MY', { month: 'short' })}</span>
                    <span className="mt-0.5 text-base font-bold leading-none">{dt.getDate()}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] text-gray-900">{h.name}</p>
                    <p className="text-xs text-gray-400">
                      {dt.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-MY', { weekday: 'long' })}
                      {h.holiday_date === today && <span className="ml-1.5 font-medium text-orange-500">· {t('today')}</span>}
                    </p>
                  </div>
                </div>
              )
            })}
          </Card>
        </>
      )}
    </TabPage>
  )
}
