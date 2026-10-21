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

// ── 常量与工具函数 ──
const THIS_YEAR = new Date().getFullYear()
const THIS_MONTH = new Date().getMonth() + 1
const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_ZH = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

type Lang = 'zh' | 'en'
type MainTab = 'ft' | 'pt' | 'year'
type Filter = 'all' | 'leave' | 'unpaid' | 'mc'
type YearFilter = 'all' | 'overdrawn' | 'mc'

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
const fill = (s?: string | null, n?: number) => (s || '').replace('{n}', String(n ?? 0))

function monthDisplayTitle(year: number, month: number, lang: Lang) {
  return lang === 'zh' ? `${year}年${month}月` : `${MONTH_EN[month - 1] || ''} ${year}`
}

function shortDate(iso?: string | null, lang: Lang = 'zh') {
  if (!iso || typeof iso !== 'string') return '–'
  const parts = iso.split('-').map(Number)
  if (parts.length < 3 || isNaN(parts[1]) || isNaN(parts[2])) return iso
  const [, m, d] = parts
  return lang === 'zh' ? `${m}月${d}日` : `${d} ${MONTH_EN[m - 1] || ''}`
}

function dateRange(a?: string | null, b?: string | null, lang: Lang = 'zh') {
  if (!a && !b) return '–'
  if (!a) return shortDate(b, lang)
  if (!b || a === b) return shortDate(a, lang)
  const aParts = a.split('-').map(Number)
  const bParts = b.split('-').map(Number)
  if (aParts.length < 3 || bParts.length < 3) return `${a} – ${b}`
  const [, am, ad] = aParts
  const [, bm, bd] = bParts
  if (am === bm) return lang === 'zh' ? `${am}月${ad}–${bd}日` : `${ad}–${bd} ${MONTH_EN[bm - 1] || ''}`
  return `${shortDate(a, lang)} – ${shortDate(b, lang)}`
}

