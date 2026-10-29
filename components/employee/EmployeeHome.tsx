'use client'

import Link from 'next/link'
import AuthStatus from '@/components/AuthStatus'
import { useLang, leaveTypeName } from '@/lib/lang'
import { useTr } from '@/lib/tr'
import { useLeaveData, fmtNum, TYPE_COLOR } from '@/lib/useLeaveData'
import { toLocalDateStr } from '@/lib/dateUtils'
import { getYearsOfService } from '@/lib/leaveRules'
import { Card, EI, Icon, TabPage } from './EmployeeShell'

// 员工手机版 · 工作台(参考钉钉工作台:上面一张信息卡,下面"常用应用"图标格子,再往下是列表)

function CalendarGridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
      <rect x="3" y="4" width="18" height="18" rx="3" />
      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
      {[8, 12, 16].flatMap((x) => [14, 18].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.1" fill="currentColor" stroke="none" />))}
    </svg>
  )
}

export default function EmployeeHome() {
  const { auth, employee, apps, balances, upcoming, error, unseenCount } = useLeaveData()
  const { lang, t } = useLang()
  const { tr, locale } = useTr()
  if (auth.status !== 'ready') return <AuthStatus state={auth} />
  if (!employee) return null

  const initials = employee.full_name.trim().split(/\s+/).map((p, i, a) => (i === 0 || i === a.length - 1 ? p[0] : '')).join('').toUpperCase()
  const pendingCount = apps.filter((a) => a.status === 'pending' || a.cancellation_status === 'requested').length
  const annual = balances.find((b) => b.type === 'annual')
  const others = balances.filter((b) => b.type !== 'annual')
  const today = toLocalDateStr(new Date())
  const year = new Date().getFullYear()

  const tiles = [
    { href: '/dashboard/apply', label: t('applyLeave'), icon: EI.plus, grad: 'linear-gradient(135deg, #1677FF, #4096FF)' },
    { href: '/dashboard/records', label: t('myRecords'), icon: EI.records, grad: 'linear-gradient(135deg, #FA8C16, #FFA940)' },
    { href: '/dashboard/records?tab=pending', label: t('pendingTile'), icon: EI.clock, grad: 'linear-gradient(135deg, #13C2C2, #36CFC9)', badge: pendingCount },
    { href: '/notifications', label: t('telegram'), icon: EI.bell, grad: 'linear-gradient(135deg, #722ED1, #9254DE)' },
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

      {/* 信息卡:沿用旧版的蓝色渐变 + 右侧日历图标 */}
      {annual && (
        <Link
          href="/dashboard/balance/annual"
          className="mx-4 block overflow-hidden rounded-2xl"
          style={{ background: 'linear-gradient(135deg, #1677FF 0%, #4096FF 60%, #69B1FF 100%)' }}
        >
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="mb-1 text-xs font-semibold tracking-wider text-blue-100">{tr('休假余额', 'Leave balance', 'Baki cuti')}</p>
              <p className="text-2xl font-bold leading-tight text-white">
                {lang === 'zh' ? <>剩余{fmtNum(annual.remaining)}</> : fmtNum(annual.remaining)}
                <span className="ml-1 text-sm font-normal text-blue-100">{tr('天', 'days left', 'hari baki')}</span>
              </p>
              <p className="mt-0.5 text-xs text-blue-100">{leaveTypeName('annual', lang)} · {year}</p>
            </div>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20">
              <CalendarGridIcon className="h-9 w-9 text-white" />
            </div>
          </div>
          {others.length > 0 && (
            <div className="flex border-t border-white/20">
              {others.map((b) => (
                <div key={b.type} className="flex-1 border-r border-white/20 px-3 py-2.5 text-center last:border-r-0">
                  <p className="text-sm font-bold text-white">{fmtNum(b.remaining)}</p>
                  <p className="mt-0.5 text-[10px] leading-tight text-blue-100">{leaveTypeName(b.type, lang).replace(/( \(MC\)| Leave)/g, '').replace(/^Cuti /, '')}</p>
                </div>
              ))}
            </div>
          )}
        </Link>
      )}

      <div className="-mt-0">
        {/* 快捷功能:白色卡片里一排渐变图标 */}
        <div className="mx-4 mt-5 rounded-2xl bg-white p-4">
          <p className="mb-3 text-[15px] font-semibold text-gray-900">{t('quickActions')}</p>
          <div className="grid grid-cols-4 gap-3">
            {tiles.map((x) => (
              <Link key={x.href} href={x.href} className="flex flex-col items-center gap-1.5 active:opacity-60">
                <span className="relative flex h-12 w-12 items-center justify-center rounded-[14px] text-white" style={{ background: x.grad }}>
                  <Icon d={x.icon} size={26} />
                  {!!x.badge && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-st-rejected px-1 text-[11px] font-semibold leading-none text-white ring-2 ring-white">{x.badge}</span>
                  )}
                </span>
                <span className="text-center text-xs leading-tight text-gray-700">{x.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

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
                    <span className="text-[10px] leading-none">{lang === 'zh' ? `${dt.getMonth() + 1}月` : dt.toLocaleDateString(locale, { month: 'short' })}</span>
                    <span className="mt-0.5 text-base font-bold leading-none">{dt.getDate()}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] text-gray-900">{h.name}</p>
                    <p className="text-xs text-gray-400">
                      {dt.toLocaleDateString(locale, { weekday: 'long' })}
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
