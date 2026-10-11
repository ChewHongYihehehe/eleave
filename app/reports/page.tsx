'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { DEFAULT_WORK_WEEK, type WorkWeek } from '@/lib/leaveRules'
import { loadWorkWeek } from '@/lib/settings'
import {
  buildMonthReport,
  buildYearReport,
  monthBounds,
  type ReportEmployee,
  type ReportApp,
  type HoursRow,
  type LeaveLine,
} from '@/lib/reportData'
import ManagerShell from '@/components/ManagerShell'
import { useEmployee } from '@/lib/useEmployee'
import AuthStatus from '@/components/AuthStatus'

// 报表页,两个视图:
//  · Month(预设)—— 给算薪水的人用:选一个月,全职看"谁请了什么假、几天、哪几号",
//    兼职看"这个月几个小时"。只算已批准的假,待审批的会提醒但不计入。
//  · Year —— 给负责人看:每个人今年的年假余额、病假用量、无薪假总数。
// 所有计算都在 lib/reportData.ts(有测试),这里只负责取资料和排版。

const THIS_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 4 }, (_, i) => THIS_YEAR - 2 + i)
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const TYPE_LABEL: Record<string, string> = { annual: 'Annual', medical: 'MC', unpaid: 'Unpaid', maternity: 'Maternity', paternity: 'Paternity' }

type View = 'month' | 'year'

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
const dash = <span className="text-ink-faint/50">–</span>
const num = (n: number) => (n > 0 ? fmt(n) : dash)

function shortDate(iso: string) {
  const [, m, d] = iso.split('-')
  return `${Number(d)} ${MONTH_SHORT[Number(m) - 1]}`
}

function dateRange(a: string, b: string) {
  if (a === b) return shortDate(a)
  if (a.slice(0, 7) === b.slice(0, 7)) return `${Number(a.slice(8))}–${shortDate(b)}`
  return `${shortDate(a)} – ${shortDate(b)}`
}

function lineText(l: LeaveLine, ym: string): string | null {
  const a = l.app
  const label = TYPE_LABEL[a.leave_type] ?? a.leave_type
  const isHistorical = a.remarks?.includes('Historical import')
  if (isHistorical) {
    if (a.leave_type === 'annual') return null
    let t = `${label} · ${fmt(l.days)}d`
    if (a.is_half_day && a.half_day_period) t += ` (${a.half_day_period.toUpperCase()})`
    return t
  }
  let t = `${label} ${dateRange(a.start_date, a.end_date)}`
  if (a.is_half_day && a.half_day_period) t += ` (${a.half_day_period.toUpperCase()})`
  t += ` · ${fmt(l.days)}d`
  if (a.start_date.slice(0, 7) !== ym || a.end_date.slice(0, 7) !== ym) t += ' (this month)'
  return t
}

function exportCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const csv = [header, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }) // \ufeff 让 Excel 正确显示中文/特殊字符
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function ReportsPage() {
  const auth = useEmployee({ requireManager: true })

  const [view, setView] = useState<View>('month')
  const [year, setYear] = useState(THIS_YEAR)
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [onlyWithLeave, setOnlyWithLeave] = useState(false)

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [employees, setEmployees] = useState<ReportEmployee[]>([])
  const [apps, setApps] = useState<ReportApp[]>([])
  const [hours, setHours] = useState<HoursRow[]>([])
  const [holidayDates, setHolidayDates] = useState<string[]>([])
  const [workWeek, setWorkWeek] = useState<WorkWeek>(DEFAULT_WORK_WEEK)

  // 一次抓"整年"的资料;在同一年里切换月份不用重新抓
  useEffect(() => {
    if (auth.status === 'ready') loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status, year])

  async function loadData() {
    setLoading(true)
    setLoadError('')
    const [empRes, appRes, holRes, hoursRes, ww] = await Promise.all([
      supabase
        .from('employees')
        .select('id, employee_no, full_name, date_of_commencement, employment_type, is_active, annual_leave_carry_forward, annual_leave_entitlement_override, role')
        .order('employee_no', { ascending: true }),
      supabase
        .from('leave_applications')
        .select('id, employee_id, leave_type, start_date, end_date, is_half_day, half_day_period, total_days, status, cancellation_status, remarks')
        .in('status', ['approved', 'pending'])
        .lte('start_date', `${year}-12-31`)
        .gte('end_date', `${year}-01-01`),
      supabase.from('public_holidays').select('holiday_date').eq('is_enabled', true),
      supabase.from('monthly_work_hours').select('employee_id, month, total_hours').eq('year', year),
      loadWorkWeek(),
    ])
    if (empRes.error || appRes.error || holRes.error || hoursRes.error) {
      setLoadError('Could not load report data. Please refresh and try again.')
      setLoading(false)
      return
    }
    const staffOnly = ((empRes.data || []) as ReportEmployee[]).filter(
      (e) => e.role !== 'manager' && e.full_name.toUpperCase() !== 'CHEW HONG YI'
    )
    setEmployees(staffOnly)
    setApps((appRes.data || []) as ReportApp[])
    setHolidayDates((holRes.data || []).map((h) => h.holiday_date))
    setHours((hoursRes.data || []) as HoursRow[])
    setWorkWeek(ww)
    setLoading(false)
  }

  const monthReport = useMemo(
    () => buildMonthReport({ year, month, employees, apps, hours, holidayDates, workWeek }),
    [year, month, employees, apps, hours, holidayDates, workWeek]
  )
  const yearReport = useMemo(
    () => buildYearReport({ year, employees, apps, hours, holidayDates, workWeek }),
    [year, employees, apps, hours, holidayDates, workWeek]
  )

  const { ym } = monthBounds(year, month)
  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`

  function shiftMonth(delta: number) {
    let m = month + delta
    let y = year
    if (m < 1) { m = 12; y -= 1 }
    if (m > 12) { m = 1; y += 1 }
    setMonth(m)
    setYear(y)
  }

  function goToday() {
    setYear(THIS_YEAR)
    setMonth(new Date().getMonth() + 1)
  }

  function handleExport() {
    if (view === 'month') {
      const rows: (string | number)[][] = []
      for (const r of monthReport.fullTime) {
        rows.push([r.emp.employee_no ?? '', r.emp.full_name, 'Full-time', r.annual, r.medical, r.unpaid, r.other, '', r.lines.map((l) => lineText(l, ym)).filter(Boolean).join('; ')])
      }
      for (const r of monthReport.partTime) {
        rows.push([r.emp.employee_no ?? '', r.emp.full_name, 'Part-time', '', '', '', '', r.hours ?? 'Not entered', ''])
      }
      exportCsv(
        `report-${ym}.csv`,
        ['Employee No', 'Name', 'Type', 'Annual days', 'MC days', 'Unpaid days', 'Maternity/Paternity days', 'Hours', 'Details'],
        rows
      )
    } else {
      const rows: (string | number)[][] = yearReport.fullTime.map((r) => [
        r.emp.employee_no ?? '', r.emp.full_name, r.alEntitled, r.bf, r.alTaken, r.alBalance, r.mcTaken, r.mcEntitled, r.unpaid, r.other,
      ])
      exportCsv(
        `balances-${year}.csv`,
        ['Employee No', 'Name', 'Annual entitled', 'B/F', 'Annual taken', 'Annual balance', 'MC taken', 'MC entitled', 'Unpaid days', 'Maternity/Paternity days'],
        rows
      )
    }
  }

  if (auth.status !== 'ready') return <AuthStatus state={auth} />

  const th = 'px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-ink-faint whitespace-nowrap'
  const tdNum = 'px-3 py-2.5 text-center tabular-nums text-sm text-ink-soft align-top'
  const name = (e: ReportEmployee) => (
    <>
      {e.full_name}
      {!e.is_active && <span className="ml-2 rounded bg-paper px-1.5 py-0.5 text-[10px] font-normal text-ink-faint ring-1 ring-line">inactive</span>}
    </>
  )

  const ftRows = onlyWithLeave ? monthReport.fullTime.filter((r) => r.lines.length > 0) : monthReport.fullTime
  const t = monthReport.totals

  return (
    <ManagerShell>
      <div className="space-y-5 pb-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">Reports</h1>
            <p className="mt-0.5 text-sm text-ink-soft">
              {view === 'month' ? `Leave & hours for ${monthLabel}` : `Leave balances for ${year}`}
            </p>
          </div>
          <div className="flex gap-2 print:hidden">
            <button onClick={handleExport} disabled={loading} className="btn-ghost">Export CSV</button>
            <button onClick={() => window.print()} disabled={loading} className="btn-ghost">Print</button>
          </div>
        </div>

        {/* ── 控制列 ── */}
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <div className="flex rounded-lg border border-line p-0.5">
            {([['month', 'Month'], ['year', 'Year balances']] as [View, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors ${view === key ? 'bg-pine text-white' : 'text-ink-soft hover:text-ink'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {view === 'month' ? (
            <div className="flex items-center gap-1.5">
              <button onClick={() => shiftMonth(-1)} className="btn-ghost px-2.5" aria-label="Previous month">‹</button>
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="field-input w-auto">
                {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="field-input w-auto">
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <button onClick={() => shiftMonth(1)} className="btn-ghost px-2.5" aria-label="Next month">›</button>
              <button onClick={goToday} className="btn-ghost">This month</button>
            </div>
          ) : (
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="field-input w-auto">
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
        </div>

        {loadError && <p className="rounded-md bg-rust-soft p-3 text-sm text-rust">{loadError}</p>}

        {loading ? (
          <p className="py-10 text-center text-sm text-ink-soft">Loading...</p>
        ) : view === 'month' ? (
          <>
            {/* ── 摘要:算薪水最关心的三个数字 ── */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="panel border-rust/30 bg-rust-soft/30 py-3">
                <p className="text-xs text-ink-soft">Unpaid leave (deduct from pay)</p>
                <p className="mt-0.5 text-2xl font-semibold text-rust">
                  {fmt(t.unpaid)} <span className="text-sm font-normal">days</span>
                </p>
                <p className="text-xs text-ink-faint">{t.unpaidStaff} staff</p>
              </div>
              <div className="panel py-3">
                <p className="text-xs text-ink-soft">Medical leave (MC, paid)</p>
                <p className="mt-0.5 text-2xl font-semibold text-ink">{fmt(t.medical)} <span className="text-sm font-normal text-ink-faint">days</span></p>
              </div>
              <div className="panel py-3">
                <p className="text-xs text-ink-soft">Part-time hours</p>
                <p className="mt-0.5 text-2xl font-semibold text-ink">{fmt(t.hours)} <span className="text-sm font-normal text-ink-faint">hrs</span></p>
              </div>
            </div>

            {/* ── 提醒:有哪些东西"还没算进去 / 还没处理" ── */}
            {monthReport.pendingCount > 0 && (
              <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 print:border print:border-amber-300">
                <strong>{monthReport.pendingCount}</strong> leave application{monthReport.pendingCount > 1 ? 's' : ''} in {monthLabel} {monthReport.pendingCount > 1 ? 'are' : 'is'} still
                pending approval and <strong>not counted</strong> below.{' '}
                <Link href="/approve" className="underline print:hidden">Review in Approvals</Link>
              </p>
            )}
            {monthReport.cancellationCount > 0 && (
              <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 print:border print:border-amber-300">
                <strong>{monthReport.cancellationCount}</strong> approved leave {monthReport.cancellationCount > 1 ? 'have' : 'has'} a cancellation request waiting for a decision.
                {monthReport.cancellationCount > 1 ? ' They are' : ' It is'} still counted below until decided.{' '}
                <Link href="/approve" className="underline print:hidden">Review in Approvals</Link>
              </p>
            )}
            {monthReport.missingHoursCount > 0 && (
              <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 print:border print:border-amber-300">
                <strong>{monthReport.missingHoursCount}</strong> part-time staff have no hours entered for {monthLabel}.{' '}
                <Link href="/work-hours" className="underline print:hidden">Enter hours</Link>
              </p>
            )}

            {/* ── 全职 ── */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-base font-semibold text-ink">Full-time staff</h2>
                <label className="flex items-center gap-2 text-xs text-ink-soft print:hidden">
                  <input
                    type="checkbox"
                    checked={onlyWithLeave}
                    onChange={(e) => setOnlyWithLeave(e.target.checked)}
                    className="h-4 w-4 rounded border-line text-pine focus:ring-pine"
                  />
                  Only staff with leave this month
                </label>
              </div>
              {ftRows.length === 0 ? (
                <p className="rounded-lg border border-line py-8 text-center text-sm text-ink-faint">
                  {onlyWithLeave ? 'No staff took leave this month.' : 'No full-time staff.'}
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-line bg-surface">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line bg-paper">
                        <th className={`text-left ${th}`}>Employee</th>
                        <th className={`text-center ${th}`}>Annual</th>
                        <th className={`text-center ${th}`}>MC</th>
                        <th className={`text-center ${th} text-rust`}>Unpaid</th>
                        <th className={`text-center ${th}`}>Mat. / Pat.</th>
                        <th className={`text-left ${th}`}>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ftRows.map((r) => (
                        <tr key={r.emp.id} className={`border-b border-line align-top ${r.lines.length === 0 ? 'text-ink-faint' : ''}`}>
                          <td className="px-3 py-2.5 font-medium text-ink whitespace-nowrap">{name(r.emp)}</td>
                          <td className={tdNum}>{num(r.annual)}</td>
                          <td className={tdNum}>{num(r.medical)}</td>
                          <td className={`${tdNum} ${r.unpaid > 0 ? 'bg-rust-soft/40 font-semibold text-rust' : ''}`}>{num(r.unpaid)}</td>
                          <td className={tdNum}>{num(r.other)}</td>
                          <td className="px-3 py-2.5 text-xs text-ink-soft">
                            {(() => {
                              const details = r.lines.map((l) => lineText(l, ym)).filter((t): t is string => Boolean(t))
                              return details.length === 0 ? dash : details.map((d, i) => <div key={i}>{d}</div>)
                            })()}
                            {r.cancellationRequested && (
                              <span className="mt-1 inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700 ring-1 ring-amber-200">Cancellation requested</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-paper font-semibold text-ink">
                        <td className="px-3 py-2.5">Total</td>
                        <td className={tdNum}>{fmt(t.annual)}</td>
                        <td className={tdNum}>{fmt(t.medical)}</td>
                        <td className={`${tdNum} text-rust`}>{fmt(t.unpaid)}</td>
                        <td className={tdNum}>{fmt(t.other)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
              <p className="text-xs text-ink-faint">
                Approved leave only. Annual leave counts working days (weekends and public holidays excluded); MC, unpaid, maternity and paternity count calendar days.
                A leave that runs across two months is split — only the days inside {MONTH_NAMES[month - 1]} are counted.
              </p>
            </div>

            {/* ── 兼职 ── */}
            <div className="space-y-2">
              <h2 className="font-display text-base font-semibold text-ink">Part-time staff</h2>
              {monthReport.partTime.length === 0 ? (
                <p className="rounded-lg border border-line py-8 text-center text-sm text-ink-faint">No part-time staff.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-line bg-surface">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line bg-paper">
                        <th className={`text-left ${th}`}>Employee</th>
                        <th className={`text-right ${th}`}>Hours worked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthReport.partTime.map((r) => (
                        <tr key={r.emp.id} className="border-b border-line">
                          <td className="px-3 py-2.5 font-medium text-ink whitespace-nowrap">{name(r.emp)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {r.hours === null ? (
                              <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700 ring-1 ring-amber-200">Not entered</span>
                            ) : (
                              <span className="font-medium text-ink">{fmt(r.hours)} h</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-paper font-semibold text-ink">
                        <td className="px-3 py-2.5">Total</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{fmt(t.hours)} h</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* ── 年度余额 ── */}
            <div className="space-y-2">
              <h2 className="font-display text-base font-semibold text-ink">Full-time staff</h2>
              {yearReport.fullTime.length === 0 ? (
                <p className="rounded-lg border border-line py-8 text-center text-sm text-ink-faint">No full-time staff.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-line bg-surface">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line bg-paper">
                        <th className={`text-left ${th}`}>Employee</th>
                        <th className={`text-center ${th}`}>Entitled</th>
                        <th className={`text-center ${th}`}>B/F</th>
                        <th className={`text-center ${th}`}>Taken</th>
                        <th className={`text-center ${th}`}>Balance</th>
                        <th className={`text-center ${th}`}>MC taken</th>
                        <th className={`text-center ${th}`}>Unpaid</th>
                        <th className={`text-center ${th}`}>Mat. / Pat.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {yearReport.fullTime.map((r) => (
                        <tr key={r.emp.id} className={`border-b border-line ${r.alBalance < 0 ? 'bg-rust-soft/30' : ''}`}>
                          <td className="px-3 py-2.5 font-medium text-ink whitespace-nowrap">{name(r.emp)}</td>
                          <td className={tdNum}>
                            {fmt(r.alEntitled)}
                            {r.emp.annual_leave_entitlement_override != null && <span className="ml-1 text-[10px] text-ink-faint" title="Entitlement set manually">*</span>}
                          </td>
                          <td className={tdNum}>{fmt(r.bf)}</td>
                          <td className={tdNum}>
                            {fmt(r.alTaken)}
                            {r.alPending > 0 && (
                              <span className="block text-[10px] text-amber-600 font-normal">
                                ({fmt(r.alPending)} pending)
                              </span>
                            )}
                          </td>
                          <td className={`${tdNum} font-semibold ${r.alBalance < 0 ? 'text-rust' : 'text-ink'}`}>{fmt(r.alBalance)}</td>
                          <td className={tdNum}>{fmt(r.mcTaken)} <span className="text-ink-faint">/ {fmt(r.mcEntitled)}</span></td>
                          <td className={tdNum}>{num(r.unpaid)}</td>
                          <td className={tdNum}>{num(r.other)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-xs text-ink-faint">
                Annual balance = Entitled + B/F − Taken. Includes pending applications (same as what staff see on their dashboard).
                B/F only applies to the current year. * = entitlement set manually in Manage.
              </p>
            </div>

            <div className="space-y-2">
              <h2 className="font-display text-base font-semibold text-ink">Part-time staff</h2>
              {yearReport.partTime.length === 0 ? (
                <p className="rounded-lg border border-line py-8 text-center text-sm text-ink-faint">No part-time staff.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-line bg-surface">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line bg-paper">
                        <th className={`text-left ${th}`}>Employee</th>
                        <th className={`text-center ${th}`}>Months entered</th>
                        <th className={`text-right ${th}`}>Total hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {yearReport.partTime.map((r) => (
                        <tr key={r.emp.id} className="border-b border-line">
                          <td className="px-3 py-2.5 font-medium text-ink whitespace-nowrap">{name(r.emp)}</td>
                          <td className={tdNum}>{r.monthsEntered}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-medium text-ink">{fmt(r.totalHours)} h</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </ManagerShell>
  )
}
