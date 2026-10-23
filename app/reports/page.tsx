'use client'

import MobileReports from '@/components/manager/MobileReports'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
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
//
// 排版规则:
//  · 手机(<768px):全职员工用"一人一张卡片";电脑(≥768px):用表格。
//  · 同一份资料,两种排法都渲染,用 md:hidden / hidden md:block 切换。

const THIS_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 4 }, (_, i) => THIS_YEAR - 2 + i)
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const TYPE_LABEL: Record<string, string> = { annual: 'Annual', medical: 'MC', unpaid: 'Unpaid', maternity: 'Maternity', paternity: 'Paternity' }

type View = 'month' | 'year'

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
const dash = <span className="text-ink-faint/50">–</span>
const num = (n: number) => (n > 0 ? fmt(n) : dash)

function shortDate(iso?: string | null) {
  if (!iso || typeof iso !== 'string') return '–'
  const parts = iso.split('-')
  if (parts.length < 3) return iso
  const [, m, d] = parts
  return `${Number(d)} ${MONTH_SHORT[Number(m) - 1] || ''}`
}

function dateRange(a?: string | null, b?: string | null) {
  if (!a && !b) return '–'
  if (!a) return shortDate(b)
  if (!b || a === b) return shortDate(a)
  if (typeof a === 'string' && typeof b === 'string' && a.length >= 7 && b.length >= 7 && a.slice(0, 7) === b.slice(0, 7)) {
    return `${Number(a.slice(8))}–${shortDate(b)}`
  }
  return `${shortDate(a)} – ${shortDate(b)}`
}

