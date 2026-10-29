'use client'
import React from 'react'

import MobileWorkHoursPage from '@/components/manager/MobileWorkHours'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import ManagerShell from '@/components/ManagerShell'
import { useLang } from '@/lib/lang'
import { useEmployee } from '@/lib/useEmployee'
import AuthStatus from '@/components/AuthStatus'

type Employee = { id: string; full_name: string }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const THIS_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => THIS_YEAR - 2 + i) // 2 years back ? 2 years ahead

function getInitials(name: string) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function SearchIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`h-4 w-4 shrink-0 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}

function DownloadIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`h-4 w-4 shrink-0 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  )
}

function ChevronLeftIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`h-4 w-4 shrink-0 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  )
}

function ChevronRightIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`h-4 w-4 shrink-0 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

function ClockIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`h-5 w-5 shrink-0 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
    </svg>
  )
}

function UsersIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`h-5 w-5 shrink-0 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )
}

function CalendarIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`h-5 w-5 shrink-0 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

function MetricCard({
  icon,
  label,
  value,
  unit,
  subtext,
  tone = 'blue',
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  unit?: string
  subtext?: string
  tone?: 'blue' | 'teal' | 'amber' | 'slate'
}) {
  const toneClasses = {
    blue: 'text-pine bg-pine-soft border-pine/20',
    teal: 'text-emerald-600 bg-emerald-50 border-emerald-200/60',
    amber: 'text-amber-600 bg-amber-50 border-amber-200/60',
    slate: 'text-slate-700 bg-slate-100 border-slate-200',
  }[tone]

  return (
    <div className="flex items-center justify-between rounded-xl border border-line bg-surface p-4 shadow-sm transition-all hover:shadow-md">
      <div>
        <p className="text-xs font-medium text-ink-faint">{label}</p>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-2xl font-bold tracking-tight text-ink tabular-nums">{value}</span>
          {unit && <span className="text-xs font-medium text-ink-soft">{unit}</span>}
        </div>
        {subtext && <p className="mt-1 text-[11px] text-ink-faint">{subtext}</p>}
      </div>
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${toneClasses}`}>
        {icon}
      </div>
    </div>
  )
}

