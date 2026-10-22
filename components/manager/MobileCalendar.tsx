'use client'

import { useEffect, useMemo, useState } from 'react'
import AuthStatus from '@/components/AuthStatus'
import { Avatar, EI, Icon, NavButton, TabHeader } from '@/components/employee/EmployeeShell'
import { supabase } from '@/lib/supabaseClient'
import { eachDay, toLocalDateStr } from '@/lib/dateUtils'
import { useEmployee } from '@/lib/useEmployee'
import { TYPE_COLOR } from '@/lib/useLeaveData'
import { leaveName, useMgrT } from '@/lib/mgrText'
import { ManagerTabPage } from './ManagerTabs'

// 团队日历(手机):月历格子里用小圆点,点日期在下面看"谁休假"。数据规则和电脑版一致
// (已批准 + 启用的公假;历史导入记录不画)。

type Entry = { full_name: string; leave_type: string; half_day_period: string | null }
type Ref = { full_name: string } | { full_name: string }[] | null
type Row = { leave_type: string; start_date: string; end_date: string; is_half_day: boolean; half_day_period: string | null; remarks?: string | null; employees: Ref }
const nameOf = (r: Ref) => (!r ? 'Unknown' : (Array.isArray(r) ? r[0]?.full_name : r.full_name) || 'Unknown')
const HOLIDAY = '#C9A227'