function lineText(l: LeaveLine, ym: string): string | null {
  const a = l?.app
  if (!a) return null
  const label = TYPE_LABEL[a.leave_type] ?? a.leave_type ?? 'Leave'
  const isHistorical = a.remarks?.includes('Historical import')
  if (isHistorical) {
    if (a.leave_type === 'annual') return null
    let t = `${label} · ${fmt(l.days || 0)}d`
    if (a.is_half_day && a.half_day_period) t += ` (${String(a.half_day_period).toUpperCase()})`
    return t
  }
  let t = `${label} ${dateRange(a.start_date, a.end_date)}`
  if (a.is_half_day && a.half_day_period) t += ` (${String(a.half_day_period).toUpperCase()})`
  t += ` · ${fmt(l.days || 0)}d`
  const sDate = a.start_date || ''
  const eDate = a.end_date || ''
  if (sDate.slice(0, 7) !== ym || eDate.slice(0, 7) !== ym) t += ' (this month)'
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

// 手机卡片里的"一格数字":上面小标签,下面数字
function Stat({ label, tone, children }: { label: string; tone?: 'rust'; children: ReactNode }) {
  const rust = tone === 'rust'
  return (
    <div className={`rounded-md px-1 py-1.5 text-center ${rust ? 'bg-rust-soft/40' : 'bg-paper'}`}>
      <p className={`text-xs ${rust ? 'text-rust' : 'text-ink-faint'}`}>{label}</p>
      <p className={`mt-0.5 text-base font-semibold tabular-nums ${rust ? 'text-rust' : 'text-ink'}`}>{children}</p>
    </div>
  )
}

function DesktopReports() {
  const auth = useEmployee({ requireManager: true })

  const [view, setView] = useState<View>('month')
  const [scope, setScope] = useState<'ft' | 'pt' | 'all'>('ft')
  const [year, setYear] = useState(THIS_YEAR)
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [filter, setFilter] = useState<'all' | 'leave' | 'unpaid' | 'mc'>('all')
  const [yearFilter, setYearFilter] = useState<'all' | 'overdrawn' | 'mc'>('all')

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [employees, setEmployees] = useState<ReportEmployee[]>([])
  const [apps, setApps] = useState<ReportApp[]>([])
  const [hours, setHours] = useState<HoursRow[]>([])
  const [holidayDates, setHolidayDates] = useState<string[]>([])
  const [workWeek, setWorkWeek] = useState<WorkWeek>(DEFAULT_WORK_WEEK)

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
      (e) => e && e.role !== 'manager' && (e.full_name || '').toUpperCase() !== 'CHEW HONG YI'
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

  type FtRow = (typeof monthReport.fullTime)[number]

  const { ym } = monthBounds(year, month)
  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`
  const isCurrentMonth = year === THIS_YEAR && month === new Date().getMonth() + 1

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
      if (scope === 'ft' || scope === 'all') {
        for (const r of monthReport.fullTime) {
          rows.push([r.emp.employee_no ?? '', r.emp.full_name, 'Full-time', r.annual, r.medical, r.unpaid, r.other, '', r.lines.map((l) => lineText(l, ym)).filter(Boolean).join('; ')])
        }
      }
      if (scope === 'pt' || scope === 'all') {
        for (const r of monthReport.partTime) {
          rows.push([r.emp.employee_no ?? '', r.emp.full_name, 'Part-time', '', '', '', '', r.hours ?? 'Not entered', ''])
        }
      }
      exportCsv(
        `report-${ym}-${scope}.csv`,
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

  const ftRows = useMemo(() => {
    return monthReport.fullTime.filter((r) => {
      if (filter === 'leave') return r.annual + r.medical + r.unpaid + r.other > 0 || r.lines.length > 0
      if (filter === 'unpaid') return r.unpaid > 0
      if (filter === 'mc') return r.medical > 0
      return true
    })
  }, [monthReport.fullTime, filter])

  const ftYearRows = useMemo(() => {
    return yearReport.fullTime.filter((r) => {
      if (yearFilter === 'overdrawn') return r.alBalance < 0
      if (yearFilter === 'mc') return r.mcTaken > 0
      return true
    })
  }, [yearReport.fullTime, yearFilter])

  if (auth.status !== 'ready') return <AuthStatus state={auth} />

  const th = 'px-3.5 py-3 text-[13px] font-medium text-ink-faint whitespace-nowrap bg-paper border-b border-line'
  const tdNum = 'px-3.5 py-3 text-center tabular-nums text-sm text-ink-soft align-middle'
  const emptyBox = 'rounded-xl border border-line py-10 text-center text-sm text-ink-faint bg-surface'
  const notice = 'rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-sm text-amber-800'

  const name = (e: ReportEmployee) => (
    <div className="flex items-center gap-2">
      <span className="font-semibold text-ink">{e.full_name}</span>
      {e.employee_no && (
        <span className="text-xs text-ink-faint font-normal">#{e.employee_no}</span>
      )}
      {!e.is_active && (
        <span className="rounded bg-paper px-1.5 py-0.5 text-[11px] font-normal text-ink-faint ring-1 ring-line">inactive</span>
      )}
    </div>
  )

  const detailsOf = (r: FtRow) => r.lines.map((l) => lineText(l, ym)).filter((x): x is string => Boolean(x))
  const t = monthReport.totals

  const ftCount = employees.filter((e) => e.employment_type === 'full_time').length
  const ptCount = employees.filter((e) => e.employment_type === 'part_time').length

  return (
    <ManagerShell>
      <div className="space-y-6 pb-12">
        {/* ── 标题 + 导出操作 ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">Reports</h1>
            <p className="mt-0.5 text-sm text-ink-soft">
              {view === 'month' ? `Monthly leave & work hours breakdown · ${monthLabel}` : `Annual leave balance ledger · ${year}`}
            </p>
          </div>
          <div className="flex shrink-0 gap-2 print:hidden">
            <button onClick={handleExport} disabled={loading} className="btn-ghost shadow-xs">Export CSV</button>
            <button onClick={() => window.print()} disabled={loading} className="btn-ghost hidden sm:inline-flex shadow-xs">Print</button>
          </div>
        </div>

        {/* ── 控制列 (钉钉企业排版: 日期控制 + 全职兼职分离) ── */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between print:hidden">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* 月度 / 年度 视图切换 */}
            <div className="flex rounded-xl border border-line bg-paper p-0.5 shadow-2xs">
              {([['month', 'Month View'], ['year', 'Year Balances']] as [View, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setView(key)}
                  className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-all ${
                    view === key ? 'bg-pine text-white shadow-xs' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* 日期选择器 */}
            {view === 'month' ? (
              <div className="flex items-center gap-1.5">
                <button onClick={() => shiftMonth(-1)} className="btn-ghost px-2.5 py-1.5" aria-label="Previous month">‹</button>
                <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="field-input py-1.5 text-sm font-medium">
                  {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
                <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="field-input py-1.5 w-24 text-sm font-medium">
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <button onClick={() => shiftMonth(1)} className="btn-ghost px-2.5 py-1.5" aria-label="Next month">›</button>
                {!isCurrentMonth && (
                  <button onClick={goToday} className="btn-ghost py-1.5 text-xs font-medium">This month</button>
                )}
              </div>
            ) : (
              <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="field-input py-1.5 w-32 text-sm font-medium">
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
          </div>

          {/* 全职 / 兼职 分离控件 (满足用户强烈要求的分类切换) */}
          <div className="flex rounded-xl border border-line bg-paper p-0.5 shadow-2xs">
            <button
              onClick={() => setScope('ft')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                scope === 'ft' ? 'bg-white text-ink shadow-xs border border-line' : 'text-ink-soft hover:text-ink'
              }`}
            >
              <span>Full-time</span>
              <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${scope === 'ft' ? 'bg-pine/10 text-pine' : 'bg-gray-200/70 text-gray-500'}`}>
                {ftCount}
              </span>
            </button>
            <button
              onClick={() => setScope('pt')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                scope === 'pt' ? 'bg-white text-ink shadow-xs border border-line' : 'text-ink-soft hover:text-ink'
              }`}
            >
              <span>Part-time</span>
              <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${scope === 'pt' ? 'bg-pine/10 text-pine' : 'bg-gray-200/70 text-gray-500'}`}>
                {ptCount}
              </span>
            </button>
            <button
              onClick={() => setScope('all')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                scope === 'all' ? 'bg-white text-ink shadow-xs border border-line' : 'text-ink-soft hover:text-ink'
              }`}
            >
              All staff
            </button>
          </div>
        </div>

        {loadError && <p className="rounded-xl bg-rust-soft p-4 text-sm text-rust">{loadError}</p>}

        {loading ? (
          <p className="py-16 text-center text-sm text-ink-soft">Loading report data...</p>
        ) : view === 'month' ? (
          <>
            {/* ── 核心指标摘要面板 (钉钉高对比度卡片) ── */}
            {scope === 'ft' && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* 无薪假: 扣薪重点，红底强调 */}
                <div className="rounded-xl border border-red-200 bg-gradient-to-br from-[#FFF1F0] to-white p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-red-700">Unpaid Leave</span>
                    <span className="rounded-md bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">Deduct pay</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-rust">
                    {fmt(t.unpaid)} <span className="text-sm font-normal text-red-600">days</span>
                  </p>
                  <p className="mt-1 text-xs text-red-600/80">{t.unpaidStaff} staff affected</p>
                </div>

                {/* 带薪病假 */}
                <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-[#FFFBE6] to-white p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-800">Medical Leave (MC)</span>
                    <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Paid</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-amber-800">
                    {fmt(t.medical)} <span className="text-sm font-normal text-amber-700">days</span>
                  </p>
                  <p className="mt-1 text-xs text-amber-700/80">{monthReport.fullTime.filter((r) => r.medical > 0).length} staff</p>
                </div>

                {/* 年假 */}
                <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-[#E6F4FF] to-white p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-blue-800">Annual Leave</span>
                    <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">Working days</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-blue-800">
                    {fmt(t.annual)} <span className="text-sm font-normal text-blue-700">days</span>
                  </p>
                  <p className="mt-1 text-xs text-blue-700/80">{monthReport.fullTime.filter((r) => r.annual > 0).length} staff</p>
                </div>

                {/* 产假 / 陪产假 */}
                <div className="rounded-xl border border-purple-200 bg-gradient-to-br from-[#F9F0FF] to-white p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-purple-800">Maternity / Paternity</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-purple-800">
                    {fmt(t.other)} <span className="text-sm font-normal text-purple-700">days</span>
                  </p>
                  <p className="mt-1 text-xs text-purple-700/80">{monthReport.fullTime.filter((r) => r.other > 0).length} staff</p>
                </div>
              </div>
            )}

            {scope === 'pt' && (
              <div className="grid grid-cols-2 gap-3.5">
                <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-[#E6F4FF] to-white p-5 shadow-xs">
                  <p className="text-xs font-semibold text-blue-800">Total Part-time Hours</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums text-ink">
                    {fmt(t.hours)} <span className="text-base font-normal text-ink-soft">hours</span>
                  </p>
                  <p className="mt-1 text-xs text-ink-faint">{monthReport.partTime.length} staff enrolled</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-[#FFFBE6] p-5 shadow-xs">
                  <p className="text-xs font-semibold text-amber-800">Missing Hours Warning</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums text-amber-700">
                    {monthReport.missingHoursCount} <span className="text-base font-normal text-amber-600">staff</span>
                  </p>
                  <Link href="/work-hours" className="mt-1 inline-flex items-center text-xs font-semibold text-brand hover:underline">
                    Enter hours in Work Hours &rarr;
                  </Link>
                </div>
              </div>
            )}

            {scope === 'all' && (
              <div className="grid grid-cols-3 gap-3.5">
                <div className="rounded-xl border border-red-200 bg-[#FFF1F0] p-4 shadow-xs">
                  <p className="text-xs font-semibold text-red-700">Unpaid Leave</p>
                  <p className="mt-1.5 text-2xl font-bold tabular-nums text-rust">{fmt(t.unpaid)} <span className="text-xs font-normal">days</span></p>
                  <p className="text-xs text-red-600/80">{t.unpaidStaff} staff</p>
                </div>
                <div className="rounded-xl border border-blue-200 bg-[#E6F4FF] p-4 shadow-xs">
                  <p className="text-xs font-semibold text-blue-800">Medical Leave (MC)</p>
                  <p className="mt-1.5 text-2xl font-bold tabular-nums text-blue-900">{fmt(t.medical)} <span className="text-xs font-normal">days</span></p>
                  <p className="text-xs text-blue-700/80">Paid leave</p>
                </div>
                <div className="rounded-xl border border-purple-200 bg-[#F9F0FF] p-4 shadow-xs">
                  <p className="text-xs font-semibold text-purple-800">Part-time Hours</p>
                  <p className="mt-1.5 text-2xl font-bold tabular-nums text-purple-900">{fmt(t.hours)} <span className="text-xs font-normal">hrs</span></p>
                  <p className="text-xs text-purple-700/80">{monthReport.partTime.length} staff</p>
                </div>
              </div>
            )}

            {/* ── 待办提醒通知 ── */}
            {monthReport.pendingCount > 0 && (
              <p className={notice}>
                <strong>{monthReport.pendingCount}</strong> leave application{monthReport.pendingCount > 1 ? 's' : ''} in {monthLabel} {monthReport.pendingCount > 1 ? 'are' : 'is'} still
                pending approval and <strong>not counted</strong> below.{' '}
                <Link href="/approve" className="font-semibold underline print:hidden">Review in Approvals</Link>
              </p>
            )}
            {monthReport.cancellationCount > 0 && (
              <p className={notice}>
                <strong>{monthReport.cancellationCount}</strong> approved leave {monthReport.cancellationCount > 1 ? 'have' : 'has'} a cancellation request waiting for a decision.
                {monthReport.cancellationCount > 1 ? ' They are' : ' It is'} still counted below until decided.{' '}
                <Link href="/approve" className="font-semibold underline print:hidden">Review in Approvals</Link>
              </p>
            )}
            {monthReport.missingHoursCount > 0 && (scope === 'pt' || scope === 'all') && (
              <p className={notice}>
                <strong>{monthReport.missingHoursCount}</strong> part-time staff have no hours entered for {monthLabel}.{' '}
                <Link href="/work-hours" className="font-semibold underline print:hidden">Enter hours</Link>
              </p>
            )}

            {/* ── 全职员工表格 ── */}
            {(scope === 'ft' || scope === 'all') && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-base font-semibold text-ink">Full-time staff</h2>
                    <span className="text-xs text-ink-faint">({ftRows.length})</span>
                  </div>

                  {/* 快捷过滤芯片按钮组 */}
                  <div className="flex items-center gap-1.5 print:hidden">
                    <button
                      onClick={() => setFilter('all')}
                      className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                        filter === 'all' ? 'bg-ink text-white shadow-xs' : 'bg-paper text-ink-soft hover:bg-gray-200'
                      }`}
                    >
                      All ({monthReport.fullTime.length})
                    </button>
                    <button
                      onClick={() => setFilter('leave')}
                      className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                        filter === 'leave' ? 'bg-pine text-white shadow-xs' : 'bg-paper text-ink-soft hover:bg-gray-200'
                      }`}
                    >
                      With leave ({monthReport.fullTime.filter((r) => r.annual + r.medical + r.unpaid + r.other > 0 || r.lines.length > 0).length})
                    </button>
                    {t.unpaid > 0 && (
                      <button
                        onClick={() => setFilter('unpaid')}
                        className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                          filter === 'unpaid' ? 'bg-rust text-white shadow-xs' : 'border border-rust/30 bg-rust-soft/40 text-rust hover:bg-rust-soft'
                        }`}
                      >
                        Unpaid ({monthReport.fullTime.filter((r) => r.unpaid > 0).length})
                      </button>
                    )}
                    {t.medical > 0 && (
                      <button
                        onClick={() => setFilter('mc')}
                        className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                          filter === 'mc' ? 'bg-amber-600 text-white shadow-xs' : 'border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                        }`}
                      >
                        MC ({monthReport.fullTime.filter((r) => r.medical > 0).length})
                      </button>
                    )}
                  </div>
                </div>

                {ftRows.length === 0 ? (
                  <p className={emptyBox}>
                    {filter === 'all' ? 'No full-time staff.' : 'No staff matched the selected filter.'}
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th className={`text-left ${th}`}>Employee</th>
                          <th className={`text-center ${th}`}>Annual</th>
                          <th className={`text-center ${th}`}>MC</th>
                          <th className={`text-center ${th} text-rust`}>Unpaid</th>
                          <th className={`text-center ${th}`}>Mat. / Pat.</th>
                          <th className={`text-left ${th}`}>Details & Dates</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {ftRows.map((r) => {
                          const details = detailsOf(r)
                          const hasLeave = r.lines.length > 0 || r.annual + r.medical + r.unpaid + r.other > 0

                          return (
                            <tr
                              key={r.emp.id}
                              className={`transition-colors hover:bg-paper/40 ${!hasLeave ? 'opacity-70 hover:opacity-100' : ''}`}
                            >
                              <td className="px-3.5 py-3.5 whitespace-nowrap align-middle">
                                {name(r.emp)}
                              </td>
                              <td className={tdNum}>
                                {r.annual > 0 ? (
                                  <span className="inline-flex items-center rounded-md border border-blue-100 bg-blue-50 px-2.5 py-0.5 font-bold text-blue-800">
                                    {fmt(r.annual)}
                                  </span>
                                ) : (
                                  dash
                                )}
                              </td>
                              <td className={tdNum}>
                                {r.medical > 0 ? (
                                  <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2.5 py-0.5 font-bold text-amber-800">
                                    {fmt(r.medical)}
                                  </span>
                                ) : (
                                  dash
                                )}
                              </td>
                              <td className={tdNum}>
                                {r.unpaid > 0 ? (
                                  <span className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-2.5 py-0.5 font-bold text-rust">
                                    {fmt(r.unpaid)}
                                  </span>
                                ) : (
                                  dash
                                )}
                              </td>
                              <td className={tdNum}>
                                {r.other > 0 ? (
                                  <span className="inline-flex items-center rounded-md border border-purple-200 bg-purple-50 px-2.5 py-0.5 font-bold text-purple-800">
                                    {fmt(r.other)}
                                  </span>
                                ) : (
                                  dash
                                )}
                              </td>
                              <td className="px-3.5 py-3.5 text-xs text-ink-soft align-middle">
                                {details.length === 0 ? (
                                  <span className="text-ink-faint">No leave taken</span>
                                ) : (
                                  <ul className="space-y-1">
                                    {details.map((d, i) => (
                                      <li key={i} className="flex items-center gap-1.5 font-medium text-ink">
                                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-pine" />
                                        <span>{d}</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                {r.cancellationRequested && (
                                  <span className="mt-1 inline-block rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                                    Cancellation requested
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-paper font-semibold text-ink border-t-2 border-line">
                          <td className="px-3.5 py-3.5">Total ({ftRows.length})</td>
                          <td className={tdNum}>{fmt(t.annual)}</td>
                          <td className={tdNum}>{fmt(t.medical)}</td>
                          <td className={`${tdNum} text-rust font-bold`}>{fmt(t.unpaid)}</td>
                          <td className={tdNum}>{fmt(t.other)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
                <p className="text-xs leading-relaxed text-ink-faint">
                  Approved leave only. Annual leave counts working days (weekends and public holidays excluded); MC, unpaid, maternity and paternity count calendar days.
                </p>
              </div>
            )}

            {/* ── 兼职员工表格 ── */}
            {(scope === 'pt' || scope === 'all') && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-base font-semibold text-ink">Part-time staff</h2>
                    <span className="text-xs text-ink-faint">({monthReport.partTime.length})</span>
                  </div>
                  <Link href="/work-hours" className="text-xs font-semibold text-brand hover:underline">
                    Enter hours in Work Hours &rarr;
                  </Link>
                </div>

                {monthReport.partTime.length === 0 ? (
                  <p className={emptyBox}>No part-time staff.</p>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th className={`text-left ${th}`}>Employee</th>
                          <th className={`text-right ${th}`}>Hours Worked</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {monthReport.partTime.map((r) => (
                          <tr key={r.emp.id} className="transition-colors hover:bg-paper/40">
                            <td className="px-3.5 py-3 font-medium text-ink">{name(r.emp)}</td>
                            <td className="px-3.5 py-3 text-right tabular-nums">
                              {r.hours === null ? (
                                <span className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                                  Not entered
                                </span>
                              ) : (
                                <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-sm font-bold text-emerald-800">
                                  {fmt(r.hours)} h
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-paper font-semibold text-ink border-t-2 border-line">
                          <td className="px-3.5 py-3">Total</td>
                          <td className="px-3.5 py-3 text-right tabular-nums text-base font-bold text-ink">{fmt(t.hours)} h</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          /* ── 年度余额视图 ── */
          <>
            {(scope === 'ft' || scope === 'all') && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-base font-semibold text-ink">Full-time staff · Annual Ledger</h2>
                    <span className="text-xs text-ink-faint">({ftYearRows.length})</span>
                  </div>

                  <div className="flex items-center gap-1.5 print:hidden">
                    <button
                      onClick={() => setYearFilter('all')}
                      className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                        yearFilter === 'all' ? 'bg-ink text-white shadow-xs' : 'bg-paper text-ink-soft hover:bg-gray-200'
                      }`}
                    >
                      All ({yearReport.fullTime.length})
                    </button>
                    <button
                      onClick={() => setYearFilter('overdrawn')}
                      className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                        yearFilter === 'overdrawn' ? 'bg-rust text-white shadow-xs' : 'border border-rust/30 bg-rust-soft/40 text-rust hover:bg-rust-soft'
                      }`}
                    >
                      Overdrawn ({yearReport.fullTime.filter((r) => r.alBalance < 0).length})
                    </button>
                    <button
                      onClick={() => setYearFilter('mc')}
                      className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                        yearFilter === 'mc' ? 'bg-amber-600 text-white shadow-xs' : 'border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                      }`}
                    >
                      With MC ({yearReport.fullTime.filter((r) => r.mcTaken > 0).length})
                    </button>
                  </div>
                </div>

                {ftYearRows.length === 0 ? (
                  <p className={emptyBox}>No staff matched the selected filter.</p>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th className={`text-left ${th}`}>Employee</th>
                          <th className={`text-center ${th}`}>Entitled</th>
                          <th className={`text-center ${th}`}>B/F</th>
                          <th className={`text-center ${th}`}>Taken</th>
                          <th className={`text-center ${th}`}>Annual Balance</th>
                          <th className={`text-center ${th}`}>MC Taken</th>
                          <th className={`text-center ${th}`}>Unpaid</th>
                          <th className={`text-center ${th}`}>Mat. / Pat.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {ftYearRows.map((r) => (
                          <tr key={r.emp.id} className={`transition-colors hover:bg-paper/40 ${r.alBalance < 0 ? 'bg-red-50/40' : ''}`}>
                            <td className="px-3.5 py-3 font-medium text-ink whitespace-nowrap">{name(r.emp)}</td>
                            <td className={tdNum}>
                              {fmt(r.alEntitled)}
                              {r.emp.annual_leave_entitlement_override != null && <span className="ml-1 text-xs text-ink-faint font-normal" title="Entitlement set manually">*</span>}
                            </td>
                            <td className={tdNum}>{fmt(r.bf)}</td>
                            <td className={tdNum}>
                              {fmt(r.alTaken)}
                              {r.alPending > 0 && (
                                <span className="block text-xs font-normal text-amber-600">
                                  ({fmt(r.alPending)} pending)
                                </span>
                              )}
                            </td>
                            <td className={tdNum}>
                              {r.alBalance < 0 ? (
                                <span className="inline-flex items-center rounded-md border border-red-200 bg-red-100 px-2 py-0.5 font-bold text-rust">
                                  {fmt(r.alBalance)} (Overdrawn)
                                </span>
                              ) : (
                                <span className="font-bold text-pine">
                                  {fmt(r.alBalance)}
                                </span>
                              )}
                            </td>
                            <td className={tdNum}>{fmt(r.mcTaken)} <span className="text-ink-faint">/ {fmt(r.mcEntitled)}</span></td>
                            <td className={tdNum}>{num(r.unpaid)}</td>
                            <td className={tdNum}>{num(r.other)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="text-xs leading-relaxed text-ink-faint">
                  Annual balance = Entitled + B/F − Taken. Includes pending applications (same as what staff see on their dashboard).
                </p>
              </div>
            )}

            {(scope === 'pt' || scope === 'all') && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-base font-semibold text-ink">Part-time staff · Annual Summary</h2>
                    <span className="text-xs text-ink-faint">({yearReport.partTime.length})</span>
                  </div>
                </div>

                {yearReport.partTime.length === 0 ? (
                  <p className={emptyBox}>No part-time staff.</p>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th className={`text-left ${th}`}>Employee</th>
                          <th className={`text-center ${th}`}>Months Entered</th>
                          <th className={`text-right ${th}`}>Total Hours</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {yearReport.partTime.map((r) => (
                          <tr key={r.emp.id} className="transition-colors hover:bg-paper/40">
                            <td className="px-3.5 py-3 font-medium text-ink">{name(r.emp)}</td>
                            <td className={tdNum}>{r.monthsEntered}</td>
                            <td className="px-3.5 py-3 text-right tabular-nums font-bold text-ink">{fmt(r.totalHours)} h</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </ManagerShell>
  )
}

// 手机(< md)用钉钉风格的新版页面;电脑(≥ md)保持原来的版面。
export default function ReportsPage() {
  return (
    <>
      <div className="md:hidden">
        <MobileReports />
      </div>
      <div className="hidden md:block">
        <DesktopReports />
      </div>
    </>
  )
}
