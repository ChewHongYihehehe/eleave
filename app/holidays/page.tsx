'use client'

import MobileHolidays from '@/components/manager/MobileHolidays'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import ManagerShell from '@/components/ManagerShell'
import { useEmployee } from '@/lib/useEmployee'
import AuthStatus from '@/components/AuthStatus'
import { recalcAnnualLeave } from '@/lib/recalcLeave'
import { loadWorkWeek, saveWorkWeek } from '@/lib/settings'
import { DEFAULT_WORK_WEEK, type WorkWeek } from '@/lib/leaveRules'
import { toLocalDateStr } from '@/lib/dateUtils'

type Holiday = {
  id: string
  holiday_date: string
  name: string
  is_enabled: boolean
}

function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}

function HolidayRow({
  holiday,
  onToggle,
  onDelete,
}: {
  holiday: Holiday
  onToggle: (id: string, current: boolean) => void
  onDelete: (id: string) => void
}) {
  const enabled = holiday.is_enabled
  return (
    <div className={`flex items-center justify-between gap-3 py-1.5 ${enabled ? '' : 'opacity-60'}`}>
      <div>
        <p className="text-sm font-medium text-ink">{holiday.name}</p>
        <p className="text-xs text-ink-faint">{holiday.holiday_date}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => onToggle(holiday.id, enabled)}
          className={
            'inline-flex h-7 w-[92px] shrink-0 items-center justify-between rounded-full px-1 text-[11px] font-semibold transition-colors ' +
            (enabled ? 'flex-row bg-pine text-white' : 'flex-row-reverse bg-line text-ink-soft')
          }
        >
          <span className="px-1.5">{enabled ? 'Enabled' : 'Disabled'}</span>
          <span className="h-5 w-5 shrink-0 rounded-full bg-white shadow-sm" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(holiday.id)}
          aria-label="Remove holiday"
          className="shrink-0 rounded-md p-1.5 text-ink-faint transition-colors hover:bg-rust-soft hover:text-rust"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  )
}