function lineText(l: LeaveLine, ym: string, lang: Lang, t: ReturnType<typeof useMgrT>['t']): string | null {
  const a = l?.app
  if (!a) return null
  const label = leaveName(a.leave_type || '', lang).replace(/ ?\(MC\)/, '')
  const half = a.is_half_day && a.half_day_period ? ` (${a.half_day_period === 'am' ? (t('halfAm') || (lang === 'zh' ? '上午' : 'Morning')) : (t('halfPm') || (lang === 'zh' ? '下午' : 'Afternoon'))})` : ''
  const days = `${fmt(l.days || 0)}${t('daysUnit') || (lang === 'zh' ? '天' : 'd')}`
  if (a.remarks?.includes('Historical import')) {
    if (a.leave_type === 'annual') return null
    return `${label}${half} · ${days}`
  }
  const sDate = a.start_date || ''
  const eDate = a.end_date || ''
  const crossMonth = sDate.slice(0, 7) !== ym || eDate.slice(0, 7) !== ym
  return `${label} ${dateRange(sDate, eDate, lang)}${half} · ${days}${crossMonth ? (lang === 'zh' ? '(本月部分)' : ' (this month)') : ''}`
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

// ── 月份直选弹窗组件 (解决用户找不到11月的问题) ──
function MonthPickerSheet({
  open,
  year,
  month,
  lang,
  onSelect,
  onClose,
}: {
  open: boolean
  year: number
  month: number
  lang: Lang
  onSelect: (y: number, m: number) => void
  onClose: () => void
}) {
  const [pickYear, setPickYear] = useState(year)

  useEffect(() => {
    if (open) setPickYear(year)
  }, [open, year])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl animate-in slide-in-from-bottom">
        {/* 顶部标题与年份切换 */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPickYear((y) => y - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 active:bg-gray-200"
            >
              <Icon d={EI.chevronL} size={16} />
            </button>
            <span className="text-base font-bold text-gray-900">
              {pickYear}{lang === 'zh' ? '年' : ''}
            </span>
            <button
              onClick={() => setPickYear((y) => y + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 active:bg-gray-200"
            >
              <Icon d={EI.chevronR} size={16} />
            </button>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <span className="text-lg leading-none font-bold">&times;</span>
          </button>
        </div>

        {/* 12个月份九宫格平铺 (1键直选11月或任意月份) */}
        <div className="grid grid-cols-4 gap-2.5 py-4">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
            const isSelected = pickYear === year && m === month
            const isNow = pickYear === THIS_YEAR && m === THIS_MONTH
            return (
              <button
                key={m}
                onClick={() => {
                  onSelect(pickYear, m)
                  onClose()
                }}
                className={`relative flex h-12 flex-col items-center justify-center rounded-xl text-sm font-semibold transition-all ${
                  isSelected
                    ? 'bg-brand text-white shadow-sm ring-2 ring-brand/30'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100 active:scale-98'
                }`}
              >
                <span>{lang === 'zh' ? MONTH_ZH[m - 1] : MONTH_EN[m - 1]}</span>
                {isNow && !isSelected && (
                  <span className="absolute bottom-1 h-1 w-1 rounded-full bg-brand" />
                )}
              </button>
            )
          })}
        </div>

        {/* 快捷按钮: 回到本月 */}
        <div className="pt-2">
          <button
            onClick={() => {
              onSelect(THIS_YEAR, THIS_MONTH)
              onClose()
            }}
            className="w-full rounded-xl bg-gray-100 py-2.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-200 active:bg-gray-300"
          >
            {lang === 'zh' ? '回到本月 (当前月份)' : 'Back to Current Month'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 简易指标磁贴 ──
function Tile({ label, danger, children }: { label: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl p-2 text-center border ${danger ? 'bg-red-50/70 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
      <p className={`text-[11px] font-medium ${danger ? 'text-[#F5222D]' : 'text-gray-400'}`}>{label}</p>
      <p className={`mt-0.5 text-[15px] font-bold tabular-nums ${danger ? 'text-[#F5222D]' : 'text-gray-900'}`}>{children}</p>
    </div>
  )
}

export default function MobileReports() {
  const auth = useEmployee({ requireManager: true })
  const { t, lang } = useMgrT()

  // 钉钉三主 Tab: 'ft' (全职月假) | 'pt' (兼职工时) | 'year' (年度余额)
  const [activeTab, setActiveTab] = useState<MainTab>('ft')
  const [year, setYear] = useState(THIS_YEAR)
  const [month, setMonth] = useState(THIS_MONTH)
  const [showMonthPicker, setShowMonthPicker] = useState(false)

  // 筛选与折叠状态
  const [filter, setFilter] = useState<Filter>('all')
  const [yearFilter, setYearFilter] = useState<YearFilter>('all')
  const [openId, setOpenId] = useState<string | null>(null)

  // 数据加载状态
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
      setEmployees(((empRes.data || []) as ReportEmployee[]).filter((e) => e && e.role !== 'manager' && (e.full_name || '').toUpperCase() !== 'CHEW HONG YI'))
      setApps((appRes.data || []) as ReportApp[])
      setHolidayDates((holRes.data || []).map((h) => h.holiday_date))
      setHours((hoursRes.data || []) as HoursRow[])
      setWorkWeek(ww)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [auth.status, year])

  // 计算报表数据 (保持 100% 底层计算逻辑完全不变)
  const monthReport = useMemo(
    () => buildMonthReport({ year, month, employees, apps, hours, holidayDates, workWeek }),
    [year, month, employees, apps, hours, holidayDates, workWeek]
  )
  const yearReport = useMemo(
    () => buildYearReport({ year, employees, apps, hours, holidayDates, workWeek }),
    [year, employees, apps, hours, holidayDates, workWeek]
  )

  // 筛选全职列表 (严格保证所有 Hook 置于顶部，防止 React Error #310)
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

  // 条件返回 (保证此时所有 React Hooks 已经按固定顺序执行完毕)
  if (auth.status !== 'ready') return <AuthStatus state={auth} />

  const { ym } = monthBounds(year, month)
  const isCurrentMonth = year === THIS_YEAR && month === THIS_MONTH
  const tot = monthReport.totals

  function shiftMonth(delta: number) {
    let m = month + delta
    let y = year
    if (m < 1) { m = 12; y -= 1 }
    if (m > 12) { m = 1; y += 1 }
    setMonth(m); setYear(y); setOpenId(null)
  }

  function handleExport() {
    if (activeTab === 'year') {
      const rows = yearReport.fullTime.map((r) => [r.emp.employee_no ?? '', r.emp.full_name, r.alEntitled, r.bf, r.alTaken, r.alBalance, r.mcTaken, r.mcEntitled, r.unpaid, r.other])
      exportCsv(`balances-${year}.csv`, ['Employee No', 'Name', 'Annual entitled', 'B/F', 'Annual taken', 'Annual balance', 'MC taken', 'MC entitled', 'Unpaid days', 'Maternity/Paternity days'], rows)
    } else if (activeTab === 'pt') {
      const rows = monthReport.partTime.map((r) => [r.emp.employee_no ?? '', r.emp.full_name, 'Part-time', '', '', '', '', r.hours ?? 'Not entered', ''])
      exportCsv(`work-hours-${ym}.csv`, ['Employee No', 'Name', 'Type', 'Annual days', 'MC days', 'Unpaid days', 'Maternity/Paternity days', 'Hours', 'Details'], rows)
    } else {
      const rows = monthReport.fullTime.map((r) => [r.emp.employee_no ?? '', r.emp.full_name, 'Full-time', r.annual, r.medical, r.unpaid, r.other, '', r.lines.map((l) => lineText(l, ym, 'en', t)).filter(Boolean).join('; ')])
      exportCsv(`report-${ym}-fulltime.csv`, ['Employee No', 'Name', 'Type', 'Annual days', 'MC days', 'Unpaid days', 'Maternity/Paternity days', 'Hours', 'Details'], rows)
    }
  }

  const notices: { text: string; href: string }[] = []
  const noticePendingT = t('noticePending') || (lang === 'zh' ? '本月有 {n} 笔申请还在待审批' : '{n} application(s) pending')
  const noticeCancelT = t('noticeCancel') || (lang === 'zh' ? '有 {n} 笔假期申请取消中' : '{n} leave(s) cancelling')
  const noticeHoursT = t('noticeHours') || (lang === 'zh' ? '{n} 位兼职员工还没录入工时' : '{n} part-time staff missing hours')

  if (monthReport.pendingCount > 0) notices.push({ text: fill(noticePendingT, monthReport.pendingCount), href: '/approve' })
  if (monthReport.cancellationCount > 0) notices.push({ text: fill(noticeCancelT, monthReport.cancellationCount), href: '/approve' })
  if (monthReport.missingHoursCount > 0 && activeTab === 'pt') {
    notices.push({ text: fill(noticeHoursT, monthReport.missingHoursCount), href: '/work-hours' })
  }

  const ftStaffCount = employees.filter((e) => e.employment_type === 'full_time').length
  const ptStaffCount = employees.filter((e) => e.employment_type === 'part_time').length
  const leaveStaffCount = monthReport.fullTime.filter((r) => r.annual + r.medical + r.unpaid + r.other > 0 || r.lines.length > 0).length

  return (
    <SubPage
      title={t('reports') || (lang === 'zh' ? '考勤月报' : 'Attendance Report')}
      backHref="/workspace"
      right={
        <button
          onClick={handleExport}
          disabled={loading}
          className="text-[14px] font-semibold text-brand transition-opacity active:opacity-70 disabled:opacity-40"
        >
          {t('exportCsv') || (lang === 'zh' ? '导出报表' : 'Export')}
        </button>
      }
    >
      {/* ── 1. 钉钉月份快捷条 (带箭头 + 胶囊可点击打开12个月平铺面板) ── */}
      <div className="flex items-center justify-between border-b border-gray-100 bg-white px-4 py-2.5 shadow-2xs">
        {activeTab !== 'year' ? (
          <>
            <button
              onClick={() => shiftMonth(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 active:bg-gray-200"
              aria-label="Previous Month"
            >
              <Icon d={EI.chevronL} size={18} />
            </button>

            {/* 点击胶囊直接打开 1~12月九宫格，1秒直接点选11月 */}
            <button
              onClick={() => setShowMonthPicker(true)}
              className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50/80 px-4 py-1.5 text-sm font-bold text-gray-900 shadow-2xs transition-all hover:border-gray-300 hover:bg-white active:scale-98"
            >
              <span>{monthDisplayTitle(year, month, lang)}</span>
              <span className="text-[10px] text-gray-400">▼</span>
            </button>

            <button
              onClick={() => shiftMonth(1)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 active:bg-gray-200"
              aria-label="Next Month"
            >
              <Icon d={EI.chevronR} size={18} />
            </button>
          </>
        ) : (
          <div className="flex w-full items-center justify-between">
            <button
              onClick={() => { setYear((y) => y - 1); setOpenId(null) }}
              className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 active:bg-gray-200"
            >
              <Icon d={EI.chevronL} size={18} />
            </button>
            <span className="text-sm font-bold text-gray-900">{year}{lang === 'zh' ? '年度' : ' Year'}</span>
            <button
              onClick={() => { setYear((y) => y + 1); setOpenId(null) }}
              className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 active:bg-gray-200"
            >
              <Icon d={EI.chevronR} size={18} />
            </button>
          </div>
        )}
      </div>

      {/* ── 2. 钉钉经典三主 Tab 栏 (全职月假 / 兼职工时 / 年度余额) ── */}
      <div className="flex border-b border-gray-200/80 bg-white px-2">
        <button
          onClick={() => { setActiveTab('ft'); setOpenId(null) }}
          className={`relative flex-1 py-3 text-center text-[13px] font-bold transition-colors ${
            activeTab === 'ft' ? 'text-brand' : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <span>{lang === 'zh' ? '全职月假' : 'Full-time'} ({ftStaffCount})</span>
          {activeTab === 'ft' && (
            <span className="absolute bottom-0 left-6 right-6 h-[2.5px] rounded-full bg-brand" />
          )}
        </button>

        <button
          onClick={() => { setActiveTab('pt'); setOpenId(null) }}
          className={`relative flex-1 py-3 text-center text-[13px] font-bold transition-colors ${
            activeTab === 'pt' ? 'text-brand' : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <span>{lang === 'zh' ? '兼职工时' : 'Part-time'} ({ptStaffCount})</span>
          {activeTab === 'pt' && (
            <span className="absolute bottom-0 left-6 right-6 h-[2.5px] rounded-full bg-brand" />
          )}
        </button>

        <button
          onClick={() => { setActiveTab('year'); setOpenId(null) }}
          className={`relative flex-1 py-3 text-center text-[13px] font-bold transition-colors ${
            activeTab === 'year' ? 'text-brand' : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <span>{lang === 'zh' ? '年度余额' : 'Annual Bal'}</span>
          {activeTab === 'year' && (
            <span className="absolute bottom-0 left-6 right-6 h-[2.5px] rounded-full bg-brand" />
          )}
        </button>
      </div>

      {/* 错误提示 */}
      {loadError && (
        <div className="mx-4 mt-3 rounded-xl bg-red-50 p-3 text-sm text-[#F5222D]">
          {t('loadFail') || (lang === 'zh' ? '数据加载失败，请刷新重试' : 'Failed to load report data')}
        </div>
      )}

      {/* 加载中动画 */}
      {loading ? (
        <div className="py-20 text-center text-sm text-gray-400">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent mb-2" />
          <p>{t('loading') || (lang === 'zh' ? '正在整理考勤数据...' : 'Loading...')}</p>
        </div>
      ) : activeTab === 'ft' ? (
        /* ══════════════════ TAB 1: 全职员工月度休假 ══════════════════ */
        <div className="space-y-3 p-4">
          {/* 单个紧凑白底 KPI 总结卡 (DingTalk Key KPI Summary Card) */}
          <div className="rounded-2xl border border-gray-200/80 bg-white p-3.5 shadow-2xs">
            <div className="grid grid-cols-4 divide-x divide-gray-100 text-center">
              {/* 无薪扣薪 (HR 核心关切点，红色高亮) */}
              <div className="px-1">
                <p className="text-[11px] font-medium text-gray-500">{t('unpaidLeave') || (lang === 'zh' ? '无薪扣薪' : 'Unpaid')}</p>
                <p className="mt-1 text-[19px] font-bold leading-none tabular-nums text-[#F5222D]">
                  {fmt(tot.unpaid)} <span className="text-[10px] font-normal text-gray-400">{t('daysUnit') || '天'}</span>
                </p>
                <p className="mt-1 text-[10px] font-medium text-red-500">
                  {tot.unpaidStaff} {t('peopleUnit') || '人'}
                </p>
              </div>

              {/* 带薪病假 (MC) */}
              <div className="px-1">
                <p className="text-[11px] font-medium text-gray-500">{t('medicalLeave') || (lang === 'zh' ? '带薪病假' : 'MC')}</p>
                <p className="mt-1 text-[19px] font-bold leading-none tabular-nums text-amber-600">
                  {fmt(tot.medical)} <span className="text-[10px] font-normal text-gray-400">{t('daysUnit') || '天'}</span>
                </p>
                <p className="mt-1 text-[10px] font-medium text-amber-600">
                  {monthReport.fullTime.filter((r) => r.medical > 0).length} {t('peopleUnit') || '人'}
                </p>
              </div>

              {/* 年假总计 */}
              <div className="px-1">
                <p className="text-[11px] font-medium text-gray-500">{t('legendAnnual') || (lang === 'zh' ? '年假总计' : 'Annual')}</p>
                <p className="mt-1 text-[19px] font-bold leading-none tabular-nums text-brand">
                  {fmt(tot.annual)} <span className="text-[10px] font-normal text-gray-400">{t('daysUnit') || '天'}</span>
                </p>
                <p className="mt-1 text-[10px] font-medium text-blue-600">
                  {monthReport.fullTime.filter((r) => r.annual > 0).length} {t('peopleUnit') || '人'}
                </p>
              </div>

              {/* 请假人次 */}
              <div className="px-1">
                <p className="text-[11px] font-medium text-gray-500">{lang === 'zh' ? '请假人次' : 'Staff On Leave'}</p>
                <p className="mt-1 text-[19px] font-bold leading-none tabular-nums text-gray-900">
                  {leaveStaffCount}<span className="text-xs font-normal text-gray-400">/{monthReport.fullTime.length}</span>
                </p>
                <p className="mt-1 text-[10px] font-medium text-emerald-600">
                  {lang === 'zh' ? '出勤' : 'Present'} {monthReport.fullTime.length - leaveStaffCount}人
                </p>
              </div>
            </div>
          </div>

          {/* 提醒通知行 */}
          {notices.length > 0 && (
            <div className="space-y-1.5">
              {notices.map((n, i) => (
                <Link
                  key={i}
                  href={n.href}
                  className="flex items-center justify-between rounded-xl border border-amber-200/80 bg-amber-50/60 px-3.5 py-2 text-xs text-amber-900 active:bg-amber-100"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    <span>{n.text}</span>
                  </div>
                  <Icon d={EI.chevronR} size={14} className="text-amber-500 shrink-0" />
                </Link>
              ))}
            </div>
          )}

          {/* 员工明细标题 + 快捷筛选胶囊 */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-gray-900">{lang === 'zh' ? '员工明细' : 'Employees'}</span>
              <span className="text-xs text-gray-400">({ftFiltered.length}{lang === 'zh' ? '人' : ''})</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setFilter('all')}
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all ${
                  filter === 'all'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {lang === 'zh' ? '全部' : 'All'}
              </button>
              <button
                onClick={() => setFilter('leave')}
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all ${
                  filter === 'leave'
                    ? 'bg-brand text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {lang === 'zh' ? '仅看休假' : 'Leaves'}
              </button>
              {tot.unpaid > 0 && (
                <button
                  onClick={() => setFilter('unpaid')}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all ${
                    filter === 'unpaid'
                      ? 'bg-[#F5222D] text-white'
                      : 'bg-red-50 text-[#F5222D] hover:bg-red-100'
                  }`}
                >
                  {lang === 'zh' ? '仅看无薪' : 'Unpaid'}
                </button>
              )}
            </div>
          </div>

          {/* 员工列表卡片 */}
          <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-2xs">
            {ftFiltered.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">
                {filter === 'all' ? (t('noFullTime') || '暂无全职员工') : (t('noItems') || '无符合筛选条件的员工')}
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
                      className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors active:bg-gray-50 disabled:active:bg-white"
                    >
                      {/* 序号 */}
                      <span className="w-4 shrink-0 text-center text-xs font-bold text-gray-300">
                        {i + 1}
                      </span>

                      {/* 头像 */}
                      <Avatar name={r.emp.full_name} size={38} />

                      {/* 姓名与工号 */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className={`truncate text-[14px] font-bold ${hasLeave ? 'text-gray-900' : 'text-gray-700'}`}>
                            {r.emp.full_name}
                          </p>
                          {!r.emp.is_active && (
                            <span className="rounded bg-gray-100 px-1 py-0.2 text-[9px] text-gray-400">
                              {t('inactive') || '离职'}
                            </span>
                          )}
                          {r.cancellationRequested && (
                            <span className="rounded bg-amber-50 px-1 py-0.2 text-[9px] font-medium text-amber-700 ring-1 ring-amber-200">
                              {t('cancelReq') || '取消中'}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] font-medium text-gray-400">
                          {r.emp.employee_no ? `#${r.emp.employee_no}` : ''}
                        </p>
                      </div>

                      {/* 右侧外显高对比度胶囊标签 */}
                      <div className="flex shrink-0 items-center gap-1.5">
                        {r.unpaid > 0 && (
                          <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-bold text-[#F5222D]">
                            {lang === 'zh' ? '无薪' : 'Unpaid'} {fmt(r.unpaid)}{t('daysUnit') || '天'}
                          </span>
                        )}
                        {r.medical > 0 && (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                            {lang === 'zh' ? '病假' : 'MC'} {fmt(r.medical)}{t('daysUnit') || '天'}
                          </span>
                        )}
                        {r.annual > 0 && (
                          <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-brand">
                            {lang === 'zh' ? '年假' : 'AL'} {fmt(r.annual)}{t('daysUnit') || '天'}
                          </span>
                        )}
                        {r.other > 0 && (
                          <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700">
                            {fmt(r.other)}{t('daysUnit') || '天'}
                          </span>
                        )}
                        {!hasLeave && (
                          <span className="text-[12px] font-medium text-gray-400">
                            {lang === 'zh' ? '正常出勤 (无休假)' : 'Normal Attendance'}
                          </span>
                        )}

                        {hasLeave && (
                          <Icon
                            d={EI.chevronR}
                            size={14}
                            className={`ml-1 text-gray-300 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
                          />
                        )}
                      </div>
                    </button>

                    {/* 展开查看时间轴明细 */}
                    {open && (
                      <div className="border-t border-gray-100 bg-gray-50/70 px-4 py-3 pl-12 transition-all">
                        {details.length > 0 ? (
                          <div className="space-y-2">
                            {details.map((d, k) => (
                              <div key={k} className="flex items-start gap-2 text-[12px] text-gray-700">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                                <span className="font-medium leading-relaxed">{d}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400">{lang === 'zh' ? '暂无具体日期明细' : 'No date details'}</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}

            {/* 底部全职合计栏 */}
            {ftFiltered.length > 0 && (
              <div className="grid grid-cols-4 border-t border-gray-100 bg-gray-50/80 px-3.5 py-2.5 text-center">
                <div>
                  <p className="text-[10px] text-gray-400">{t('legendAnnual') || '年假'}</p>
                  <p className="text-xs font-bold tabular-nums text-gray-800">{fmt(tot.annual)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400">{t('medicalLeave') || '病假'}</p>
                  <p className="text-xs font-bold tabular-nums text-amber-700">{fmt(tot.medical)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#F5222D]">{t('unpaidLeave') || '无薪'}</p>
                  <p className="text-xs font-bold tabular-nums text-[#F5222D]">{fmt(tot.unpaid)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400">{t('matPat') || '产/陪产'}</p>
                  <p className="text-xs font-bold tabular-nums text-gray-800">{fmt(tot.other)}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : activeTab === 'pt' ? (
        /* ══════════════════ TAB 2: 兼职工时 ══════════════════ */
        <div className="space-y-3 p-4">
          {/* 兼职工时汇总卡 */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl border border-brand/20 bg-gradient-to-br from-[#E6F4FF] to-white p-3.5 shadow-2xs">
              <p className="text-xs font-medium text-brand">{t('ptHours') || (lang === 'zh' ? '总工时' : 'Total Hours')}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">
                {fmt(tot.hours)} <span className="text-xs font-normal text-gray-500">h</span>
              </p>
              <p className="mt-0.5 text-[11px] text-gray-400">{monthReport.partTime.length} {t('peopleUnit') || '人'}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-[#FFFBE6] p-3.5 shadow-2xs">
              <p className="text-xs font-medium text-amber-800">{t('notEntered') || (lang === 'zh' ? '待录入' : 'Pending Hours')}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-amber-700">
                {monthReport.missingHoursCount} <span className="text-xs font-normal text-amber-600">{t('peopleUnit') || '人'}</span>
              </p>
              <Link href="/work-hours" className="mt-0.5 inline-flex items-center text-[11px] font-semibold text-brand">
                {t('enterHours') || (lang === 'zh' ? '录入工时' : 'Enter')} &rarr;
              </Link>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-sm font-bold text-gray-900">{lang === 'zh' ? '兼职列表' : 'Part-time Staff'}</span>
            <Link href="/work-hours" className="text-xs font-semibold text-brand hover:underline">
              {t('enterHours') || (lang === 'zh' ? '去录入' : 'Enter Hours')} &rarr;
            </Link>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-2xs">
            {monthReport.partTime.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">{t('noPartTime') || '暂无兼职员工'}</div>
            ) : (
              monthReport.partTime.map((r, i) => (
                <Link
                  key={r.emp.id}
                  href="/work-hours"
                  className={`flex items-center gap-3 px-3.5 py-3 transition-colors active:bg-gray-50 ${i ? 'border-t border-gray-100' : ''}`}
                >
                  <span className="w-4 shrink-0 text-center text-xs font-bold text-gray-300">{i + 1}</span>
                  <Avatar name={r.emp.full_name} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-bold text-gray-900">{r.emp.full_name}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-gray-400">
                      {r.emp.employee_no ? `#${r.emp.employee_no} · ` : ''}{lang === 'zh' ? '兼职' : 'Part-time'}
                    </p>
                  </div>
                  {r.hours === null ? (
                    <span className="shrink-0 rounded-full border border-amber-200 bg-[#FFFBE6] px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                      {t('notEntered') || '待录入'}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-sm font-bold tabular-nums text-emerald-700">
                      {fmt(r.hours)} h
                    </span>
                  )}
                  <Icon d={EI.chevronR} size={14} className="text-gray-300 shrink-0" />
                </Link>
              ))
            )}
          </div>
        </div>
      ) : (
        /* ══════════════════ TAB 3: 年度余额 ══════════════════ */
        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-gray-900">{year}{lang === 'zh' ? '年度假余额' : ' Annual Balances'}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setYearFilter('all')}
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  yearFilter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {lang === 'zh' ? '全部' : 'All'}
              </button>
              <button
                onClick={() => setYearFilter('overdrawn')}
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  yearFilter === 'overdrawn' ? 'bg-[#F5222D] text-white' : 'bg-red-50 text-[#F5222D]'
                }`}
              >
                {lang === 'zh' ? '已透支' : 'Overdrawn'}
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-2xs">
            {ftYearFiltered.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">{t('noFullTime') || '暂无全职员工'}</div>
            ) : (
              ftYearFiltered.map((r, i) => {
                const open = openId === r.emp.id
                const negative = r.alBalance < 0
                const manual = r.emp.annual_leave_entitlement_override != null

                return (
                  <div key={r.emp.id} className={i ? 'border-t border-gray-100' : ''}>
                    <button
                      onClick={() => setOpenId(open ? null : r.emp.id)}
                      className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors active:bg-gray-50"
                    >
                      <span className="w-4 shrink-0 text-center text-xs font-bold text-gray-300">{i + 1}</span>
                      <Avatar name={r.emp.full_name} size={38} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-bold text-gray-900">{r.emp.full_name}</p>
                        <p className="mt-0.5 truncate text-[11px] text-gray-400">
                          {t('entitled') || '应享'} {fmt(r.alEntitled)}{manual ? '*' : ''}
                          {r.bf > 0 ? ` + 结转 ${fmt(r.bf)}` : ''} · 已用 {fmt(r.alTaken)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={`text-lg font-bold leading-none tabular-nums ${negative ? 'text-[#F5222D]' : 'text-brand'}`}>
                          {fmt(r.alBalance)}
                        </p>
                        <p className="mt-1 text-[10px] font-medium text-gray-400">{t('annualBalance') || '年假余额'}</p>
                      </div>
                      <Icon
                        d={EI.chevronR}
                        size={14}
                        className={`text-gray-300 transition-transform ${open ? 'rotate-90' : ''}`}
                      />
                    </button>

                    {open && (
                      <div className="border-t border-gray-100 bg-gray-50/70 p-3 pl-10">
                        <div className="grid grid-cols-3 gap-1.5">
                          <Tile label={t('entitled') || '应享'}>{fmt(r.alEntitled)}{manual ? '*' : ''}</Tile>
                          <Tile label={t('carriedFwd') || '结转'}>{fmt(r.bf)}</Tile>
                          <Tile label={t('taken') || '已用'}>{fmt(r.alTaken)}</Tile>
                          <Tile label={t('mcUsed') || '病假已用'}>{fmt(r.mcTaken)}<span className="text-[10px] text-gray-400">/{fmt(r.mcEntitled)}</span></Tile>
                          <Tile label={t('legendUnpaid') || '无薪假'} danger={r.unpaid > 0}>{r.unpaid > 0 ? fmt(r.unpaid) : '–'}</Tile>
                          <Tile label={t('matPat') || '产/陪产'}>{r.other > 0 ? fmt(r.other) : '–'}</Tile>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* ── 底部月份平铺直选面板 (MonthPickerSheet) ── */}
      <MonthPickerSheet
        open={showMonthPicker}
        year={year}
        month={month}
        lang={lang}
        onSelect={(y, m) => {
          setYear(y)
          setMonth(m)
          setOpenId(null)
        }}
        onClose={() => setShowMonthPicker(false)}
      />
    </SubPage>
  )
}