function DesktopWorkHours(): React.ReactElement | null {
  const { lang } = useLang()
  const router = useRouter()
  const auth = useEmployee({ requireManager: true })
  const [employees, setEmployees] = useState<Employee[]>([])
  const [year, setYear] = useState(THIS_YEAR)
  const [searchQuery, setSearchQuery] = useState('')

  // hours[`${employeeId}|${month}`] ? string value of that cell (controlled input)
  const [hours, setHours] = useState<Record<string, string>>({})
  // saving = set of keys currently being upserted
  const [saving, setSaving] = useState<Set<string>>(new Set())

  // Load part-time employee list once access is confirmed
  useEffect(() => {
    if (auth.status === 'ready') loadEmployees()
  }, [auth.status])

  // Reload grid whenever year changes
  useEffect(() => {
    if (auth.status === 'ready') loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, auth.status])

  async function loadEmployees() {
    const { data: emps } = await supabase
      .from('employees')
      .select('id, full_name')
      .eq('employment_type', 'part_time')
      .eq('is_active', true)
      .order('full_name', { ascending: true })

    if (emps) setEmployees(emps)
  }

  async function loadData() {
    const { data } = await supabase
      .from('monthly_work_hours')
      .select('employee_id, month, total_hours')
      .eq('year', year)

    const map: Record<string, string> = {}
    for (const row of data || []) {
      if (row.total_hours > 0) {
        map[key(row.employee_id, row.month)] = String(row.total_hours)
      }
    }
    setHours(map)
  }

  function key(empId: string, month: number) {
    return `${empId}|${month}`
  }

  function handleChange(empId: string, month: number, value: string) {
    setHours((prev) => ({ ...prev, [key(empId, month)]: value }))
  }

  async function handleBlur(empId: string, month: number, value: string) {
    const k = key(empId, month)
    const num = value === '' ? 0 : Number(value)
    if (isNaN(num)) return

    setSaving((prev) => new Set(prev).add(k))

    if (num <= 0) {
      // Zero or empty ? delete the row to keep the table clean
      await supabase
        .from('monthly_work_hours')
        .delete()
        .eq('employee_id', empId)
        .eq('year', year)
        .eq('month', month)
      setHours((prev) => {
        const next = { ...prev }
        delete next[k]
        return next
      })
    } else {
      await supabase
        .from('monthly_work_hours')
        .upsert({ employee_id: empId, year, month, total_hours: num }, {
          onConflict: 'employee_id,year,month',
        })
    }

    setSaving((prev) => {
      const next = new Set(prev)
      next.delete(k)
      return next
    })
  }

  // -- Totals --------------------------------------------------------------

  function rowTotal(empId: string) {
    let t = 0
    for (let m = 1; m <= 12; m++) {
      t += Number(hours[key(empId, m)] || 0)
    }
    return t
  }

  function colTotal(month: number) {
    let t = 0
    for (const emp of employees) {
      t += Number(hours[key(emp.id, month)] || 0)
    }
    return t
  }

  function grandTotal() {
    return employees.reduce((s, emp) => s + rowTotal(emp.id), 0)
  }

  // -- Filtered List -------------------------------------------------------

  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees
    const q = searchQuery.toLowerCase().trim()
    return employees.filter((e) => e.full_name.toLowerCase().includes(q))
  }, [employees, searchQuery])

  // -- Export CSV -----------------------------------------------------------

  function handleExportCsv() {
    const header = ['员工姓名 (Employee)', ...MONTHS, '总计工时 (Total Hours)']
    const rows = employees.map((emp) => [
      emp.full_name,
      ...Array.from({ length: 12 }, (_, i) => hours[key(emp.id, i + 1)] || '0'),
      String(rowTotal(emp.id).toFixed(1)),
    ])
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `兼职工时明细-${year}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // -------------------------------------------------------------------------

  const isCurrentYear = year === THIS_YEAR
  const currentMonthNumber = new Date().getMonth() + 1

  if (auth.status !== 'ready') return <AuthStatus state={auth} />

  return (
    <ManagerShell>
      <div className="space-y-6 pb-12">
        {/* -- Top Header ------------------------------------------ */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight text-ink">{lang === 'ms' ? 'Pengurusan Jam Kerja Sambilan' : lang === 'zh' ? '兼职工时管理' : 'Part-Time Work Hours'}</h1>
              <span className="rounded-full bg-pine-soft px-2.5 py-0.5 text-xs font-semibold text-pine">
                Work Hours
              </span>
            </div>
            <p className="mt-1 text-sm text-ink-faint">
              {lang === 'ms' ? 'Rekod dan kira jam kerja sambilan bulanan. Simpan automatik apabila keluar dari kotak input. Menyokong eksport tahunan.' : lang === 'zh' ? '按月记录并核算兼职员工工时,离开输入框时自动保存,支持导出年度台账' : 'Log and calculate monthly part-time work hours. Auto-saves on blur. Supports annual ledger and export.'}
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2 sm:pt-0">
            <button
              onClick={handleExportCsv}
              disabled={employees.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink shadow-sm transition hover:bg-paper disabled:opacity-50"
            >
              <DownloadIcon className="h-4 w-4 text-pine" />
              <span>{lang === 'ms' ? 'Eksport Excel / CSV' : lang === 'zh' ? '导出 Excel / CSV' : 'Export Excel / CSV'}</span>
            </button>
          </div>
        </div>

        {/* -- Metric Cards ---------------------------------------- */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={<ClockIcon className="h-5 w-5" />}
            label={lang === 'ms' ? 'Jumlah Jam Sambilan Tahunan' : lang === 'zh' ? '兼职年度总工时' : 'Annual Total PT Hours'}
            value={grandTotal().toFixed(1)}
            unit="h"
            subtext={lang === 'ms' ? `Jumlah terkumpul ${year}` : lang === 'zh' ? `${year} 年累计工时` : `${year} cumulative hours`}
            tone="blue"
          />
          <MetricCard
            icon={<UsersIcon className="h-5 w-5" />}
            label={lang === 'ms' ? 'Kakitangan Sambilan Aktif' : lang === 'zh' ? '在职兼职员工' : 'Active Part-Time Staff'}
            value={employees.length}
            unit={lang === 'ms' ? 'org' : lang === 'zh' ? '人' : 'staff'}
            subtext={lang === 'ms' ? 'Pekerja sambilan berdaftar' : lang === 'zh' ? '在册兼职员工人数' : 'Registered part-time staff'}
            tone="teal"
          />
          <MetricCard
            icon={<CalendarIcon className="h-5 w-5" />}
            label={lang === 'ms' ? `Jam ${isCurrentYear ? 'Bulan Ini' : `Dis ${year}`}` : lang === 'zh' ? `${isCurrentYear ? '本月' : `${year}年12月`}工时合计` : `${isCurrentYear ? 'This Month' : `Dec ${year}`} Hours`}
            value={colTotal(isCurrentYear ? currentMonthNumber : 12).toFixed(1)}
            unit="h"
            subtext={isCurrentYear ? (lang === 'ms' ? `Jumlah bulan ke-${currentMonthNumber}` : lang === 'zh' ? `第 ${currentMonthNumber} 月兼职工时汇总` : `Month ${currentMonthNumber} part-time total`) : (lang === 'ms' ? 'Jumlah hujung tahun' : lang === 'zh' ? '年末月份汇总' : 'Year-end month total')}
            tone="amber"
          />
          <MetricCard
            icon={<ClockIcon className="h-5 w-5" />}
            label={lang === 'ms' ? 'Purata Jam Setahun' : lang === 'zh' ? '人均年度工时' : 'Avg Annual Hours/Staff'}
            value={employees.length > 0 ? (grandTotal() / employees.length).toFixed(1) : '0.0'}
            unit="h"
            subtext={lang === 'ms' ? 'Jumlah setahun ÷ bilangan pekerja' : lang === 'zh' ? '年度总工时 ÷ 员工人数' : 'Annual total ÷ staff count'}
            tone="slate"
          />
        </div>

        {employees.length === 0 ? (
          <div className="rounded-xl border border-line bg-surface p-12 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-paper text-ink-faint">
              <UsersIcon className="h-6 w-6" />
            </div>
            <h3 className="mt-3 text-base font-semibold text-ink">{lang === 'ms' ? 'Tiada pekerja sambilan' : lang === 'zh' ? '暂无兼职员工' : 'No part-time staff yet'}</h3>
            <p className="mt-1 text-sm text-ink-faint">{lang === 'ms' ? 'Sila tambah pekerja berjenis Sambilan (Part-time) di halaman Pekerja.' : lang === 'zh' ? '请先在员工管理中添加用工类型为兼职(Part-time)的员工。' : 'Add an employee with the Part-time type in Employees first.'}</p>
            <button
              onClick={() => router.push('/manage')}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-pine px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-pine-deep"
            >
              {lang === 'ms' ? 'Ke Pekerja untuk tambah →' : lang === 'zh' ? '前往员工管理添加兼职员工 →' : 'Go to Employees to add →'}
            </button>
          </div>
        ) : (
          <>
            {/* -- Toolbar: Year stepper + Search box ---------------- */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3 shadow-sm">
              <div className="flex items-center gap-2">
                {/* Year Stepper */}
                <div className="inline-flex items-center rounded-lg border border-line bg-paper/60 p-0.5">
                  <button
                    type="button"
                    onClick={() => setYear((y) => y - 1)}
                    className="rounded p-1 text-ink-soft transition hover:bg-surface hover:text-ink"
                    title={lang === 'ms' ? 'Tahun lepas' : lang === 'zh' ? '上一年' : 'Previous year'}
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                  </button>
                  <span className="px-3 text-sm font-bold text-ink tabular-nums">
                    {year}{lang === 'zh' ? ' 年' : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => setYear((y) => y + 1)}
                    className="rounded p-1 text-ink-soft transition hover:bg-surface hover:text-ink"
                    title={lang === 'ms' ? 'Tahun depan' : lang === 'zh' ? '下一年' : 'Next year'}
                  >
                    <ChevronRightIcon className="h-4 w-4" />
                  </button>
                </div>

                {!isCurrentYear && (
                  <button
                    type="button"
                    onClick={() => setYear(THIS_YEAR)}
                    className="rounded-lg border border-pine/30 bg-pine-soft px-2.5 py-1 text-xs font-semibold text-pine transition hover:bg-pine-soft/80"
                  >
                    {lang === 'ms' ? 'Kembali ke Tahun Ini' : lang === 'zh' ? '回到今年' : 'This Year'}
                  </button>
                )}

                <span className="hidden text-xs text-ink-faint sm:inline">
                  {lang === 'ms' ? 'Klik sel untuk memasukkan jam; simpan automatik apabila keluar' : lang === 'zh' ? '点击单元格输入工时，离开后自动保存' : 'Click a cell to enter hours; auto-saves on blur'}
                </span>
              </div>

              {/* Search & Quick counts */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={lang === 'ms' ? 'Cari nama pekerja sambilan...' : lang === 'zh' ? '搜索兼职员工姓名...' : 'Search part-time staff name...'}
                    className="w-52 rounded-lg border border-line bg-paper/50 py-1.5 pl-8 pr-3 text-xs text-ink placeholder:text-ink-faint/60 transition focus:border-pine focus:bg-surface focus:outline-none focus:ring-2 focus:ring-pine/10 sm:w-64"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-faint hover:text-ink"
                    >
                      ×
                    </button>
                  )}
                </div>

                <span className="hidden text-xs font-medium text-ink-faint lg:inline">
                  {lang === 'ms' ? `Memaparkan ${filteredEmployees.length} / ${employees.length}` : lang === 'zh' ? `显示 ${filteredEmployees.length} / ${employees.length} 人` : `Showing ${filteredEmployees.length} / ${employees.length}`}
                </span>
              </div>
            </div>

            {/* -- Desktop: Full spreadsheet grid --------------------- */}
            <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line bg-paper/60">
                      <th className="sticky left-0 z-20 bg-paper/95 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-ink-soft min-w-[200px]">
                        {lang === 'zh' ? '员工姓名 / Employee' : lang === 'ms' ? 'Pekerja / Employee' : 'Employee'}
                      </th>
                      {MONTHS.map((m, idx) => {
                        const monthNum = idx + 1
                        const isCurrentMonth = isCurrentYear && monthNum === currentMonthNumber
                        return (
                          <th
                            key={m}
                            className={`px-2 py-2.5 text-center text-xs font-semibold whitespace-nowrap transition-colors min-w-[68px] ${
                              isCurrentMonth
                                ? 'bg-pine-soft/40 text-pine border-b-2 border-pine'
                                : 'text-ink-soft'
                            }`}
                          >
                            <div className="inline-flex flex-col items-center">
                              <span>{m}</span>
                              {isCurrentMonth && (
                                <span className="mt-0.5 rounded-full bg-pine px-1.5 py-0.5 text-[9px] font-bold text-white leading-none">
                                  {lang === 'ms' ? 'Bulan Ini' : lang === 'zh' ? '本月' : 'Current'}
                                </span>
                              )}
                            </div>
                          </th>
                        )
                      })}
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-ink-soft min-w-[90px]">
                        {lang === 'ms' ? 'Jumlah Tahunan' : lang === 'zh' ? '年度合计' : 'Annual Total'}
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-line">
                    {filteredEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={14} className="py-12 text-center text-sm text-ink-faint">
                          {lang === 'ms' ? `Tiada pekerja sepadan dengan “${searchQuery}”` : lang === 'zh' ? `未找到与 “${searchQuery}” 相关的员工` : `No staff match “${searchQuery}”`}
                        </td>
                      </tr>
                    ) : (
                      filteredEmployees.map((emp, idx) => (
                        <tr
                          key={emp.id}
                          className={`transition-colors hover:bg-pine-soft/10 ${
                            idx % 2 === 0 ? 'bg-surface' : 'bg-paper/20'
                          }`}
                        >
                          <td
                            className={`sticky left-0 z-10 px-4 py-2.5 font-medium text-ink whitespace-nowrap transition-colors ${
                              idx % 2 === 0 ? 'bg-surface' : 'bg-[#FAFAFB]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pine-soft text-xs font-bold text-pine shadow-sm">
                                {getInitials(emp.full_name)}
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-ink leading-tight">
                                  {emp.full_name}
                                </div>
                                <div className="text-[11px] text-ink-faint">
                                  {lang === 'ms' ? 'Sambilan' : lang === 'zh' ? '兼职' : 'Part-time'}
                                </div>
                              </div>
                            </div>
                          </td>

                          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                            const k = key(emp.id, m)
                            const isSaving = saving.has(k)
                            const hasValue = !!hours[k]
                            const isCurrentMonth = isCurrentYear && m === currentMonthNumber

                            return (
                              <td
                                key={m}
                                className={`px-1 py-1.5 text-center transition-colors ${
                                  isCurrentMonth ? 'bg-pine-soft/15' : ''
                                }`}
                              >
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={hours[k] ?? ''}
                                  onChange={(e) => handleChange(emp.id, m, e.target.value)}
                                  onBlur={(e) => handleBlur(emp.id, m, e.target.value)}
                                  placeholder="—"
                                  className={[
                                    'w-14 rounded-md border text-center text-xs py-1.5 font-medium transition-all focus:outline-none tabular-nums',
                                    isSaving
                                      ? 'border-pine bg-pine-soft text-pine-deep ring-2 ring-pine/20 animate-pulse font-bold'
                                      : hasValue
                                        ? 'border-line/70 bg-surface text-ink hover:border-pine/50 focus:border-pine focus:ring-2 focus:ring-pine/20'
                                        : 'border-transparent bg-transparent text-ink-faint/60 placeholder-ink-faint/30 hover:border-line hover:bg-surface focus:border-pine focus:bg-surface focus:ring-2 focus:ring-pine/20',
                                  ].join(' ')}
                                />
                              </td>
                            )
                          })}

                          <td className="px-4 py-2.5 text-right font-bold text-ink tabular-nums">
                            {rowTotal(emp.id) > 0 ? (
                              <span className="inline-flex items-baseline gap-0.5 text-pine font-bold">
                                <span>{rowTotal(emp.id).toFixed(1)}</span>
                                <span className="text-[11px] text-ink-faint">h</span>
                              </span>
                            ) : (
                              <span className="text-ink-faint font-normal">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>

                  <tfoot>
                    <tr className="border-t-2 border-line bg-paper/80 font-semibold">
                      <td className="sticky left-0 z-10 bg-paper/95 px-4 py-3 text-xs font-bold uppercase tracking-wider text-ink-soft">
                        {lang === 'ms' ? 'Jumlah Jam Bulanan' : lang === 'zh' ? '月度工时合计' : 'Monthly Total'}
                      </td>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                        const t = colTotal(m)
                        const isCurrentMonth = isCurrentYear && m === currentMonthNumber
                        return (
                          <td
                            key={m}
                            className={`px-2 py-3 text-center text-xs font-bold tabular-nums ${
                              isCurrentMonth ? 'bg-pine-soft/30 text-pine' : 'text-ink'
                            }`}
                          >
                            {t > 0 ? `${t.toFixed(1)}h` : '—'}
                          </td>
                        )
                      })}
                      <td className="px-4 py-3 text-right text-sm font-extrabold text-pine tabular-nums bg-paper/95">
                        {grandTotal().toFixed(1)} h
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Helper tips */}
            <div className="flex items-center gap-2 rounded-lg border border-line/60 bg-paper/50 px-3.5 py-2 text-xs text-ink-faint">
              <span className="text-pine font-bold">{lang === 'zh' ? '💡 提示:' : lang === 'ms' ? '💡 Petua:' : '💡 Tip:'}</span>
              <span>
                {lang === 'ms' ? 'Klik sel untuk memasukkan jam bulanan. Simpan automatik apabila keluar; kosong dikira 0 jam; lajur bulan semasa diserlahkan.' : lang === 'zh' ? '点击单元格输入每月工时（小时），离开输入框时自动保存；留空按 0 计算；高亮列为本月。' : 'Click a cell to enter monthly hours. Auto-saves on blur; blank counts as 0 hours; the current month column is highlighted.'}
              </span>
            </div>
          </>
        )}
      </div>
    </ManagerShell>
  )
}

