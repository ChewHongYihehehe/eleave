'use client'

import MobileCalendar from '@/components/manager/MobileCalendar'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { toLocalDateStr, eachDay } from '@/lib/dateUtils'
import ManagerShell from '@/components/ManagerShell'
import PageHeader from '@/components/PageHeader'
import { Avatar } from '@/components/employee/EmployeeShell'
import { useLang, leaveTypeName } from '@/lib/lang'
import { useEmployee } from '@/lib/useEmployee'
import AuthStatus from '@/components/AuthStatus'

type CalendarEntry = {
  full_name: string
  leave_type: string
  half_day_period: string | null // 'am' | 'pm' | null(全天)
}

// Supabase 的关联查询在某些版本会把一对一的关联回传成数组,这里两种都接受。
type EmployeeRef = { full_name: string } | { full_name: string }[] | null
type ApprovedRow = {
  leave_type: string
  start_date: string
  end_date: string
  is_half_day: boolean
  half_day_period: string | null
  remarks?: string | null
  employees: EmployeeRef
}

function nameOf(ref: EmployeeRef): string {
  if (!ref) return 'Unknown'
  return (Array.isArray(ref) ? ref[0]?.full_name : ref.full_name) || 'Unknown'
}

const LEAVE_TYPE_BG: Record<string, string> = {
  annual: 'bg-leave-annual',
  medical: 'bg-leave-medical',
  maternity: 'bg-leave-maternity',
  paternity: 'bg-leave-paternity',
  unpaid: 'bg-leave-unpaid',
  holiday: 'bg-leave-holiday',
}

const LEGEND = [
  { key: 'annual', label: 'legendAnnual' },
  { key: 'medical', label: 'legendMedical' },
  { key: 'maternity', label: 'legendMaternity' },
  { key: 'paternity', label: 'legendPaternity' },
  { key: 'unpaid', label: 'legendUnpaid' },
  { key: 'holiday', label: 'calPublicHoliday' },
] as const

const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAYS_ZH = ['日', '一', '二', '三', '四', '五', '六']