const WEEKDAYS = [
  { day: 1, label: 'Mon' }, { day: 2, label: 'Tue' }, { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' }, { day: 5, label: 'Fri' }, { day: 6, label: 'Sat' }, { day: 0, label: 'Sun' },
]

function DesktopHolidays() {
  const auth = useEmployee({ requireManager: true })
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [date, setDate] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // 工作周设定
  const [workWeek, setWorkWeek] = useState<WorkWeek>(DEFAULT_WORK_WEEK)
  const [savingWeek, setSavingWeek] = useState(false)

  useEffect(() => {
    if (auth.status !== 'ready') return
    loadHolidays()
    loadWorkWeek().then(setWorkWeek)
  }, [auth.status])

  async function loadHolidays() {
    const { data, error: loadError } = await supabase
      .from('public_holidays')
      .select('id, holiday_date, name, is_enabled')
      .order('holiday_date', { ascending: true })
    if (loadError) { setError('Could not load holidays.'); return }
    if (data) setHolidays(data)
  }

  // 公假有任何变动后,把覆盖该日期的年假申请(待批 + 已批)按新规则重算天数
  async function recalcForDate(holidayDate: string) {
    const { updated, error: recalcError } = await recalcAnnualLeave({ kind: 'date', date: holidayDate })
    if (recalcError) {
      setError(`Holiday saved, but recalculating leave days failed: ${recalcError}`)
    } else if (updated > 0) {
      setNotice(`${updated} annual leave application${updated > 1 ? 's were' : ' was'} recalculated to match the updated holiday list.`)
    }
  }

  async function toggleEnabled(id: string, current: boolean) {
    setError(''); setNotice('')
    const target = holidays.find((h) => h.id === id)
    const { error: updError } = await supabase
      .from('public_holidays')
      .update({ is_enabled: !current })
      .eq('id', id)
    if (updError) { setError('Failed to update holiday.'); return }
    if (target) await recalcForDate(target.holiday_date)
    loadHolidays()
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setNotice('')
    setSubmitting(true)

    const { error: insertError } = await supabase
      .from('public_holidays')
      .insert({ holiday_date: date, name })

    setSubmitting(false)

    if (insertError) {
      setError(insertError.message.includes('duplicate') ? 'A holiday already exists on this date.' : 'Failed to add holiday.')
      return
    }

    await recalcForDate(date)
    setDate('')
    setName('')
    loadHolidays()
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm('Remove this public holiday?')
    if (!confirmed) return
    setError(''); setNotice('')
    const target = holidays.find((h) => h.id === id)
    const { error: delError } = await supabase.from('public_holidays').delete().eq('id', id)
    if (delError) { setError('Failed to remove holiday.'); return }
    if (target) await recalcForDate(target.holiday_date)
    loadHolidays()
  }

  function setDayWeight(day: number, weight: number) {
    setWorkWeek((prev) => ({ ...prev, [day]: weight }))
  }

  async function handleSaveWorkWeek() {
    setError(''); setNotice('')
    setSavingWeek(true)
    const saveError = await saveWorkWeek(workWeek)
    if (saveError) {
      setSavingWeek(false)
      setError(`Failed to save work week: ${saveError}`)
      return
    }
    // 只重算"还没结束"的年假,已经休完的历史记录保持当时的算法
    const { updated, error: recalcError } = await recalcAnnualLeave(
      { kind: 'from', fromDate: toLocalDateStr(new Date()) },
      workWeek
    )
    setSavingWeek(false)
    if (recalcError) setError(`Work week saved, but recalculating leave days failed: ${recalcError}`)
    else setNotice(
      updated > 0
        ? `Work week saved. ${updated} upcoming annual leave application${updated > 1 ? 's were' : ' was'} recalculated.`
        : 'Work week saved.'
    )
  }

  if (auth.status !== 'ready') return <AuthStatus state={auth} />

  const currentYear = new Date().getFullYear()
  const thisYearHolidays = holidays.filter((h) => h.holiday_date.startsWith(String(currentYear)))
  const otherHolidays = holidays.filter((h) => !h.holiday_date.startsWith(String(currentYear)))

  return (
    <ManagerShell>
      <div className="space-y-6 pb-10"><h1 className="font-display text-2xl font-semibold text-ink">Public Holidays</h1>

      {/* ── Work week ── */}
      <div className="panel space-y-3">
        <div>
          <h2 className="font-display text-base font-semibold text-ink">Work Week</h2>
          <p className="mt-0.5 text-sm text-ink-soft">
            Annual leave only counts working days. Set which weekdays count as a full day, a half day
            (e.g. Saturday morning only), or a day off.
          </p>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {WEEKDAYS.map(({ day, label }) => (
            <div key={day} className="text-center">
              <p className="mb-1 text-xs font-medium text-ink-soft">{label}</p>
              <select
                value={workWeek[day]}
                onChange={(e) => setDayWeight(day, Number(e.target.value))}
                className="field-input px-1 py-1 text-xs"
              >
                <option value={1}>Full</option>
                <option value={0.5}>Half</option>
                <option value={0}>Off</option>
              </select>
            </div>
          ))}
        </div>
        <button onClick={handleSaveWorkWeek} disabled={savingWeek} className="btn-primary">
          {savingWeek ? 'Saving...' : 'Save Work Week'}
        </button>
      </div>

      <p className="text-sm text-ink-soft">
        Only enabled holidays (toggle switched on) are excluded when calculating annual leave days.
        Changing the list automatically recalculates existing annual leave applications that cover that date.
      </p>

      {notice && <p className="rounded-md bg-st-approved-soft p-3 text-sm text-st-approved-text">{notice}</p>}
      {error && <p className="rounded-md bg-rust-soft p-3 text-sm text-rust">{error}</p>}

      <form onSubmit={handleAdd} className="panel space-y-3">
        <h2 className="font-display text-base font-semibold text-ink">Add Public Holiday</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Date</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="field-input"
            />
          </div>
          <div>
            <label className="field-label">Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hari Raya"
              className="field-input"
            />
          </div>
        </div>
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? 'Adding...' : 'Add Holiday'}
        </button>
      </form>

      <div>
        <h2 className="mb-3 font-display text-base font-semibold text-ink">
          {currentYear} Holidays <span className="text-ink-faint">({thisYearHolidays.length})</span>
        </h2>
        {thisYearHolidays.length === 0 && <p className="text-sm text-ink-faint">No holidays added yet for {currentYear}.</p>}
        <div className="section-divided">
          {thisYearHolidays.map((h) => (
            <HolidayRow key={h.id} holiday={h} onToggle={toggleEnabled} onDelete={handleDelete} />
          ))}
        </div>
      </div>

      {otherHolidays.length > 0 && (
        <div>
          <h2 className="mb-3 font-display text-base font-semibold text-ink">Other Years</h2>
          <div className="section-divided">
            {otherHolidays.map((h) => (
              <HolidayRow key={h.id} holiday={h} onToggle={toggleEnabled} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      )}
    </div>
  </ManagerShell>
  )
}

// 手机(< md)用钉钉风格的新版页面;电脑(≥ md)保持原来的版面。
export default function HolidaysPage() {
  return (
    <>
      <div className="md:hidden">
        <MobileHolidays />
      </div>
      <div className="hidden md:block">
        <DesktopHolidays />
      </div>
    </>
  )
}
