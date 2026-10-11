'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { toLocalDateStr, eachDay } from '@/lib/dateUtils'
import ManagerShell from '@/components/ManagerShell'
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
  { key: 'annual', label: 'Annual' },
  { key: 'medical', label: 'Medical' },
  { key: 'maternity', label: 'Maternity' },
  { key: 'paternity', label: 'Paternity' },
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'holiday', label: 'Public Holiday' },
]

export default function TeamCalendarPage() {
  const auth = useEmployee({ requireManager: true })
  const [currentDate, setCurrentDate] = useState(new Date())
  const [entriesByDate, setEntriesByDate] = useState<Record<string, CalendarEntry[]>>({})
  const [holidaysByDate, setHolidaysByDate] = useState<Record<string, string>>({})

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
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + delta, 1))
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

  // 名字显示:平时只显示第一个名字;如果这个月里有两个不同的人第一个名字相同,就改显示全名。
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

  const monthLabel = currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })
  const todayKey = toLocalDateStr(new Date())

  return (
    <ManagerShell>
      <div className="space-y-6 pb-10"><h1 className="font-display text-2xl font-semibold text-ink">Team Leave Calendar</h1>

      <div className="flex items-center justify-between panel py-3">
        <button onClick={() => changeMonth(-1)} className="px-2 text-ink-soft hover:text-ink">←</button>
        <span className="font-display text-base font-semibold text-ink">{monthLabel}</span>
        <button onClick={() => changeMonth(1)} className="px-2 text-ink-soft hover:text-ink">→</button>
      </div>

      <div className="panel">
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-ink-faint">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, idx) => {
            if (day === null) return <div key={idx} className="min-h-[64px]" />
            const dateKey = toLocalDateStr(new Date(year, month, day))
            const isToday = dateKey === todayKey
            const holidayName = holidaysByDate[dateKey]
            const entries = entriesByDate[dateKey] || []
            return (
              <div
                key={idx}
                className={`min-h-[64px] rounded-md border p-1 text-left ${isToday
                  ? 'border-pine bg-pine-soft ring-1 ring-pine'
                  : holidayName
                    ? 'border-gold/40 bg-gold-soft'
                    : 'border-line'
                  }`}
              >
                <p className={`text-xs ${isToday ? 'font-semibold text-pine-deep' : 'text-ink-faint'}`}>
                  {day}
                  {isToday && <span className="ml-1 text-[9px] font-medium uppercase tracking-wide">Today</span>}
                </p>
                <div className="mt-0.5 space-y-0.5">
                  {holidayName && (
                    <p className="truncate rounded bg-leave-holiday px-1 text-[10px] font-medium text-white">
                      {holidayName}
                    </p>
                  )}
                  {entries.slice(0, 2).map((e, i) => (
                    <p
                      key={i}
                      title={`${e.full_name} · ${e.leave_type}${e.half_day_period ? ` (${e.half_day_period.toUpperCase()})` : ''}`}
                      className={`truncate rounded px-1 text-[10px] text-white ${LEAVE_TYPE_BG[e.leave_type] || 'bg-ink-faint'}`}
                    >
                      {displayName(e.full_name)}
                      {e.half_day_period ? ` (${e.half_day_period.toUpperCase()})` : ''}
                    </p>
                  ))}
                  {entries.length > 2 && (
                    <p
                      className="text-[10px] text-ink-faint"
                      title={entries.slice(2).map((e) => e.full_name).join(', ')}
                    >
                      +{entries.length - 2} more
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-ink-soft">
        {LEGEND.map((l) => (
          <span key={l.key} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${LEAVE_TYPE_BG[l.key]}`} />
            {l.label}
          </span>
        ))}
      </div>

      <p className="text-xs text-ink-faint">Showing approved leave and enabled public holidays only.</p>
    </div>
  </ManagerShell>
  )
}