function DesktopCalendar() {
  const auth = useEmployee({ requireManager: true })
  const { lang, t } = useLang()
  const zh = lang === 'zh'
  const [currentDate, setCurrentDate] = useState(new Date())
  const [entriesByDate, setEntriesByDate] = useState<Record<string, CalendarEntry[]>>({})
  const [holidaysByDate, setHolidaysByDate] = useState<Record<string, string>>({})
  // 点哪一天,右边面板就显示那一天"谁请假"(全名完整显示,不会被截断)
  const [selectedKey, setSelectedKey] = useState<string | null>(toLocalDateStr(new Date()))

  useEffect(() => {
    if (auth.status === 'ready') loadMonth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, auth.status])

  async function loadMonth() {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const monthStart = toLocalDateStr(new Date(year, month, 1))
    const monthEnd = toLocalDateStr(new Date(year, month + 1, 0))

    const { data: apps } = await supabase
      .from('leave_applications')
      .select('leave_type, start_date, end_date, is_half_day, half_day_period, remarks, employees!leave_applications_employee_id_fkey(full_name)')
      .eq('status', 'approved')
      .lte('start_date', monthEnd)
      .gte('end_date', monthStart)

    const { data: holidays } = await supabase
      .from('public_holidays')
      .select('holiday_date, name')
      .eq('is_enabled', true)
      .gte('holiday_date', monthStart)
      .lte('holiday_date', monthEnd)

    const holidayMap: Record<string, string> = {}
    for (const h of holidays || []) holidayMap[h.holiday_date] = h.name
    setHolidaysByDate(holidayMap)

    const map: Record<string, CalendarEntry[]> = {}
    for (const app of (apps || []) as unknown as ApprovedRow[]) {
      // 历史导入的记录使用的是月份占位日期,不画在日历上,避免假日期误导排班
      if (app.remarks && app.remarks.includes('Historical import')) continue
      // 只画落在这个月里的那一段(字串比较即可,格式是 YYYY-MM-DD)
      const from = app.start_date > monthStart ? app.start_date : monthStart
      const to = app.end_date < monthEnd ? app.end_date : monthEnd
      const name = nameOf(app.employees)
      eachDay(from, to, (_d, key) => {
        if (!map[key]) map[key] = []
        map[key].push({
          full_name: name,
          leave_type: app.leave_type,
          half_day_period: app.is_half_day ? app.half_day_period : null,
        })
      })
    }
    setEntriesByDate(map)
  }

  function changeMonth(delta: number) {
    const next = new Date(currentDate.getFullYear(), currentDate.getMonth() + delta, 1)
    setCurrentDate(next)
    // 换月份:如果是本月,自动选今天;否则先不选
    const now = new Date()
    const isThisMonth = next.getFullYear() === now.getFullYear() && next.getMonth() === now.getMonth()
    setSelectedKey(isThisMonth ? toLocalDateStr(now) : null)
  }

  if (auth.status !== 'ready') return <AuthStatus state={auth} />

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDayOfMonth = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startWeekday = firstDayOfMonth.getDay()

  const cells: (number | null)[] = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  // 电脑版名字显示:平时只显示第一个名字;如果这个月里有两个不同的人第一个名字相同,就改显示全名。
  const firstNameOwners: Record<string, Set<string>> = {}
  for (const list of Object.values(entriesByDate)) {
    for (const e of list) {
      const first = e.full_name.trim().split(/\s+/)[0]
      ;(firstNameOwners[first] ||= new Set()).add(e.full_name)
    }
  }
  function displayName(fullName: string) {
    const first = fullName.trim().split(/\s+/)[0]
    return (firstNameOwners[first]?.size ?? 0) > 1 ? fullName : first
  }

  const monthLabel = zh
    ? `${year}年${month + 1}月`
    : currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })
  const todayKey = toLocalDateStr(new Date())
  const weekdays = zh ? WEEKDAYS_ZH : WEEKDAYS_EN

  // 补齐最后一行,让表格的边框是完整的
  while (cells.length % 7 !== 0) cells.push(null)

  const selectedInMonth = selectedKey !== null && selectedKey.slice(0, 7) === toLocalDateStr(firstDayOfMonth).slice(0, 7)
  const selDate = selectedInMonth
    ? new Date(Number(selectedKey!.slice(0, 4)), Number(selectedKey!.slice(5, 7)) - 1, Number(selectedKey!.slice(8, 10)))
    : null
  const selEntries = selectedInMonth ? entriesByDate[selectedKey!] || [] : []
  const selHoliday = selectedInMonth ? holidaysByDate[selectedKey!] : undefined

  const navBtn = 'flex h-8 w-8 items-center justify-center rounded-md border border-line bg-white text-ink-soft transition-colors hover:border-pine hover:text-pine'

  return (
    <ManagerShell>
      <div className="mx-auto max-w-[1360px] space-y-4 pb-10">
        <PageHeader title={t('calTitle')} subtitle={t('calSub')} />

        <div className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-4">
          {/* ── 月历 ── */}
          <section className="overflow-hidden rounded-lg border border-line bg-white">
            {/* 工具栏:左 月份切换,右 图例 */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
              <div className="flex items-center gap-2">
                <button onClick={() => changeMonth(-1)} className={navBtn} aria-label="Previous month">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                </button>
                <button onClick={() => changeMonth(1)} className={navBtn} aria-label="Next month">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                </button>
                <button
                  onClick={() => { setCurrentDate(new Date()); setSelectedKey(todayKey) }}
                  className="h-8 rounded-md border border-line bg-white px-3 text-[13px] text-ink transition-colors hover:border-pine hover:text-pine"
                >
                  {t('calToday')}
                </button>
                <h2 className="ml-2 text-base font-semibold tabular-nums text-ink">{monthLabel}</h2>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-soft">
                {LEGEND.map((l) => (
                  <span key={l.key} className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${LEAVE_TYPE_BG[l.key]}`} />
                    {t(l.label)}
                  </span>
                ))}
              </div>
            </div>

            {/* 星期 */}
            <div className="grid grid-cols-7 border-b border-line bg-[#FAFAFA] text-center text-[13px] text-ink-soft">
              {weekdays.map((d, i) => (
                <div key={d} className={`py-2 ${i === 0 || i === 6 ? 'text-ink-faint' : ''}`}>{d}</div>
              ))}
            </div>

            {/* 日期格子 */}
            <div className="grid grid-cols-7">
              {cells.map((day, idx) => {
                const lastCol = idx % 7 === 6
                const cellBase = `min-h-[112px] border-b border-line ${lastCol ? '' : 'border-r'}`
                if (day === null) return <div key={idx} className={`${cellBase} bg-[#FAFAFA]/60`} />
                const dateKey = toLocalDateStr(new Date(year, month, day))
                const isToday = dateKey === todayKey
                const isSelected = dateKey === selectedKey
                const holidayName = holidaysByDate[dateKey]
                const entries = entriesByDate[dateKey] || []
                const shown = entries.slice(0, holidayName ? 2 : 3)
                const extra = entries.length - shown.length
                return (
                  <div
                    key={idx}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedKey(dateKey)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedKey(dateKey) } }}
                    className={`${cellBase} cursor-pointer p-1.5 text-left transition-colors ${isSelected ? 'bg-pine-soft/60 shadow-[inset_0_0_0_1.5px_#1677FF]' : 'hover:bg-[#FAFAFA]'}`}
                  >
                    <span className={`inline-flex h-6 min-w-[24px] items-center justify-center rounded-full px-1 text-[13px] tabular-nums ${isToday ? 'bg-pine font-semibold text-white' : 'text-ink'}`}>
                      {day}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {holidayName && (
                        <p className="truncate rounded bg-st-pending-soft px-1.5 py-px text-[11px] font-medium text-st-pending-text" title={holidayName}>
                          {holidayName}
                        </p>
                      )}
                      {shown.map((e, i) => (
                        <p
                          key={i}
                          title={`${e.full_name} · ${leaveTypeName(e.leave_type, lang)}${e.half_day_period ? ` (${e.half_day_period.toUpperCase()})` : ''}`}
                          className={`truncate rounded px-1.5 py-px text-[11px] text-white ${LEAVE_TYPE_BG[e.leave_type] || 'bg-ink-faint'}`}
                        >
                          {displayName(e.full_name)}
                          {e.half_day_period ? ` · ${e.half_day_period === 'am' ? (zh ? '上午' : 'AM') : (zh ? '下午' : 'PM')}` : ''}
                        </p>
                      ))}
                      {extra > 0 && (
                        <p className="px-1.5 text-[11px] text-pine">+{extra} {t('calMore')}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* ── 右侧:选中那一天的详情 ── */}
          <aside className="sticky top-20 overflow-hidden rounded-lg border border-line bg-white">
            <div className="border-b border-line px-5 py-3.5">
              <h3 className="text-[15px] font-semibold text-ink">
                {selDate
                  ? selDate.toLocaleDateString(zh ? 'zh-CN' : 'en-MY', { month: 'long', day: 'numeric', weekday: 'long' })
                  : (zh ? '点选日期查看' : 'Select a date')}
              </h3>
              {selDate && (
                <p className="mt-0.5 text-[13px] text-ink-soft">
                  {selEntries.length === 0 ? t('calNoOne') : zh ? `${selEntries.length} ${t('calOnLeave')}` : `${selEntries.length} ${t('calOnLeave')}`}
                </p>
              )}
            </div>
            <div className="max-h-[calc(100vh-14rem)] overflow-y-auto">
              {!selDate && (
                <p className="px-5 py-10 text-center text-[13px] text-ink-faint">
                  {zh ? '点击左边的日期,查看当天谁休假。' : 'Click a date to see who is on leave.'}
                </p>
              )}
              {selHoliday && (
                <div className="flex items-center gap-2 border-b border-line bg-st-pending-soft px-5 py-2.5">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-leave-holiday" />
                  <span className="text-[13px] font-medium text-st-pending-text">{selHoliday}</span>
                </div>
              )}
              {selEntries.length > 0 && (
                <ul className="divide-y divide-line">
                  {selEntries.map((e, i) => (
                    <li key={i} className="flex items-center gap-3 px-5 py-3">
                      <Avatar name={e.full_name} size={32} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{e.full_name}</p>
                        <p className="flex items-center gap-1.5 text-xs text-ink-soft">
                          <span className={`h-1.5 w-1.5 rounded-full ${LEAVE_TYPE_BG[e.leave_type] || 'bg-ink-faint'}`} />
                          {leaveTypeName(e.leave_type, lang)}
                          {e.half_day_period && <span>· {e.half_day_period === 'am' ? t('am') : t('pm')}</span>}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </div>
    </ManagerShell>
  )
}

// 手机/平板(< lg)用手机版;电脑(≥ lg)用后台版。断点和 ManagerShell 一致。
export default function TeamCalendarPage() {
  return (
    <>
      <div className="lg:hidden">
        <MobileCalendar />
      </div>
      <div className="hidden lg:block">
        <DesktopCalendar />
      </div>
    </>
  )
}
