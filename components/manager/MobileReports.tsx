'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import AuthStatus from '@/components/AuthStatus'
import { Card, EI, Icon, SubPage } from '@/components/employee/EmployeeShell'
import { supabase } from '@/lib/supabaseClient'
import { useEmployee } from '@/lib/useEmployee'
import { DEFAULT_WORK_WEEK, type WorkWeek } from '@/lib/leaveRules'
import { loadWorkWeek } from '@/lib/settings'
import {
  buildMonthReport,
  buildYearReport,
  monthBounds,
  type HoursRow,
  type LeaveLine,
  type ReportApp,
  type ReportEmployee,
} from '@/lib/reportData'
import { leaveName, useMgrT } from '@/lib/mgrText'
import { Avatar } from './ManagerTabs'

// 报表 · 手机版 (钉钉专业风格):
//  1. 顶部: 按月 / 年度余额 切换 + 月份(年份)步进器
//  2. 全职与兼职独立分离: 专门的【全职员工 / 兼职员工 / 全部】分段切换，互不干扰
//  3. 第一时间看清想要的关键信息:
//     - 核心指标卡片分级突出: 无薪假(涉及扣薪)高亮醒目、病假(MC)、年假
//     - 员工行外显高对比度彩色标签: 一眼看清每个人请了什么假(如 [无薪 2天] [病假 1天])，无需逐个点开
//     - 一键快速筛选: 【全部】/【仅看有请假】/【有无薪假】/【有病假】
//  4. 兼职工时独立卡片与状态标签: 清楚标注 已录入 / 待录入，一键直达录入工时。

const THIS_YEAR = new Date().getFullYear()
const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type Lang = 'zh' | 'en'
type Scope = 'ft' | 'pt' | 'all'
type Filter = 'all' | 'leave' | 'unpaid' | 'mc'
type YearFilter = 'all' | 'overdrawn' | 'mc'

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
const fill = (s: string, n: number) => s.replace('{n}', String(n))

function monthTitle(year: number, month: number, lang: Lang) {
  return lang === 'zh' ? `${year}年${month}月` : `${MONTH_EN[month - 1]} ${year}`
}

function shortDate(iso: string, lang: Lang) {
  const [, m, d] = iso.split('-').map(Number)
  return lang === 'zh' ? `${m}月${d}日` : `${d} ${MONTH_EN[m - 1]}`
}

function dateRange(a: string, b: string, lang: Lang) {
  if (a === b) return shortDate(a, lang)
  const [, am, ad] = a.split('-').map(Number)
  const [, bm, bd] = b.split('-').map(Number)
  if (am === bm) return lang === 'zh' ? `${am}月${ad}–${bd}日` : `${ad}–${bd} ${MONTH_EN[bm - 1]}`
  return `${shortDate(a, lang)} – ${shortDate(b, lang)}`
}

function lineText(l: LeaveLine, ym: string, lang: Lang, t: ReturnType<typeof useMgrT>['t']): string | null {
  const a = l.app
  const label = leaveName(a.leave_type, lang).replace(/ ?\(MC\)/, '')
  const half = a.is_half_day && a.half_day_period ? ` (${a.half_day_period === 'am' ? t('halfAm') : t('halfPm')})` : ''
  const days = `${fmt(l.days)}${t('daysUnit')}`
  if (a.remarks?.includes('Historical import')) {
    if (a.leave_type === 'annual') return null
    return `${label}${half} · ${days}`
  }
  const crossMonth = a.start_date.slice(0, 7) !== ym || a.end_date.slice(0, 7) !== ym
  return `${label} ${dateRange(a.start_date, a.end_date, lang)}${half} · ${days}${crossMonth ? (lang === 'zh' ? '(本月部分)' : ' (this month)') : ''}`
}

function exportCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── UI 小组件 ──

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="flex rounded-xl bg-gray-200/80 p-0.5 shadow-inner">
      {options.map(([k, label]) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
            value === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function Stepper({ label, onPrev, onNext, action }: { label: string; onPrev: () => void; onNext: () => void; action?: { label: string; onClick: () => void } }) {
  return (
    <Card className="mt-2.5 shadow-xs">
      <div className="flex h-11 items-center">
        <button onClick={onPrev} className="flex h-11 w-11 items-center justify-center text-gray-500 transition-colors active:bg-gray-100">
          <Icon d={EI.chevronL} size={18} />
        </button>
        <div className="flex flex-1 items-center justify-center gap-2">
          <span className="text-base font-semibold text-gray-900">{label}</span>
          {action && (
            <button onClick={action.onClick} className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand transition-colors hover:bg-brand/15">
              {action.label}
            </button>
          )}
        </div>
        <button onClick={onNext} className="flex h-11 w-11 items-center justify-center text-gray-500 transition-colors active:bg-gray-100">
          <Icon d={EI.chevronR} size={18} />
        </button>
      </div>
    </Card>
  )
}

function FilterChip({ active, onClick, danger, children }: { active: boolean; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  if (active) {
    return (
      <button
        onClick={onClick}
        className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold shadow-xs transition-all ${
          danger ? 'bg-[#F5222D] text-white' : 'bg-brand text-white'
        }`}
      >
        {children}
      </button>
    )
  }
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border border-gray-200/80 bg-white px-3 py-1 text-xs font-medium text-gray-600 transition-all hover:border-gray-300 active:bg-gray-50 ${
        danger ? 'hover:text-[#F5222D]' : 'hover:text-brand'
      }`}
    >
      {children}
    </button>
  )
}

function Tile({ label, danger, children }: { label: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl p-2 text-center border ${danger ? 'bg-red-50/70 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
      <p className={`text-[11px] font-medium ${danger ? 'text-[#F5222D]' : 'text-gray-400'}`}>{label}</p>
      <p className={`mt-0.5 text-[15px] font-bold tabular-nums ${danger ? 'text-[#F5222D]' : 'text-gray-900'}`}>{children}</p>
    </div>
  )
}

function Chevron({ open }: { open: boolean }) {
  return <Icon d={EI.chevronR} size={16} className={`shrink-0 text-gray-300 transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
}

export default function MobileReports() {
  const auth = useEmployee({ requireManager: true })
  const { t, lang } = useMgrT()

  const [view, setView] = useState<'month' | 'year'>('month')
  const [scope, setScope] = useState<Scope>('ft')
  const [year, setYear] = useState(THIS_YEAR)
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [filter, setFilter] = useState<Filter>('all')
  const [yearFilter, setYearFilter] = useState<YearFilter>('all')
  const [openId, setOpenId] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [employees, setEmployees] = useState<ReportEmployee[]>([])
  const [apps, setApps] = useState<ReportApp[]>([])
  const [hours, setHours] = useState<HoursRow[]>([])
  const [holidayDates, setHolidayDates] = useState<string[]>([])
  const [workWeek, setWorkWeek] = useState<WorkWeek>(DEFAULT_WORK_WEEK)

  useEffect(() => {
    if (auth.status !== 'ready') return
    let cancelled = false
    async function load() {
      setLoading(true)
      setLoadError(false)
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
      if (cancelled) return
      if (empRes.error || appRes.error || holRes.error || hoursRes.error) {
        setLoadError(true)
        setLoading(false)
        return
      }
      setEmployees(((empRes.data || []) as ReportEmployee[]).filter((e) => e.role !== 'manager' && e.full_name.toUpperCase() !== 'CHEW HONG YI'))
      setApps((appRes.data || []) as ReportApp[])
      setHolidayDates((holRes.data || []).map((h) => h.holiday_date))
      setHours((hoursRes.data || []) as HoursRow[])
      setWorkWeek(ww)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [auth.status, year])

  const monthReport = useMemo(
    () => buildMonthReport({ year, month, employees, apps, hours, holidayDates, workWeek }),
    [year, month, employees, apps, hours, holidayDates, workWeek]
  )
  const yearReport = useMemo(
    () => buildYearReport({ year, employees, apps, hours, holidayDates, workWeek }),
    [year, employees, apps, hours, holidayDates, workWeek]
  )

  if (auth.status !== 'ready') return <AuthStatus state={auth} />

  const { ym } = monthBounds(year, month)
  const isCurrentMonth = year === THIS_YEAR && month === new Date().getMonth() + 1
  const tot = monthReport.totals

  function shiftMonth(delta: number) {
    let m = month + delta
    let y = year
    if (m < 1) { m = 12; y -= 1 }
    if (m > 12) { m = 1; y += 1 }
    setMonth(m); setYear(y); setOpenId(null)
  }

  function handleExport() {
    if (view === 'month') {
      const rows: (string | number)[][] = []
      if (scope === 'ft' || scope === 'all') {
        for (const r of monthReport.fullTime) {
          rows.push([r.emp.employee_no ?? '', r.emp.full_name, 'Full-time', r.annual, r.medical, r.unpaid, r.other, '', r.lines.map((l) => lineText(l, ym, 'en', t)).filter(Boolean).join('; ')])
        }
      }
      if (scope === 'pt' || scope === 'all') {
        for (const r of monthReport.partTime) {
          rows.push([r.emp.employee_no ?? '', r.emp.full_name, 'Part-time', '', '', '', '', r.hours ?? 'Not entered', ''])
        }
      }
      exportCsv(`report-${ym}-${scope}.csv`, ['Employee No', 'Name', 'Type', 'Annual days', 'MC days', 'Unpaid days', 'Maternity/Paternity days', 'Hours', 'Details'], rows)
    } else {
      const rows = yearReport.fullTime.map((r) => [r.emp.employee_no ?? '', r.emp.full_name, r.alEntitled, r.bf, r.alTaken, r.alBalance, r.mcTaken, r.mcEntitled, r.unpaid, r.other])
      exportCsv(`balances-${year}.csv`, ['Employee No', 'Name', 'Annual entitled', 'B/F', 'Annual taken', 'Annual balance', 'MC taken', 'MC entitled', 'Unpaid days', 'Maternity/Paternity days'], rows)
    }
  }

  // 筛选全职列表
  const ftFiltered = useMemo(() => {
    return monthReport.fullTime.filter((r) => {
      if (filter === 'leave') return r.annual + r.medical + r.unpaid + r.other > 0 || r.lines.length > 0
      if (filter === 'unpaid') return r.unpaid > 0
      if (filter === 'mc') return r.medical > 0
      return true
    })
  }, [monthReport.fullTime, filter])

  const ftYearFiltered = useMemo(() => {
    return yearReport.fullTime.filter((r) => {
      if (yearFilter === 'overdrawn') return r.alBalance < 0
      if (yearFilter === 'mc') return r.mcTaken > 0
      return true
    })
  }, [yearReport.fullTime, yearFilter])

  const notices: { text: string; href: string }[] = []
  if (monthReport.pendingCount > 0) notices.push({ text: fill(t('noticePending'), monthReport.pendingCount), href: '/approve' })
  if (monthReport.cancellationCount > 0) notices.push({ text: fill(t('noticeCancel'), monthReport.cancellationCount), href: '/approve' })
  if (monthReport.missingHoursCount > 0 && (scope === 'pt' || scope === 'all')) {
    notices.push({ text: fill(t('noticeHours'), monthReport.missingHoursCount), href: '/work-hours' })
  }

  const ftCount = employees.filter((e) => e.employment_type === 'full_time').length
  const ptCount = employees.filter((e) => e.employment_type === 'part_time').length

  return (
    <SubPage
      title={t('reports')}
      backHref="/workspace"
      right={
        <button onClick={handleExport} disabled={loading} className="text-[14px] font-semibold text-brand transition-opacity disabled:opacity-40">
          {t('exportCsv')}
        </button>
      }
    >
      {/* 顶部: 按月 / 年度余额 模式切换 */}
      <div className="px-4 pt-3">
        <Segmented
          value={view}
          onChange={(v) => { setView(v); setOpenId(null) }}
          options={[['month', t('tabMonth')], ['year', t('tabYear')]]}
        />
      </div>

      {/* 月度 / 年度 步进器 */}
      {view === 'month' ? (
        <Stepper
          label={monthTitle(year, month, lang)}
          onPrev={() => shiftMonth(-1)}
          onNext={() => shiftMonth(1)}
          action={isCurrentMonth ? undefined : { label: t('backThisMonth'), onClick: () => { setYear(THIS_YEAR); setMonth(new Date().getMonth() + 1); setOpenId(null) } }}
        />
      ) : (
        <Stepper
          label={`${year}${lang === 'zh' ? '年' : ''}`}
          onPrev={() => { setYear(year - 1); setOpenId(null) }}
          onNext={() => { setYear(year + 1); setOpenId(null) }}
        />
      )}

      {/* 全职 / 兼职 核心分离切换器 (钉钉分段控件规范) */}
      <div className="mx-4 mt-3 flex rounded-xl border border-gray-200/80 bg-white p-1 shadow-xs">
        <button
          onClick={() => { setScope('ft'); setOpenId(null) }}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
            scope === 'ft' ? 'bg-brand text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <span>{lang === 'zh' ? '全职' : 'Full-time'}</span>
          <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${scope === 'ft' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
            {ftCount}
          </span>
        </button>
        <button
          onClick={() => { setScope('pt'); setOpenId(null) }}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
            scope === 'pt' ? 'bg-brand text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <span>{lang === 'zh' ? '兼职' : 'Part-time'}</span>
          <span className={`rounded-full px-1.5 py-0.2 text-[10px] ${scope === 'pt' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
            {ptCount}
          </span>
        </button>
        <button
          onClick={() => { setScope('all'); setOpenId(null) }}
          className={`flex flex-1 items-center justify-center rounded-lg py-2 text-xs font-semibold transition-all ${
            scope === 'all' ? 'bg-brand text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {lang === 'zh' ? '全部' : 'All'}
        </button>
      </div>

      {loadError && (
        <div className="mx-4 mt-3 rounded-xl bg-red-50 p-3 text-sm text-[#F5222D]">
          {t('loadFail')}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400">{t('loading')}</div>
      ) : view === 'month' ? (
        <>
          {/* ── 核心摘要指标卡 (第一时间直观把握关键数据) ── */}
          {scope === 'ft' && (
            <div className="mx-4 mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {/* 无薪假: 扣薪重点，红底强调 */}
              <div className="rounded-2xl border border-red-200/80 bg-gradient-to-br from-[#FFF1F0] to-[#FFCCC7]/30 p-3.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-red-700">{t('unpaidLeave')}</span>
                  <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">{lang === 'zh' ? '涉及扣薪' : 'Deduct pay'}</span>
                </div>
                <p className="mt-1.5 text-2xl font-bold tabular-nums text-[#F5222D]">
                  {fmt(tot.unpaid)} <span className="text-xs font-normal text-red-600">{t('daysUnit')}</span>
                </p>
                <p className="mt-1 text-[11px] text-red-600/80">{tot.unpaidStaff} {t('peopleUnit')}</p>
              </div>

              {/* 带薪病假 */}
              <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-[#FFFBE6] to-[#FFE58F]/30 p-3.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-amber-800">{t('medicalLeave')}</span>
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">{t('paidTag')}</span>
                </div>
                <p className="mt-1.5 text-2xl font-bold tabular-nums text-amber-800">
                  {fmt(tot.medical)} <span className="text-xs font-normal text-amber-700">{t('daysUnit')}</span>
                </p>
                <p className="mt-1 text-[11px] text-amber-700/80">{monthReport.fullTime.filter((r) => r.medical > 0).length} {t('peopleUnit')}</p>
              </div>

              {/* 年假 */}
              <div className="rounded-2xl border border-blue-200/80 bg-gradient-to-br from-[#E6F4FF] to-[#BAE0FF]/30 p-3.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-blue-800">{t('legendAnnual')}</span>
                  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">{lang === 'zh' ? '工作日' : 'Work days'}</span>
                </div>
                <p className="mt-1.5 text-2xl font-bold tabular-nums text-blue-800">
                  {fmt(tot.annual)} <span className="text-xs font-normal text-blue-700">{t('daysUnit')}</span>
                </p>
                <p className="mt-1 text-[11px] text-blue-700/80">{monthReport.fullTime.filter((r) => r.annual > 0).length} {t('peopleUnit')}</p>
              </div>

              {/* 产假 / 陪产假 */}
              <div className="rounded-2xl border border-purple-200/80 bg-gradient-to-br from-[#F9F0FF] to-[#EFDBFF]/30 p-3.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-purple-800">{t('matPat')}</span>
                </div>
                <p className="mt-1.5 text-2xl font-bold tabular-nums text-purple-800">
                  {fmt(tot.other)} <span className="text-xs font-normal text-purple-700">{t('daysUnit')}</span>
                </p>
                <p className="mt-1 text-[11px] text-purple-700/80">{monthReport.fullTime.filter((r) => r.other > 0).length} {t('peopleUnit')}</p>
              </div>
            </div>
          )}

          {scope === 'pt' && (
            <div className="mx-4 mt-3 grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl border border-brand/20 bg-gradient-to-br from-[#E6F4FF] to-white p-4 shadow-xs">
                <p className="text-xs font-medium text-brand">{t('ptHours')}</p>
                <p className="mt-1.5 text-3xl font-bold tabular-nums text-gray-900">
                  {fmt(tot.hours)} <span className="text-sm font-normal text-gray-500">h</span>
                </p>
                <p className="mt-1 text-xs text-gray-400">{monthReport.partTime.length} {t('peopleUnit')}</p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-[#FFFBE6] p-4 shadow-xs">
                <p className="text-xs font-medium text-amber-800">{t('notEntered')}</p>
                <p className="mt-1.5 text-3xl font-bold tabular-nums text-amber-700">
                  {monthReport.missingHoursCount} <span className="text-sm font-normal text-amber-600">{t('peopleUnit')}</span>
                </p>
                <Link href="/work-hours" className="mt-1 inline-flex items-center text-xs font-semibold text-brand">
                  {t('enterHours')} &rarr;
                </Link>
              </div>
            </div>
          )}

          {scope === 'all' && (
            <div className="mx-4 mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-red-200 bg-[#FFF1F0] p-3 text-center shadow-xs">
                <p className="text-[11px] font-medium text-red-600">{t('unpaidLeave')}</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-[#F5222D]">{fmt(tot.unpaid)} <span className="text-xs font-normal">{t('daysUnit')}</span></p>
                <p className="text-[10px] text-red-500">{tot.unpaidStaff} {t('peopleUnit')}</p>
              </div>
              <div className="rounded-xl border border-blue-200 bg-[#E6F4FF] p-3 text-center shadow-xs">
                <p className="text-[11px] font-medium text-blue-700">{t('medicalLeave')}</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-blue-900">{fmt(tot.medical)} <span className="text-xs font-normal">{t('daysUnit')}</span></p>
                <p className="text-[10px] text-blue-600">{t('paidTag')}</p>
              </div>
              <div className="rounded-xl border border-purple-200 bg-[#F9F0FF] p-3 text-center shadow-xs">
                <p className="text-[11px] font-medium text-purple-700">{t('ptHours')}</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-purple-900">{fmt(tot.hours)} <span className="text-xs font-normal">h</span></p>
                <p className="text-[10px] text-purple-600">{monthReport.partTime.length} {t('peopleUnit')}</p>
              </div>
            </div>
          )}

          {/* 提醒通知行 */}
          {notices.length > 0 && (
            <Card className="mt-3 shadow-xs">
              {notices.map((n, i) => (
                <Link key={i} href={n.href} className={`flex items-start gap-2.5 px-4 py-3 active:bg-gray-50 ${i ? 'border-t border-gray-100' : ''}`}>
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#FA8C16]" />
                  <p className="flex-1 text-[13px] leading-snug text-gray-700">{n.text}</p>
                  <Icon d={EI.chevronR} size={16} className="mt-0.5 shrink-0 text-gray-300" />
                </Link>
              ))}
            </Card>
          )}

          {/* ── 全职员工列表 ── */}
          {(scope === 'ft' || scope === 'all') && (
            <div className="mt-4">
              <div className="flex items-center justify-between px-5 pb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-gray-900">{t('ftStaff')}</h3>
                  <span className="text-xs text-gray-400">({ftFiltered.length})</span>
                </div>
              </div>

              {/* 快捷过滤标签组 (仅全职视图提供) */}
              <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-2.5 pt-0.5 scrollbar-none">
                <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
                  {t('filterAll')} ({monthReport.fullTime.length})
                </FilterChip>
                <FilterChip active={filter === 'leave'} onClick={() => setFilter('leave')}>
                  {t('filterLeave')} ({monthReport.fullTime.filter((r) => r.annual + r.medical + r.unpaid + r.other > 0 || r.lines.length > 0).length})
                </FilterChip>
                {tot.unpaid > 0 && (
                  <FilterChip active={filter === 'unpaid'} onClick={() => setFilter('unpaid')} danger>
                    {lang === 'zh' ? '有无薪假' : 'Unpaid'} ({monthReport.fullTime.filter((r) => r.unpaid > 0).length})
                  </FilterChip>
                )}
                {tot.medical > 0 && (
                  <FilterChip active={filter === 'mc'} onClick={() => setFilter('mc')}>
                    {lang === 'zh' ? '有病假' : 'MC'} ({monthReport.fullTime.filter((r) => r.medical > 0).length})
                  </FilterChip>
                )}
              </div>

              <Card className="shadow-xs">
                {ftFiltered.length === 0 ? (
                  <div className="py-10 text-center text-sm text-gray-400">
                    {filter === 'all' ? t('noFullTime') : t('noItems')}
                  </div>
                ) : (
                  ftFiltered.map((r, i) => {
                    const details = r.lines.map((l) => lineText(l, ym, lang, t)).filter((x): x is string => Boolean(x))
                    const hasLeave = r.annual + r.medical + r.unpaid + r.other > 0 || details.length > 0
                    const open = openId === r.emp.id

                    return (
                      <div key={r.emp.id} className={i ? 'border-t border-gray-100' : ''}>
                        <button
                          disabled={!hasLeave}
                          onClick={() => setOpenId(open ? null : r.emp.id)}
                          className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-gray-50 disabled:active:bg-white"
                        >
                          <Avatar name={r.emp.full_name} size={42} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className={`truncate text-[15px] font-semibold ${hasLeave ? 'text-gray-900' : 'text-gray-500'}`}>
                                {r.emp.full_name}
                              </p>
                              {!r.emp.is_active && (
                                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-400">
                                  {t('inactive')}
                                </span>
                              )}
                              {r.cancellationRequested && (
                                <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200">
                                  {t('cancelReq')}
                                </span>
                              )}
                            </div>

                            {/* 关键信息外显彩色标签: 一眼看清，无需点开 */}
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              {r.unpaid > 0 && (
                                <span className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 text-[11px] font-bold text-[#F5222D]">
                                  {t('unpaidLeave')} {fmt(r.unpaid)}{t('daysUnit')}
                                </span>
                              )}
                              {r.medical > 0 && (
                                <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
                                  {t('medicalLeave')} {fmt(r.medical)}{t('daysUnit')}
                                </span>
                              )}
                              {r.annual > 0 && (
                                <span className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-brand">
                                  {t('legendAnnual')} {fmt(r.annual)}{t('daysUnit')}
                                </span>
                              )}
                              {r.other > 0 && (
                                <span className="inline-flex items-center rounded-md border border-purple-200 bg-purple-50 px-1.5 py-0.5 text-[11px] font-semibold text-purple-700">
                                  {t('matPat')} {fmt(r.other)}{t('daysUnit')}
                                </span>
                              )}
                              {!hasLeave && (
                                <span className="text-xs text-gray-400 font-normal">
                                  {t('noLeave')}
                                </span>
                              )}
                            </div>
                          </div>

                          {hasLeave && <Chevron open={open} />}
                        </button>

                        {/* 点开折叠面板: 查看具体日期明细 */}
                        {open && (
                          <div className="border-t border-gray-100 bg-gray-50/70 px-4 pb-3.5 pt-3">
                            <div className="grid grid-cols-4 gap-1.5">
                              <Tile label={t('legendAnnual')}>{r.annual > 0 ? fmt(r.annual) : '–'}</Tile>
                              <Tile label={t('medicalLeave')}>{r.medical > 0 ? fmt(r.medical) : '–'}</Tile>
                              <Tile label={t('unpaidLeave')} danger={r.unpaid > 0}>{r.unpaid > 0 ? fmt(r.unpaid) : '–'}</Tile>
                              <Tile label={t('matPat')}>{r.other > 0 ? fmt(r.other) : '–'}</Tile>
                            </div>

                            {details.length > 0 && (
                              <div className="mt-3 rounded-xl bg-white p-3 border border-gray-200/60 shadow-2xs">
                                <p className="mb-2 text-xs font-semibold text-gray-500">{t('details')}</p>
                                <ul className="space-y-1.5">
                                  {details.map((d, k) => (
                                    <li key={k} className="flex items-center gap-2 text-[13px] text-gray-700">
                                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                                      <span>{d}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}

                {/* 全职合计栏 */}
                {ftFiltered.length > 0 && (
                  <div className="grid grid-cols-4 gap-1 border-t border-gray-100 bg-gray-50 px-4 py-3 text-center">
                    <div>
                      <p className="text-[10px] text-gray-400">{t('legendAnnual')}</p>
                      <p className="text-sm font-bold tabular-nums text-gray-900">{fmt(tot.annual)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400">{t('medicalLeave')}</p>
                      <p className="text-sm font-bold tabular-nums text-amber-800">{fmt(tot.medical)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#F5222D]">{t('unpaidLeave')}</p>
                      <p className="text-sm font-bold tabular-nums text-[#F5222D]">{fmt(tot.unpaid)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400">{t('matPat')}</p>
                      <p className="text-sm font-bold tabular-nums text-gray-900">{fmt(tot.other)}</p>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ── 兼职员工列表 ── */}
          {(scope === 'pt' || scope === 'all') && (
            <div className="mt-5">
              <div className="flex items-center justify-between px-5 pb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-gray-900">{t('ptStaff')}</h3>
                  <span className="text-xs text-gray-400">({monthReport.partTime.length})</span>
                </div>
                <Link href="/work-hours" className="text-xs font-semibold text-brand hover:underline">
                  {t('enterHours')} &rarr;
                </Link>
              </div>

              <Card className="shadow-xs">
                {monthReport.partTime.length === 0 ? (
                  <div className="py-10 text-center text-sm text-gray-400">{t('noPartTime')}</div>
                ) : (
                  <>
                    {monthReport.partTime.map((r, i) => (
                      <Link
                        key={r.emp.id}
                        href="/work-hours"
                        className={`flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-gray-50 ${i ? 'border-t border-gray-100' : ''}`}
                      >
                        <Avatar name={r.emp.full_name} size={40} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-semibold text-gray-900">
                            {r.emp.full_name}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-400">
                            {r.emp.employee_no ? `#${r.emp.employee_no} · ` : ''}{lang === 'zh' ? '兼职' : 'Part-time'}
                          </p>
                        </div>
                        {r.hours === null ? (
                          <span className="shrink-0 rounded-full border border-amber-200 bg-[#FFFBE6] px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                            {t('notEntered')}
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-sm font-bold tabular-nums text-emerald-700">
                            {fmt(r.hours)} h
                          </span>
                        )}
                        <Icon d={EI.chevronR} size={16} className="shrink-0 text-gray-300" />
                      </Link>
                    ))}
                    <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-4 py-3">
                      <span className="text-xs font-semibold text-gray-600">{t('total')}</span>
                      <span className="text-base font-bold tabular-nums text-gray-900">{fmt(tot.hours)} h</span>
                    </div>
                  </>
                )}
              </Card>
            </div>
          )}

          <p className="mx-5 mt-4 text-xs leading-relaxed text-gray-400">{t('monthNote')}</p>
        </>
      ) : (
        /* ── 年度余额视图 ── */
        <>
          {(scope === 'ft' || scope === 'all') && (
            <div className="mt-4">
              <div className="flex items-center justify-between px-5 pb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-gray-900">{t('ftStaff')} · {t('tabYear')}</h3>
                  <span className="text-xs text-gray-400">({ftYearFiltered.length})</span>
                </div>
              </div>

              {/* 年度余额快速过滤 */}
              <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-2.5 pt-0.5 scrollbar-none">
                <FilterChip active={yearFilter === 'all'} onClick={() => setYearFilter('all')}>
                  {t('filterAll')} ({yearReport.fullTime.length})
                </FilterChip>
                <FilterChip active={yearFilter === 'overdrawn'} onClick={() => setYearFilter('overdrawn')} danger>
                  {lang === 'zh' ? '已透支' : 'Overdrawn'} ({yearReport.fullTime.filter((r) => r.alBalance < 0).length})
                </FilterChip>
                <FilterChip active={yearFilter === 'mc'} onClick={() => setYearFilter('mc')}>
                  {lang === 'zh' ? '有病假' : 'With MC'} ({yearReport.fullTime.filter((r) => r.mcTaken > 0).length})
                </FilterChip>
              </div>

              <Card className="shadow-xs">
                {ftYearFiltered.length === 0 ? (
                  <div className="py-10 text-center text-sm text-gray-400">{t('noFullTime')}</div>
                ) : (
                  ftYearFiltered.map((r, i) => {
                    const open = openId === r.emp.id
                    const negative = r.alBalance < 0
                    const manual = r.emp.annual_leave_entitlement_override != null

                    return (
                      <div key={r.emp.id} className={i ? 'border-t border-gray-100' : ''}>
                        <button
                          onClick={() => setOpenId(open ? null : r.emp.id)}
                          className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-gray-50"
                        >
                          <Avatar name={r.emp.full_name} size={42} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px] font-semibold text-gray-900">
                              {r.emp.full_name}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-gray-400">
                              {t('entitled')} {fmt(r.alEntitled)}{manual ? '*' : ''}
                              {r.bf > 0 ? ` + ${t('carriedFwd')} ${fmt(r.bf)}` : ''} · {t('taken')} {fmt(r.alTaken)}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className={`text-xl font-bold leading-none tabular-nums ${negative ? 'text-[#F5222D]' : 'text-brand'}`}>
                              {fmt(r.alBalance)}
                            </p>
                            <p className="mt-1 text-[10px] font-medium text-gray-400">{t('annualBalance')}</p>
                          </div>
                          <Chevron open={open} />
                        </button>

                        {open && (
                          <div className="border-t border-gray-100 bg-gray-50/70 px-4 pb-3.5 pt-3">
                            <div className="grid grid-cols-3 gap-1.5">
                              <Tile label={t('entitled')}>{fmt(r.alEntitled)}{manual ? '*' : ''}</Tile>
                              <Tile label={t('carriedFwd')}>{fmt(r.bf)}</Tile>
                              <Tile label={t('taken')}>{fmt(r.alTaken)}</Tile>
                              <Tile label={t('mcUsed')}>{fmt(r.mcTaken)}<span className="text-xs font-normal text-gray-400"> / {fmt(r.mcEntitled)}</span></Tile>
                              <Tile label={t('legendUnpaid')} danger={r.unpaid > 0}>{r.unpaid > 0 ? fmt(r.unpaid) : '–'}</Tile>
                              <Tile label={t('matPat')}>{r.other > 0 ? fmt(r.other) : '–'}</Tile>
                            </div>
                            {r.alPending > 0 && (
                              <p className="mt-2.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
                                {fmt(r.alPending)} {t('pendingIncluded')}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </Card>
            </div>
          )}

          {(scope === 'pt' || scope === 'all') && (
            <div className="mt-5">
              <div className="flex items-center justify-between px-5 pb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-gray-900">{t('ptStaff')} · {t('tabYear')}</h3>
                  <span className="text-xs text-gray-400">({yearReport.partTime.length})</span>
                </div>
              </div>

              <Card className="shadow-xs">
                {yearReport.partTime.length === 0 ? (
                  <div className="py-10 text-center text-sm text-gray-400">{t('noPartTime')}</div>
                ) : (
                  yearReport.partTime.map((r, i) => (
                    <Link
                      key={r.emp.id}
                      href="/work-hours"
                      className={`flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-gray-50 ${i ? 'border-t border-gray-100' : ''}`}
                    >
                      <Avatar name={r.emp.full_name} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold text-gray-900">{r.emp.full_name}</p>
                        <p className="mt-0.5 text-xs text-gray-400">{t('monthsEntered')} {r.monthsEntered} {t('monthsUnit')}</p>
                      </div>
                      <span className="shrink-0 text-[15px] font-bold tabular-nums text-gray-900">{fmt(r.totalHours)} h</span>
                      <Icon d={EI.chevronR} size={16} className="shrink-0 text-gray-300" />
                    </Link>
                  ))
                )}
              </Card>
            </div>
          )}

          <p className="mx-5 mt-4 text-xs leading-relaxed text-gray-400">{t('yearNote')}</p>
        </>
      )}
    </SubPage>
  )
}