// --- Mobile helper sub-component ---------------------------------------------

function MobileWorkHours({
  employees,
  hours,
  saving,
  months,
  onChangeHours,
  onBlurHours,
  rowTotal,
  keyFn,
}: {
  employees: { id: string; full_name: string }[]
  hours: Record<string, string>
  saving: Set<string>
  months: string[]
  onChangeHours: (id: string, month: number, value: string) => void
  onBlurHours: (id: string, month: number, value: string) => Promise<void>
  rowTotal: (id: string) => number
  keyFn: (id: string, month: number) => string
}) {
  const [selectedId, setSelectedId] = useState(employees[0]?.id ?? '')
  const emp = employees.find((e) => e.id === selectedId)

  return (
    <div className="space-y-4">
      {/* Employee picker */}
      <div>
        <label className="field-label">Employee</label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="field-input w-full"
        >
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.full_name}</option>
          ))}
        </select>
      </div>

      {emp && (
        <>
          {/* Month grid � 2 columns */}
          <div className="grid grid-cols-2 gap-3">
            {months.map((m, i) => {
              const monthNum = i + 1
              const k = keyFn(emp.id, monthNum)
              const isSaving = saving.has(k)
              return (
                <div key={m} className="rounded-xl border border-line bg-surface p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">{m}</p>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={hours[k] ?? ''}
                    onChange={(e) => onChangeHours(emp.id, monthNum, e.target.value)}
                    onBlur={(e) => onBlurHours(emp.id, monthNum, e.target.value)}
                    placeholder="0"
                    className={[
                      'w-full rounded-lg border px-3 py-2.5 text-center text-base font-semibold focus:outline-none transition-all',
                      isSaving
                        ? 'border-pine bg-pine-soft text-pine-deep'
                        : hours[k]
                          ? 'border-line bg-white text-ink focus:border-pine'
                          : 'border-line bg-paper/40 text-ink-faint focus:border-pine focus:bg-white',
                    ].join(' ')}
                  />
                  <p className="mt-1 text-center text-[10px] text-ink-faint">hours</p>
                </div>
              )
            })}
          </div>

          {/* Row total */}
          <div className="flex items-center justify-between rounded-xl border border-line bg-paper px-4 py-3">
            <span className="text-sm font-medium text-ink-soft">Total for {emp.full_name.split(' ')[0]}</span>
            <span className="text-lg font-bold text-ink">{rowTotal(emp.id).toFixed(1)}h</span>
          </div>
        </>
      )}
    </div>
  )
}

// ??(< md)??????????;??(= md)????????
export default function WorkHoursPage() {
  return (
    <>
      <div className="md:hidden">
        <MobileWorkHoursPage />
      </div>
      <div className="hidden md:block">
        <DesktopWorkHours />
      </div>
    </>
  )
}
