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
import { useLang, leaveTypeName } from '@/lib/lang'
import { useEmployee } from '@/lib/useEmployee'
import AuthStatus from '@/components/AuthStatus'
import PageHeader, { DefaultButton } from '@/components/PageHeader'
import { UnderlineTabs } from '@/components/employee/EmployeeShell'

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

function getInitials(name: string) {
  if (!name) return 'U'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function MagnifierIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`h-3.5 w-3.5 shrink-0 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  )
}

// 年假余额可视化进度条
function LeaveProgressBar({ taken, entitled, bf, lang }: { taken: number; entitled: number; bf: number; lang?: string }) {
  const total = entitled + bf
  if (total <= 0) return <span className="text-ink-faint tabular-nums">—</span>
  const balance = total - taken
  const pct = Math.min(Math.round((taken / total) * 100), 100)
  const overdrawn = balance < 0

  return (
    <div className="min-w-[110px]">
      <div className="flex items-baseline justify-between gap-1 mb-1">
        <span className={`text-xs font-bold tabular-nums leading-none ${overdrawn ? 'text-st-rejected-text' : 'text-pine'}`}>
          {overdrawn ? `${balance}d` : `${balance}d`}
        </span>
        <span className="text-[10px] text-ink-faint tabular-nums">{taken}/{total}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-line overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${overdrawn ? 'bg-st-rejected' : pct >= 80 ? 'bg-amber-400' : 'bg-pine'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {overdrawn && (
        <span className="mt-0.5 inline-block text-[10px] font-semibold text-st-rejected-text">{lang === 'ms' ? 'Terlebih Had' : lang === 'zh' ? '透支' : 'Overdrawn'}</span>
      )}
    </div>
  )
}

// 数据卡: 钉钉高质感白底卡片, 带轻微阴影与小圆角
function StatCard({
  label, value, unit, hint, dot, tag, valueClass = 'text-ink',
}: {
  label: string
  value: ReactNode
  unit?: string
  hint?: ReactNode
  dot: string
  tag?: ReactNode
  valueClass?: string
}) {
  return (
    <div className="rounded-xl border border-line bg-white p-5 shadow-2xs transition hover:shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-medium text-ink-soft">
          <span className={`h-2 w-2 rounded-full ${dot}`} />
          {label}
        </span>
        {tag}
      </div>
      <p className={`mt-3 font-mono text-2xl font-bold leading-none tabular-nums ${valueClass}`}>
        {value}
        {unit && <span className="ml-1.5 font-sans text-xs font-normal text-ink-faint">{unit}</span>}
      </p>
      {hint && <div className="mt-3 text-xs text-ink-faint">{hint}</div>}
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
  const [searchQuery, setSearchQuery] = useState('')
  const { lang, t } = useLang()
  const [hideNoLeave, setHideNoLeave] = useState(false)

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
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchName = r.emp.full_name.toLowerCase().includes(q)
        const matchNo = r.emp.employee_no ? String(r.emp.employee_no).includes(q) : false
        if (!matchName && !matchNo) return false
      }
      if (hideNoLeave && r.annual + r.medical + r.unpaid + r.other === 0 && r.lines.length === 0) return false
      if (filter === 'leave') return r.annual + r.medical + r.unpaid + r.other > 0 || r.lines.length > 0
      if (filter === 'unpaid') return r.unpaid > 0
      if (filter === 'mc') return r.medical > 0
      return true
    })
  }, [monthReport.fullTime, filter, searchQuery, hideNoLeave])

  const ptRows = useMemo(() => {
    return monthReport.partTime.filter((r) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchName = r.emp.full_name.toLowerCase().includes(q)
        const matchNo = r.emp.employee_no ? String(r.emp.employee_no).includes(q) : false
        if (!matchName && !matchNo) return false
      }
      return true
    })
  }, [monthReport.partTime, searchQuery])

  const ftYearRows = useMemo(() => {
    return yearReport.fullTime.filter((r) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchName = r.emp.full_name.toLowerCase().includes(q)
        const matchNo = r.emp.employee_no ? String(r.emp.employee_no).includes(q) : false
        if (!matchName && !matchNo) return false
      }
      if (yearFilter === 'overdrawn') return r.alBalance < 0
      if (yearFilter === 'mc') return r.mcTaken > 0
      return true
    })
  }, [yearReport.fullTime, yearFilter, searchQuery])

  const ptYearRows = useMemo(() => {
    return yearReport.partTime.filter((r) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchName = r.emp.full_name.toLowerCase().includes(q)
        const matchNo = r.emp.employee_no ? String(r.emp.employee_no).includes(q) : false
        if (!matchName && !matchNo) return false
      }
      return true
    })
  }, [yearReport.partTime, searchQuery])

  if (auth.status !== 'ready') return <AuthStatus state={auth} />

  const th = 'px-3.5 py-2.5 text-xs font-semibold text-ink-soft whitespace-nowrap bg-[#FAFAFA] border-b border-line'
  const tdNum = 'px-3.5 py-3 text-center tabular-nums text-xs text-ink-soft align-middle font-mono'
  const emptyBox = 'rounded-xl border border-line py-12 text-center text-xs text-ink-faint bg-white'
  const notice = 'rounded-xl border border-st-pending/25 bg-st-pending-soft px-4 py-2.5 text-xs text-st-pending-text shadow-2xs'
  // 下拉框 / 方形小按钮 / 过滤标签:和审批页同一套尺寸(32px 高)
  const sel = 'h-8 rounded-lg border border-line bg-white px-2.5 text-xs text-ink transition-colors hover:border-pine focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/15'
  const sqBtn = 'flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-ink-soft transition-colors hover:border-pine hover:text-pine'
  const chip = 'rounded-lg px-3 py-1 text-xs transition-colors'
  const chipOn = 'bg-pine-soft font-semibold text-pine shadow-2xs'
  const chipOff = 'bg-paper text-ink-soft hover:text-ink'

  const name = (e: ReportEmployee) => {
    const initials = getInitials(e.full_name)
    return (
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pine/10 text-xs font-bold text-pine border border-pine/20">
          {initials}
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-ink text-xs">{e.full_name}</span>
            {e.employee_no && (
              <span className="rounded bg-paper px-1.5 py-0.5 text-[10px] font-mono text-ink-faint border border-line/60">
                #{e.employee_no}
              </span>
            )}
          </div>
          {!e.is_active && (
            <span className="mt-0.5 inline-block text-[10px] font-medium text-rust">{lang === 'ms' ? 'Akaun Dinyahaktifkan' : lang === 'zh' ? '已停用账号' : 'Inactive account'}</span>
          )}
        </div>
      </div>
    )
  }

  const detailsOf = (r: FtRow) => r.lines.map((l) => lineText(l, ym)).filter((x): x is string => Boolean(x))
  const totals = monthReport.totals

  const ftCount = employees.filter((e) => e.employment_type === 'full_time').length
  const ptCount = employees.filter((e) => e.employment_type === 'part_time').length

  return (
    <ManagerShell>
      <div className="mx-auto max-w-[1360px] space-y-4 pb-12">
        <PageHeader
          title="Reports"
          subtitle={view === 'month' ? `Monthly leave & work hours breakdown · ${monthLabel}` : `Annual leave balance ledger · ${year}`}
          actions={
            <div className="flex gap-2 print:hidden">
              <DefaultButton onClick={handleExport} disabled={loading}>Export CSV</DefaultButton>
              <DefaultButton onClick={() => window.print()} disabled={loading}>Print</DefaultButton>
            </div>
          }
        />

        {/* ── 视图标签 + 筛选条(和审批页同一种白色卡片)── */}
        <div className="overflow-hidden rounded-xl border border-line bg-white shadow-2xs print:hidden">
          <div className="border-b border-line px-3">
            <UnderlineTabs
              scroll
              value={view}
              onChange={setView}
              items={[
                { key: 'month' as const, label: lang === 'ms' ? 'Paparan Bulanan' : lang === 'zh' ? '月度明细' : 'Month View' },
                { key: 'year' as const, label: lang === 'ms' ? 'Baki Cuti Tahunan' : lang === 'zh' ? '年度总账' : 'Year Balances' },
              ]}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            {/* 日期选择 */}
            <div className="flex items-center gap-3">
              {view === 'month' ? (
                <div className="flex items-center gap-2">
                  <button onClick={() => shiftMonth(-1)} className={sqBtn} aria-label="Previous month">‹</button>
                  <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={`${sel} w-32`}>
                    {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </select>
                  <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={`${sel} w-24`}>
                    {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <button onClick={() => shiftMonth(1)} className={sqBtn} aria-label="Next month">›</button>
                  {!isCurrentMonth && (
                    <button onClick={goToday} className="ml-1 text-xs font-medium text-pine transition-colors hover:text-pine-deep">This month</button>
                  )}
                </div>
              ) : (
                <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={`${sel} w-32`}>
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              )}

              {/* 实时搜索框 */}
              <div className="relative">
                <MagnifierIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input
                  type="text"
                  placeholder={lang === 'ms' ? 'Cari nama atau No. Pekerja...' : lang === 'zh' ? '搜索姓名或工号...' : 'Search name or staff ID...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 w-40 sm:w-48 rounded-lg border border-line bg-surface pl-7 pr-6 text-xs text-ink placeholder:text-ink-faint focus:border-pine focus:outline-none focus:ring-1 focus:ring-pine/20"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-ink-faint hover:text-ink">✕</button>
                )}
              </div>
            </div>

            {/* 全职 / 兼职(和顶栏的中/EN 切换同一种样式)*/}
            <div className="flex rounded-lg bg-paper p-0.5 text-xs">
              {([
                ['ft', lang === 'ms' ? 'Sepenuh Masa' : lang === 'zh' ? '全职员工' : 'Full-time', ftCount],
                ['pt', lang === 'ms' ? 'Sambilan' : lang === 'zh' ? '兼职员工' : 'Part-time', ptCount],
                ['all', lang === 'ms' ? 'Semua' : lang === 'zh' ? '全员' : 'All staff', null],
              ] as [typeof scope, string, number | null][]).map(([key, label, n]) => (
                <button
                  key={key}
                  onClick={() => setScope(key)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors ${scope === key ? 'bg-white text-pine font-semibold shadow-2xs' : 'text-ink-soft hover:text-ink'}`}
                >
                  {label}
                  {n !== null && <span className={`text-[11px] font-mono tabular-nums ${scope === key ? 'text-pine' : 'text-ink-faint'}`}>{n}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loadError && <p className="rounded-md border border-rust/30 bg-rust-soft px-4 py-2.5 text-[13px] text-rust">{loadError}</p>}

        {loading ? (
          <p className="py-16 text-center text-sm text-ink-soft">Loading report data...</p>
        ) : view === 'month' ? (
          <>
            {/* ── 核心指标(白底扁平;只有"无薪假 > 0"时数字变红)── */}
            {scope === 'ft' && (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard
                  label="Unpaid Leave" dot="bg-st-rejected" unit="days"
                  value={fmt(totals.unpaid)}
                  valueClass={totals.unpaid > 0 ? 'text-st-rejected-text' : 'text-ink'}
                  tag={<span className="badge badge-rejected">Deduct pay</span>}
                  hint={`${totals.unpaidStaff} staff affected`}
                />
                <StatCard
                  label="Medical Leave (MC)" dot="bg-st-pending" unit="days"
                  value={fmt(totals.medical)}
                  tag={<span className="badge badge-approved">Paid</span>}
                  hint={`${monthReport.fullTime.filter((r) => r.medical > 0).length} staff`}
                />
                <StatCard
                  label="Annual Leave" dot="bg-brand" unit="days"
                  value={fmt(totals.annual)}
                  hint={`${monthReport.fullTime.filter((r) => r.annual > 0).length} staff · working days`}
                />
                <StatCard
                  label="Maternity / Paternity" dot="bg-leave-paternity" unit="days"
                  value={fmt(totals.other)}
                  hint={`${monthReport.fullTime.filter((r) => r.other > 0).length} staff`}
                />
              </div>
            )}

            {scope === 'pt' && (
              <div className="grid grid-cols-2 gap-4">
                <StatCard
                  label="Total Part-time Hours" dot="bg-brand" unit="hours"
                  value={fmt(totals.hours)}
                  hint={`${monthReport.partTime.length} staff enrolled`}
                />
                <StatCard
                  label="Missing Hours" dot="bg-st-pending" unit="staff"
                  value={monthReport.missingHoursCount}
                  valueClass={monthReport.missingHoursCount > 0 ? 'text-st-pending-text' : 'text-ink'}
                  hint={<Link href="/work-hours" className="text-pine transition-colors hover:text-pine-deep">Enter hours in Work Hours &rarr;</Link>}
                />
              </div>
            )}

            {scope === 'all' && (
              <div className="grid grid-cols-3 gap-4">
                <StatCard
                  label="Unpaid Leave" dot="bg-st-rejected" unit="days"
                  value={fmt(totals.unpaid)}
                  valueClass={totals.unpaid > 0 ? 'text-st-rejected-text' : 'text-ink'}
                  hint={`${totals.unpaidStaff} staff`}
                />
                <StatCard
                  label="Medical Leave (MC)" dot="bg-st-pending" unit="days"
                  value={fmt(totals.medical)}
                  hint="Paid leave"
                />
                <StatCard
                  label="Part-time Hours" dot="bg-brand" unit="hrs"
                  value={fmt(totals.hours)}
                  hint={`${monthReport.partTime.length} staff`}
                />
              </div>
            )}

            {/* ── 待办提醒通知 ── */}
            {monthReport.pendingCount > 0 && (
              <p className={notice}>
                <strong>{monthReport.pendingCount}</strong> leave application{monthReport.pendingCount > 1 ? 's' : ''} in {monthLabel} {monthReport.pendingCount > 1 ? 'are' : 'is'} still
                pending approval and <strong>not counted</strong> below.{' '}
                <Link href="/approve" className="font-medium text-pine hover:text-pine-deep print:hidden">Review in Approvals</Link>
              </p>
            )}
            {monthReport.cancellationCount > 0 && (
              <p className={notice}>
                <strong>{monthReport.cancellationCount}</strong> approved leave {monthReport.cancellationCount > 1 ? 'have' : 'has'} a cancellation request waiting for a decision.
                {monthReport.cancellationCount > 1 ? ' They are' : ' It is'} still counted below until decided.{' '}
                <Link href="/approve" className="font-medium text-pine hover:text-pine-deep print:hidden">Review in Approvals</Link>
              </p>
            )}
            {monthReport.missingHoursCount > 0 && (scope === 'pt' || scope === 'all') && (
              <p className={notice}>
                <strong>{monthReport.missingHoursCount}</strong> part-time staff have no hours entered for {monthLabel}.{' '}
                <Link href="/work-hours" className="font-medium text-pine hover:text-pine-deep print:hidden">Enter hours</Link>
              </p>
            )}

            {/* ── 全职员工表格 ── */}
            {(scope === 'ft' || scope === 'all') && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-[15px] font-semibold text-ink">Full-time staff</h2>
                    <span className="text-xs text-ink-faint">({ftRows.length})</span>
                  </div>

                  {/* 快捷过滤芯片按钮组 */}
                  <div className="flex flex-wrap items-center gap-1.5 print:hidden">
                    <button
                      onClick={() => setFilter('all')}
                      className={`${chip} ${filter === 'all' ? chipOn : chipOff}`}
                    >
                      All ({monthReport.fullTime.length})
                    </button>
                    <button
                      onClick={() => setFilter('leave')}
                      className={`${chip} ${filter === 'leave' ? chipOn : chipOff}`}
                    >
                      With leave ({monthReport.fullTime.filter((r) => r.annual + r.medical + r.unpaid + r.other > 0 || r.lines.length > 0).length})
                    </button>
                    {totals.unpaid > 0 && (
                      <button
                        onClick={() => setFilter('unpaid')}
                        className={`${chip} ${filter === 'unpaid' ? chipOn : chipOff}`}
                      >
                        Unpaid ({monthReport.fullTime.filter((r) => r.unpaid > 0).length})
                      </button>
                    )}
                    {totals.medical > 0 && (
                      <button
                        onClick={() => setFilter('mc')}
                        className={`${chip} ${filter === 'mc' ? chipOn : chipOff}`}
                      >
                        MC ({monthReport.fullTime.filter((r) => r.medical > 0).length})
                      </button>
                    )}

                    {/* 隐藏无请假员工 toggle */}
                    <label className="ml-1 flex cursor-pointer items-center gap-1.5 text-xs text-ink-soft select-none">
                      <input
                        type="checkbox"
                        checked={hideNoLeave}
                        onChange={(e) => setHideNoLeave(e.target.checked)}
                        className="h-3.5 w-3.5 accent-pine rounded"
                      />
                      {lang === 'ms' ? 'Hanya cuti aktif' : lang === 'zh' ? '仅显示有假期' : 'Leave only'}
                    </label>
                  </div>
                </div>

                {ftRows.length === 0 ? (
                  <p className={emptyBox}>
                    {filter === 'all' ? 'No full-time staff.' : 'No staff matched the selected filter.'}
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-line bg-white">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th className={`text-left ${th}`}>Employee</th>
                          <th className={`text-center ${th}`}>Annual</th>
                          <th className={`text-center ${th}`}>MC</th>
                          <th className={`text-center ${th}`}>Unpaid</th>
                          <th className={`text-center ${th}`}>Mat. / Pat.</th>
                          <th className={`text-center ${th}`}>{lang === 'ms' ? 'Jumlah Bulan Ini' : lang === 'zh' ? '当月合计' : 'Month Total'}</th>
                          <th className={`text-left ${th}`}>Details & Dates</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {ftRows.map((r) => {
                          const details = detailsOf(r)
                          const hasLeave = r.lines.length > 0 || r.annual + r.medical + r.unpaid + r.other > 0
                          const totalDays = r.annual + r.medical + r.unpaid + r.other

                          return (
                            <tr
                              key={r.emp.id}
                              className={`transition-colors hover:bg-[#FAFAFA] ${!hasLeave ? 'opacity-70 hover:opacity-100' : ''}`}
                            >
                              <td className="px-3.5 py-3.5 whitespace-nowrap align-middle">
                                {name(r.emp)}
                              </td>
                              <td className={tdNum}>
                                {r.annual > 0 ? (
                                  <span className="inline-flex min-w-[2rem] justify-center rounded bg-brand-soft px-2 py-0.5 font-medium text-brand-deep">
                                    {fmt(r.annual)}
                                  </span>
                                ) : (
                                  dash
                                )}
                              </td>
                              <td className={tdNum}>
                                {r.medical > 0 ? (
                                  <span className="inline-flex min-w-[2rem] justify-center rounded bg-st-pending-soft px-2 py-0.5 font-medium text-st-pending-text">
                                    {fmt(r.medical)}
                                  </span>
                                ) : (
                                  dash
                                )}
                              </td>
                              <td className={tdNum}>
                                {r.unpaid > 0 ? (
                                  <span className="inline-flex min-w-[2rem] justify-center rounded bg-st-rejected-soft px-2 py-0.5 font-medium text-st-rejected-text">
                                    {fmt(r.unpaid)}
                                  </span>
                                ) : (
                                  dash
                                )}
                              </td>
                              <td className={tdNum}>
                                {r.other > 0 ? (
                                  <span className="inline-flex min-w-[2rem] justify-center rounded bg-[#F9F0FF] px-2 py-0.5 font-medium text-[#531DAB]">
                                    {fmt(r.other)}
                                  </span>
                                ) : (
                                  dash
                                )}
                              </td>
                              <td className={tdNum}>
                                {totalDays > 0 ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-pine-soft px-2.5 py-0.5 text-xs font-bold text-pine border border-pine/20">
                                    <span className="h-1.5 w-1.5 rounded-full bg-pine"></span>
                                    {fmt(totalDays)}d
                                  </span>
                                ) : (
                                  dash
                                )}
                              </td>
                              <td className="px-3.5 py-3.5 text-xs text-ink-soft align-middle">
                                {details.length === 0 ? (
                                  <span className="text-ink-faint/60">—</span>
                                ) : (
                                  <div className="flex flex-wrap gap-1.5">
                                    {details.map((d, i) => (
                                      <span key={i} className="inline-flex items-center gap-1 rounded bg-paper px-2 py-0.5 text-[11px] font-medium text-ink border border-line/60">
                                        <span className="h-1.5 w-1.5 rounded-full bg-pine" />
                                        {d}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {r.cancellationRequested && (
                                  <span className="mt-1 inline-block badge badge-pending">
                                    Cancellation requested
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-[#FAFAFA] font-medium text-ink border-t border-line">
                          <td className="px-3.5 py-3.5">Total ({ftRows.length})</td>
                          <td className={tdNum}>{fmt(totals.annual)}</td>
                          <td className={tdNum}>{fmt(totals.medical)}</td>
                          <td className={`${tdNum} text-st-rejected-text font-medium`}>{fmt(totals.unpaid)}</td>
                          <td className={tdNum}>{fmt(totals.other)}</td>
                          <td className={`${tdNum} text-pine font-bold`}>{fmt(totals.annual + totals.medical + totals.unpaid + totals.other)}d</td>
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
                    <h2 className="text-[15px] font-semibold text-ink">Part-time staff</h2>
                    <span className="text-xs text-ink-faint">({monthReport.partTime.length})</span>
                  </div>
                  <Link href="/work-hours" className="text-[13px] text-pine transition-colors hover:text-pine-deep">
                    Enter hours in Work Hours &rarr;
                  </Link>
                </div>

                {ptRows.length === 0 ? (
                  <p className={emptyBox}>No part-time staff matched.</p>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-line bg-white">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th className={`text-left ${th}`}>Employee</th>
                          <th className={`text-right ${th}`}>Hours Worked</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {ptRows.map((r) => (
                          <tr key={r.emp.id} className="transition-colors hover:bg-[#FAFAFA]">
                            <td className="px-3.5 py-3 font-medium text-ink">{name(r.emp)}</td>
                            <td className="px-3.5 py-3 text-right tabular-nums">
                              {r.hours === null ? (
                                <span className="badge badge-pending">
                                  Not entered
                                </span>
                              ) : (
                                <span className="text-sm font-medium text-ink">
                                  {fmt(r.hours)} h
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-[#FAFAFA] font-medium text-ink border-t border-line">
                          <td className="px-3.5 py-3">Total</td>
                          <td className="px-3.5 py-3 text-right tabular-nums font-medium text-ink">{fmt(totals.hours)} h</td>
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
                    <h2 className="text-[15px] font-semibold text-ink">Full-time staff · Annual Ledger</h2>
                    <span className="text-xs text-ink-faint">({ftYearRows.length})</span>
                  </div>

                  <div className="flex items-center gap-1.5 print:hidden">
                    <button
                      onClick={() => setYearFilter('all')}
                      className={`${chip} ${yearFilter === 'all' ? chipOn : chipOff}`}
                    >
                      All ({yearReport.fullTime.length})
                    </button>
                    <button
                      onClick={() => setYearFilter('overdrawn')}
                      className={`${chip} ${yearFilter === 'overdrawn' ? chipOn : chipOff}`}
                    >
                      Overdrawn ({yearReport.fullTime.filter((r) => r.alBalance < 0).length})
                    </button>
                    <button
                      onClick={() => setYearFilter('mc')}
                      className={`${chip} ${yearFilter === 'mc' ? chipOn : chipOff}`}
                    >
                      With MC ({yearReport.fullTime.filter((r) => r.mcTaken > 0).length})
                    </button>
                  </div>
                </div>

                {ftYearRows.length === 0 ? (
                  <p className={emptyBox}>No staff matched the selected filter.</p>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-line bg-white">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th className={`text-left ${th}`}>Employee</th>
                          <th className={`text-center ${th}`}>Entitled</th>
                          <th className={`text-center ${th}`}>B/F</th>
                          <th className={`text-center ${th}`}>Taken</th>
                          <th className={`text-center ${th} min-w-[140px]`}>Annual Balance</th>
                          <th className={`text-center ${th}`}>MC Taken</th>
                          <th className={`text-center ${th}`}>Unpaid</th>
                          <th className={`text-center ${th}`}>Mat. / Pat.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {ftYearRows.map((r) => (
                          <tr key={r.emp.id} className={`transition-colors hover:bg-[#FAFAFA] ${r.alBalance < 0 ? 'bg-st-rejected-soft/50' : ''}`}>
                            <td className="px-3.5 py-3 font-medium text-ink whitespace-nowrap">{name(r.emp)}</td>
                            <td className={tdNum}>
                              {fmt(r.alEntitled)}
                              {r.emp.annual_leave_entitlement_override != null && <span className="ml-1 text-xs text-ink-faint font-normal" title="Entitlement set manually">*</span>}
                            </td>
                            <td className={tdNum}>{fmt(r.bf)}</td>
                            <td className={tdNum}>
                              {fmt(r.alTaken)}
                              {r.alPending > 0 && (
                                <span className="block text-xs font-normal text-st-pending-text">
                                  ({fmt(r.alPending)} pending)
                                </span>
                              )}
                            </td>
                            <td className="px-3.5 py-3 align-middle">
                              <LeaveProgressBar taken={r.alTaken} entitled={r.alEntitled} bf={r.bf} lang={lang} />
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
                    <h2 className="text-[15px] font-semibold text-ink">Part-time staff · Annual Summary</h2>
                    <span className="text-xs text-ink-faint">({yearReport.partTime.length})</span>
                  </div>
                </div>

                {ptYearRows.length === 0 ? (
                  <p className={emptyBox}>No part-time staff matched.</p>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-line bg-white">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th className={`text-left ${th}`}>Employee</th>
                          <th className={`text-center ${th}`}>Months Entered</th>
                          <th className={`text-right ${th}`}>Total Hours</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {ptYearRows.map((r) => (
                          <tr key={r.emp.id} className="transition-colors hover:bg-[#FAFAFA]">
                            <td className="px-3.5 py-3 font-medium text-ink">{name(r.emp)}</td>
                            <td className={tdNum}>{r.monthsEntered}</td>
                            <td className="px-3.5 py-3 text-right tabular-nums font-medium text-ink">{fmt(r.totalHours)} h</td>
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

// 手机/平板(< lg)用钉钉风格的新版页面;电脑(≥ lg,和 ManagerShell 一致)。
export default function ReportsPage() {
  return (
    <>
      <div className="lg:hidden">
        <MobileReports />
      </div>
      <div className="hidden lg:block">
        <DesktopReports />
      </div>
    </>
  )
}
