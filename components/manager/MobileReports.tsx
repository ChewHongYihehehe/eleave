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

// 报表 · 手机版(钉钉风格):
//  · 顶部:按月 / 年度余额 切换 + 月份(年份)步进器
//  · 月报:蓝色摘要卡(无薪假 / 病假 / 兼职工时)→ 提醒行 → 全职员工列表(点开看明细)→ 兼职员工列表
//  · 年度余额:一人一行,右边是年假余额,点开看明细
// 计算全部在 lib/reportData.ts,这里只负责取数据和排版。

const THIS_YEAR = new Date().getFullYear()
const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const GRADIENT = 'linear-gradient(135deg, #1677FF 0%, #4096FF 60%, #69B1FF 100%)'

type Lang = 'zh' | 'en'

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

// 一笔假在明细里显示的文字;历史导入的年假没有真实日期,不显示
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
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }) // \ufeff 让 Excel 正确显示中文
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── 小零件 ──

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="flex rounded-lg bg-gray-200/70 p-0.5">
      {options.map(([k, label]) => (
        <button key={k} onClick={() => onChange(k)} className={`flex-1 rounded-md py-1.5 text-sm ${value === k ? 'bg-white font-semibold text-gray-900 shadow-sm' : 'text-gray-500'}`}>
          {label}
        </button>
      ))}
    </div>
  )
}