export default function MobileCalendar() {
  const auth = useEmployee({ requireManager: true })
  const { t, lang } = useMgrT()
  const [cur, setCur] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [entries, setEntries] = useState<Record<string, Entry[]>>({})
  const [holidays, setHolidays] = useState<Record<string, string>>({})
  const [sel, setSel] = useState<string | null>(toLocalDateStr(new Date()))

  useEffect(() => {
    if (auth.status !== 'ready') return
    let cancelled = false
    ;(async () => {
      const y = cur.getFullYear(), m = cur.getMonth()
      const start = toLocalDateStr(new Date(y, m, 1))
      const end = toLocalDateStr(new Date(y, m + 1, 0))
      const { data: apps } = await supabase
        .from('leave_applications')
        .select('leave_type, start_date, end_date, is_half_day, half_day_period, remarks, employees!leave_applications_employee_id_fkey(full_name)')
        .eq('status', 'approved').lte('start_date', end).gte('end_date', start)
      const { data: hol } = await supabase.from('public_holidays').select('holiday_date, name').eq('is_enabled', true).gte('holiday_date', start).lte('holiday_date', end)
      if (cancelled) return
      const hm: Record<string, string> = {}
      for (const h of hol || []) hm[h.holiday_date] = h.name
      setHolidays(hm)
      const map: Record<string, Entry[]> = {}
      for (const a of (apps || []) as unknown as Row[]) {
        if (a.remarks && a.remarks.includes('Historical import')) continue
        const from = a.start_date > start ? a.start_date : start
        const to = a.end_date < end ? a.end_date : end
        const name = nameOf(a.employees)
        eachDay(from, to, (_d, key) => { (map[key] ||= []).push({ full_name: name, leave_type: a.leave_type, half_day_period: a.is_half_day ? a.half_day_period : null }) })
      }
      setEntries(map)
    })()
    return () => { cancelled = true }
  }, [cur, auth.status])

  const cells = useMemo(() => {
    const y = cur.getFullYear(), m = cur.getMonth()
    const out: (number | null)[] = Array(new Date(y, m, 1).getDay()).fill(null)
    for (let d = 1; d <= new Date(y, m + 1, 0).getDate(); d++) out.push(d)
    return out
  }, [cur])

  if (auth.status !== 'ready') return <AuthStatus state={auth} />

  const y = cur.getFullYear(), m = cur.getMonth()
  const todayKey = toLocalDateStr(new Date())
  const ym = `${y}-${String(m + 1).padStart(2, '0')}`
  const selInMonth = sel !== null && sel.slice(0, 7) === ym
  const selEntries = selInMonth ? entries[sel!] || [] : []
  const selHoliday = selInMonth ? holidays[sel!] : undefined
  const weekdays = t('weekdays').split(',')
  const title = lang === 'zh' ? `${y}年${m + 1}月` : cur.toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })

  function go(delta: number) {
    const next = new Date(y, m + delta, 1)
    setCur(next)
    const now = new Date()
    setSel(next.getFullYear() === now.getFullYear() && next.getMonth() === now.getMonth() ? toLocalDateStr(now) : null)
  }

  const legend: [string, string][] = [
    ['annual', t('legendAnnual')], ['medical', t('legendMedical')], ['maternity', t('legendMaternity')], ['paternity', t('legendPaternity')], ['unpaid', t('legendUnpaid')],
  ]

  return (
    <ManagerTabPage tab="calendar">
      <TabHeader
        title={title}
        left={<NavButton onClick={() => go(-1)}><Icon d={EI.chevronL} size={20} /></NavButton>}
        right={<NavButton onClick={() => go(1)}><Icon d={EI.chevronR} size={20} /></NavButton>}
      />
      <div className="h-3" />

      <div className="mx-4 rounded-xl bg-white p-2">
        <div className="grid grid-cols-7 text-center text-xs text-gray-500">
          {weekdays.map((d) => <div key={d} className="py-1.5">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((day, i) => {
            if (day === null) return <div key={i} className="h-14" />
            const key = toLocalDateStr(new Date(y, m, day))
            const list = entries[key] || []
            const dots: string[] = []
            if (holidays[key]) dots.push(HOLIDAY)
            for (const e of list) dots.push(TYPE_COLOR[e.leave_type] ?? '#8C8C8C')
            const show = dots.length <= 4 ? dots : dots.slice(0, 3)
            const extra = dots.length - show.length
            const isSel = key === sel, isToday = key === todayKey
            return (
              <button key={i} onClick={() => setSel(key)} className="flex h-14 flex-col items-center pt-1">
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${isSel ? 'bg-brand font-semibold text-white' : isToday ? 'font-bold text-brand' : holidays[key] ? 'text-[#C9A227]' : 'text-gray-800'}`}>{day}</span>
                <span className="mt-1 flex flex-wrap items-center justify-center gap-0.5 px-0.5">
                  {show.map((c, j) => <span key={j} className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />)}
                  {extra > 0 && <span className="text-[10px] leading-none text-gray-500">+{extra}</span>}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mx-4 mt-3 flex flex-wrap gap-x-4 gap-y-1.5 px-1 text-xs text-gray-500">
        {legend.map(([k, label]) => (
          <span key={k} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: TYPE_COLOR[k] }} />{label}</span>
        ))}
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: HOLIDAY }} />{t('publicHoliday')}</span>
      </div>

      {selInMonth && (
        <div className="mx-4 mt-3 rounded-xl bg-white p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-base font-semibold text-gray-900">
              {new Date(Number(sel!.slice(0, 4)), Number(sel!.slice(5, 7)) - 1, Number(sel!.slice(8, 10))).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-MY', { month: 'long', day: 'numeric', weekday: 'long' })}
            </p>
            {sel === todayKey && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">{t('today')}</span>}
          </div>
          {selHoliday && <p className="mt-2 rounded-lg bg-[#FFF8E1] px-3 py-2 text-sm text-[#8A6D00]">{selHoliday}</p>}
          {selEntries.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">{t('nobodyOnLeave')}</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-gray-500">{selEntries.length} {t('nOnLeave')}</p>
              <div className="mt-2 divide-y divide-gray-100">
                {selEntries.map((e, i) => (
                  <div key={i} className="flex items-center gap-3 py-2.5">
                    <Avatar name={e.full_name} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] text-gray-900">{e.full_name}</p>
                      <p className="flex items-center gap-1.5 text-xs text-gray-500">
                        <span className="h-2 w-2 rounded-full" style={{ background: TYPE_COLOR[e.leave_type] ?? '#8C8C8C' }} />
                        {leaveName(e.leave_type, lang)}{e.half_day_period ? ` · ${e.half_day_period === 'am' ? t('amOnly') : t('pmOnly')}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </ManagerTabPage>
  )
}