function Stepper({ label, onPrev, onNext, action }: { label: string; onPrev: () => void; onNext: () => void; action?: { label: string; onClick: () => void } }) {
  return (
    <Card className="mt-3">
      <div className="flex h-12 items-center">
        <button onClick={onPrev} className="flex h-12 w-12 items-center justify-center text-gray-500 active:bg-gray-50"><Icon d={EI.chevronL} size={20} /></button>
        <div className="flex flex-1 items-center justify-center gap-2">
          <span className="text-base font-semibold text-gray-900">{label}</span>
          {action && <button onClick={action.onClick} className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs text-brand">{action.label}</button>}
        </div>
        <button onClick={onNext} className="flex h-12 w-12 items-center justify-center text-gray-500 active:bg-gray-50"><Icon d={EI.chevronR} size={20} /></button>
      </div>
    </Card>
  )
}

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 pb-2 pt-5">
      <p className="text-sm font-medium text-gray-500">{children}</p>
      {right}
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-full px-3 py-1 text-xs ${active ? 'bg-brand text-white' : 'bg-white text-gray-500'}`}>{children}</button>
  )
}

function Tile({ label, danger, children }: { label: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <div className={`rounded-lg px-1 py-2 text-center ${danger ? 'bg-[#FFF1F0]' : 'bg-white'}`}>
      <p className={`text-[11px] ${danger ? 'text-[#F5222D]' : 'text-gray-400'}`}>{label}</p>
      <p className={`mt-0.5 text-[15px] font-semibold tabular-nums ${danger ? 'text-[#F5222D]' : 'text-gray-900'}`}>{children}</p>
    </div>
  )
}

function InactiveTag({ show, label }: { show: boolean; label: string }) {
  if (!show) return null
  return <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 align-middle text-[11px] font-normal text-gray-500">{label}</span>
}

function Chevron({ open }: { open: boolean }) {
  return <Icon d={EI.chevronR} size={16} className={`shrink-0 text-gray-300 transition-transform ${open ? 'rotate-90' : ''}`} />
}

// ── 页面 ──

export default function MobileReports() {
  const auth = useEmployee({ requireManager: true })
  const { t, lang } = useMgrT()

  const [view, setView] = useState<'month' | 'year'>('month')
  const [year, setYear] = useState(THIS_YEAR)
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [onlyLeave, setOnlyLeave] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [employees, setEmployees] = useState<ReportEmployee[]>([])
  const [apps, setApps] = useState<ReportApp[]>([])
  const [hours, setHours] = useState<HoursRow[]>([])
  const [holidayDates, setHolidayDates] = useState<string[]>([])
  const [workWeek, setWorkWeek] = useState<WorkWeek>(DEFAULT_WORK_WEEK)

  // 一次抓"整年"的资料;同一年里切换月份不用重新抓
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
      // 和电脑版一致:负责人本人不出现在报表里
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
      for (const r of monthReport.fullTime) {
        rows.push([r.emp.employee_no ?? '', r.emp.full_name, 'Full-time', r.annual, r.medical, r.unpaid, r.other, '', r.lines.map((l) => lineText(l, ym, 'en', t)).filter(Boolean).join('; ')])
      }
      for (const r of monthReport.partTime) {
        rows.push([r.emp.employee_no ?? '', r.emp.full_name, 'Part-time', '', '', '', '', r.hours ?? 'Not entered', ''])
      }
      exportCsv(`report-${ym}.csv`, ['Employee No', 'Name', 'Type', 'Annual days', 'MC days', 'Unpaid days', 'Maternity/Paternity days', 'Hours', 'Details'], rows)
    } else {
      const rows = yearReport.fullTime.map((r) => [r.emp.employee_no ?? '', r.emp.full_name, r.alEntitled, r.bf, r.alTaken, r.alBalance, r.mcTaken, r.mcEntitled, r.unpaid, r.other])
      exportCsv(`balances-${year}.csv`, ['Employee No', 'Name', 'Annual entitled', 'B/F', 'Annual taken', 'Annual balance', 'MC taken', 'MC entitled', 'Unpaid days', 'Maternity/Paternity days'], rows)
    }
  }

  const ftRows = onlyLeave ? monthReport.fullTime.filter((r) => r.lines.length > 0) : monthReport.fullTime

  const notices: { text: string; href: string }[] = []
  if (monthReport.pendingCount > 0) notices.push({ text: fill(t('noticePending'), monthReport.pendingCount), href: '/approve' })
  if (monthReport.cancellationCount > 0) notices.push({ text: fill(t('noticeCancel'), monthReport.cancellationCount), href: '/approve' })
  if (monthReport.missingHoursCount > 0) notices.push({ text: fill(t('noticeHours'), monthReport.missingHoursCount), href: '/work-hours' })

  return (
    <SubPage
      title={t('reports')}
      backHref="/workspace"
      right={<button onClick={handleExport} disabled={loading} className="text-[15px] text-brand disabled:opacity-40">{t('exportCsv')}</button>}
    >
      <div className="px-4 pt-3">
        <Segmented value={view} onChange={(v) => { setView(v); setOpenId(null) }} options={[['month', t('tabMonth')], ['year', t('tabYear')]]} />
      </div>

      {view === 'month' ? (
        <Stepper
          label={monthTitle(year, month, lang)}
          onPrev={() => shiftMonth(-1)}
          onNext={() => shiftMonth(1)}
          action={isCurrentMonth ? undefined : { label: t('backThisMonth'), onClick: () => { setYear(THIS_YEAR); setMonth(new Date().getMonth() + 1); setOpenId(null) } }}
        />
      ) : (
        <Stepper label={`${year}${lang === 'zh' ? '年' : ''}`} onPrev={() => { setYear(year - 1); setOpenId(null) }} onNext={() => { setYear(year + 1); setOpenId(null) }} />
      )}

      {loadError && <p className="mx-4 mt-3 rounded-lg bg-[#FFF1F0] p-3 text-sm text-[#F5222D]">{t('loadFail')}</p>}

      {loading ? (
        <p className="py-16 text-center text-sm text-gray-400">{t('loading')}</p>
      ) : view === 'month' ? (
        <>
          {/* 摘要卡 */}
          <div className="mx-4 mt-3 overflow-hidden rounded-2xl text-white" style={{ background: GRADIENT }}>
            <div className="grid grid-cols-3">
              <div className="border-r border-white/20 px-4 py-4">
                <p className="text-xs text-blue-100">{t('unpaidLeave')}</p>
                <p className="mt-1 text-[26px] font-bold leading-none tabular-nums">{fmt(tot.unpaid)}<span className="ml-1 text-xs font-normal text-blue-100">{t('daysUnit')}</span></p>
                <p className="mt-1.5 text-[11px] text-blue-100">{tot.unpaidStaff} {t('peopleUnit')}</p>
              </div>
              <div className="border-r border-white/20 px-4 py-4">
                <p className="text-xs text-blue-100">{t('medicalLeave')}</p>
                <p className="mt-1 text-[26px] font-bold leading-none tabular-nums">{fmt(tot.medical)}<span className="ml-1 text-xs font-normal text-blue-100">{t('daysUnit')}</span></p>
                <p className="mt-1.5 text-[11px] text-blue-100">{t('paidTag')}</p>
              </div>
              <div className="px-4 py-4">
                <p className="text-xs text-blue-100">{t('ptHours')}</p>
                <p className="mt-1 text-[26px] font-bold leading-none tabular-nums">{fmt(tot.hours)}<span className="ml-1 text-xs font-normal text-blue-100">h</span></p>
                <p className="mt-1.5 text-[11px] text-blue-100">{monthReport.partTime.length} {t('peopleUnit')}</p>
              </div>
            </div>
          </div>

          {/* 提醒行 */}
          {notices.length > 0 && (
            <Card className="mt-3">
              {notices.map((n, i) => (
                <Link key={i} href={n.href} className={`flex items-start gap-2.5 px-4 py-3 active:bg-gray-50 ${i ? 'border-t border-gray-100' : ''}`}>
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#FA8C16]" />
                  <p className="flex-1 text-[13px] leading-snug text-gray-700">{n.text}</p>
                  <Icon d={EI.chevronR} size={16} className="mt-0.5 shrink-0 text-gray-300" />
                </Link>
              ))}
            </Card>
          )}

          {/* 全职 */}
          <SectionTitle
            right={
              <div className="flex gap-1.5">
                <Chip active={!onlyLeave} onClick={() => setOnlyLeave(false)}>{t('filterAll')}</Chip>
                <Chip active={onlyLeave} onClick={() => setOnlyLeave(true)}>{t('filterLeave')}</Chip>
              </div>
            }
          >
            {t('ftStaff')} ({ftRows.length})
          </SectionTitle>
          <Card>
            {ftRows.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">{onlyLeave ? t('noItems') : t('noFullTime')}</p>
            ) : (
              ftRows.map((r, i) => {
                const details = r.lines.map((l) => lineText(l, ym, lang, t)).filter((x): x is string => Boolean(x))
                const hasLeave = r.annual + r.medical + r.unpaid + r.other > 0 || details.length > 0
                const open = openId === r.emp.id
                const parts: string[] = []
                if (r.annual > 0) parts.push(`${t('legendAnnual')} ${fmt(r.annual)}`)
                if (r.medical > 0) parts.push(`${t('legendMedical')} ${fmt(r.medical)}`)
                if (r.other > 0) parts.push(`${t('matPat')} ${fmt(r.other)}`)
                const sub = hasLeave ? (parts.length ? parts.join(' · ') : details.join(' · ')) : t('noLeave')
                return (
                  <div key={r.emp.id} className={i ? 'border-t border-gray-100' : ''}>
                    <button
                      disabled={!hasLeave}
                      onClick={() => setOpenId(open ? null : r.emp.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-gray-50 disabled:active:bg-white"
                    >
                      <Avatar name={r.emp.full_name} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-[15px] font-medium ${hasLeave ? 'text-gray-900' : 'text-gray-400'}`}>
                          {r.emp.full_name}<InactiveTag show={!r.emp.is_active} label={t('inactive')} />
                        </p>
                        <p className="mt-0.5 truncate text-xs text-gray-400">{sub}</p>
                      </div>
                      {r.unpaid > 0 && (
                        <span className="shrink-0 rounded-full bg-[#FFF1F0] px-2 py-0.5 text-xs font-medium text-[#F5222D]">{t('legendUnpaid')} {fmt(r.unpaid)}</span>
                      )}
                      {hasLeave && <Chevron open={open} />}
                    </button>
                    {open && (
                      <div className="bg-gray-50 px-4 pb-3 pt-3">
                        <div className="grid grid-cols-4 gap-2">
                          <Tile label={t('legendAnnual')}>{r.annual > 0 ? fmt(r.annual) : '–'}</Tile>
                          <Tile label={t('legendMedical')}>{r.medical > 0 ? fmt(r.medical) : '–'}</Tile>
                          <Tile label={t('legendUnpaid')} danger={r.unpaid > 0}>{r.unpaid > 0 ? fmt(r.unpaid) : '–'}</Tile>
                          <Tile label={t('matPat')}>{r.other > 0 ? fmt(r.other) : '–'}</Tile>
                        </div>
                        {details.length > 0 && (
                          <ul className="mt-3 space-y-1.5">
                            {details.map((d, k) => (
                              <li key={k} className="flex gap-2 text-[13px] text-gray-600"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300" />{d}</li>
                            ))}
                          </ul>
                        )}
                        {r.cancellationRequested && <p className="mt-2.5 text-xs text-[#FA8C16]">{t('sCancelReq')}</p>}
                      </div>
                    )}
                  </div>
                )
              })
            )}
            {ftRows.length > 0 && (
              <div className="grid grid-cols-4 gap-2 border-t border-gray-100 bg-gray-50 px-4 py-3 text-center">
                <div><p className="text-[11px] text-gray-400">{t('legendAnnual')}</p><p className="text-[15px] font-semibold tabular-nums text-gray-900">{fmt(tot.annual)}</p></div>
                <div><p className="text-[11px] text-gray-400">{t('legendMedical')}</p><p className="text-[15px] font-semibold tabular-nums text-gray-900">{fmt(tot.medical)}</p></div>
                <div><p className="text-[11px] text-[#F5222D]">{t('legendUnpaid')}</p><p className="text-[15px] font-semibold tabular-nums text-[#F5222D]">{fmt(tot.unpaid)}</p></div>
                <div><p className="text-[11px] text-gray-400">{t('matPat')}</p><p className="text-[15px] font-semibold tabular-nums text-gray-900">{fmt(tot.other)}</p></div>
              </div>
            )}
          </Card>

          {/* 兼职 */}
          <SectionTitle>{t('ptStaff')} ({monthReport.partTime.length})</SectionTitle>
          <Card>
            {monthReport.partTime.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">{t('noPartTime')}</p>
            ) : (
              <>
                {monthReport.partTime.map((r, i) => (
                  <Link key={r.emp.id} href="/work-hours" className={`flex items-center gap-3 px-4 py-3 active:bg-gray-50 ${i ? 'border-t border-gray-100' : ''}`}>
                    <Avatar name={r.emp.full_name} size={40} />
                    <p className="min-w-0 flex-1 truncate text-[15px] font-medium text-gray-900">
                      {r.emp.full_name}<InactiveTag show={!r.emp.is_active} label={t('inactive')} />
                    </p>
                    {r.hours === null ? (
                      <span className="shrink-0 rounded-full bg-[#FFF7E6] px-2 py-0.5 text-xs font-medium text-[#FA8C16]">{t('notEntered')}</span>
                    ) : (
                      <span className="shrink-0 text-[15px] font-semibold tabular-nums text-gray-900">{fmt(r.hours)} h</span>
                    )}
                    <Icon d={EI.chevronR} size={16} className="shrink-0 text-gray-300" />
                  </Link>
                ))}
                <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-4 py-3">
                  <span className="text-sm text-gray-500">{t('total')}</span>
                  <span className="text-[15px] font-semibold tabular-nums text-gray-900">{fmt(tot.hours)} h</span>
                </div>
              </>
            )}
          </Card>
          <p className="mx-5 mt-3 text-xs leading-relaxed text-gray-400">{t('monthNote')}</p>
        </>
      ) : (
        <>
          <SectionTitle>{t('ftStaff')} ({yearReport.fullTime.length})</SectionTitle>
          <Card>
            {yearReport.fullTime.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">{t('noFullTime')}</p>
            ) : (
              yearReport.fullTime.map((r, i) => {
                const open = openId === r.emp.id
                const negative = r.alBalance < 0
                const manual = r.emp.annual_leave_entitlement_override != null
                return (
                  <div key={r.emp.id} className={i ? 'border-t border-gray-100' : ''}>
                    <button onClick={() => setOpenId(open ? null : r.emp.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-gray-50">
                      <Avatar name={r.emp.full_name} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium text-gray-900">
                          {r.emp.full_name}<InactiveTag show={!r.emp.is_active} label={t('inactive')} />
                        </p>
                        <p className="mt-0.5 truncate text-xs text-gray-400">
                          {t('entitled')} {fmt(r.alEntitled)}{manual ? '*' : ''}{r.bf > 0 ? ` + ${t('carriedFwd')} ${fmt(r.bf)}` : ''} · {t('taken')} {fmt(r.alTaken)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={`text-xl font-semibold leading-none tabular-nums ${negative ? 'text-[#F5222D]' : 'text-brand'}`}>{fmt(r.alBalance)}</p>
                        <p className="mt-1 text-[11px] text-gray-400">{t('annualBalance')}</p>
                      </div>
                      <Chevron open={open} />
                    </button>
                    {open && (
                      <div className="bg-gray-50 px-4 pb-3 pt-3">
                        <div className="grid grid-cols-3 gap-2">
                          <Tile label={t('entitled')}>{fmt(r.alEntitled)}{manual ? '*' : ''}</Tile>
                          <Tile label={t('carriedFwd')}>{fmt(r.bf)}</Tile>
                          <Tile label={t('taken')}>{fmt(r.alTaken)}</Tile>
                          <Tile label={t('mcUsed')}>{fmt(r.mcTaken)}<span className="text-xs font-normal text-gray-400"> / {fmt(r.mcEntitled)}</span></Tile>
                          <Tile label={t('legendUnpaid')} danger={r.unpaid > 0}>{r.unpaid > 0 ? fmt(r.unpaid) : '–'}</Tile>
                          <Tile label={t('matPat')}>{r.other > 0 ? fmt(r.other) : '–'}</Tile>
                        </div>
                        {r.alPending > 0 && <p className="mt-2.5 text-xs text-[#FA8C16]">{fmt(r.alPending)} {t('pendingIncluded')}</p>}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </Card>

          <SectionTitle>{t('ptStaff')} ({yearReport.partTime.length})</SectionTitle>
          <Card>
            {yearReport.partTime.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">{t('noPartTime')}</p>
            ) : (
              yearReport.partTime.map((r, i) => (
                <Link key={r.emp.id} href="/work-hours" className={`flex items-center gap-3 px-4 py-3 active:bg-gray-50 ${i ? 'border-t border-gray-100' : ''}`}>
                  <Avatar name={r.emp.full_name} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-gray-900">
                      {r.emp.full_name}<InactiveTag show={!r.emp.is_active} label={t('inactive')} />
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">{t('monthsEntered')} {r.monthsEntered} {t('monthsUnit')}</p>
                  </div>
                  <span className="shrink-0 text-[15px] font-semibold tabular-nums text-gray-900">{fmt(r.totalHours)} h</span>
                  <Icon d={EI.chevronR} size={16} className="shrink-0 text-gray-300" />
                </Link>
              ))
            )}
          </Card>
          <p className="mx-5 mt-3 text-xs leading-relaxed text-gray-400">{t('yearNote')}</p>
        </>
      )}
    </SubPage>
  )
}
