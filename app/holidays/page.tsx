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

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <rect x="3" y="4" width="18" height="18" rx="3" strokeWidth={1.75} />
      <path d="M16 2v4M8 2v4M3 10h18" strokeWidth={1.75} strokeLinecap="round" />
    </svg>
  )
}

function DesktopHolidays() {
  const auth = useEmployee({ requireManager: true })
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [date, setDate] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [holidayTab, setHolidayTab] = useState<'thisYear' | 'other' | 'all'>('thisYear')
  const [searchQuery, setSearchQuery] = useState('')

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
      setError(insertError.message.includes('duplicate') ? '该日期已存在法定公假。' : '添加法定公假失败。')
      return
    }

    await recalcForDate(date)
    setDate('')
    setName('')
    setShowAddModal(false)
    setNotice(`公假 "${name}" (${date}) 已成功加入。`)
    loadHolidays()
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm('确定要删除此法定公假日吗？删除后将自动重算覆盖该日期的年假扣减天数。')
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
      setError(`保存工作周失败: ${saveError}`)
      return
    }
    // 只重算"还没结束"的年假,已经休完的历史记录保持当时的算法
    const { updated, error: recalcError } = await recalcAnnualLeave(
      { kind: 'from', fromDate: toLocalDateStr(new Date()) },
      workWeek
    )
    setSavingWeek(false)
    if (recalcError) setError(`工作周排期已保存，但重算年假扣减失败: ${recalcError}`)
    else setNotice(
      updated > 0
        ? `工作周考勤制度已更新。已自动重算 ${updated} 笔未生效的年假申请。`
        : '工作周考勤制度已成功保存。'
    )
  }

  if (auth.status !== 'ready') return <AuthStatus state={auth} />

  const currentYear = new Date().getFullYear()
  const thisYearHolidays = holidays.filter((h) => h.holiday_date.startsWith(String(currentYear)))
  const otherHolidays = holidays.filter((h) => !h.holiday_date.startsWith(String(currentYear)))

  const totalWeeklyDays = Object.values(workWeek).reduce((sum, val) => sum + val, 0)
  const enabledCount = thisYearHolidays.filter((h) => h.is_enabled).length

  // Filter list
  const activeList =
    holidayTab === 'thisYear'
      ? thisYearHolidays
      : holidayTab === 'other'
      ? otherHolidays
      : holidays

  const displayList = activeList.filter((h) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      return h.name.toLowerCase().includes(q) || h.holiday_date.includes(q)
    }
    return true
  })

  return (
    <ManagerShell>
      <div className="space-y-6 pb-16">

        {/* ── 顶部操作栏 ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-ink">法定节假日与工作周排期</h1>
              <span className="rounded-full bg-pine-soft px-2.5 py-0.5 text-xs font-semibold text-pine">
                {currentYear} 年度
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-faint">
              设定企业常规工作日考勤制度及国家法定公假，系统自动排期并在审批时准确剔除假期扣减
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setError('')
                setShowAddModal(true)
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-pine px-4 py-2 text-sm font-medium text-white shadow-xs transition hover:bg-pine-deep focus:outline-none focus:ring-2 focus:ring-pine/20"
            >
              <PlusIcon className="h-4 w-4" /> 添加公假日
            </button>
          </div>
        </div>

        {/* ── 通知条 ── */}
        {notice && (
          <div className="flex items-center justify-between rounded-xl border border-st-approved/30 bg-st-approved-soft px-4 py-3 text-xs font-medium text-st-approved-text shadow-2xs">
            <span>✓ {notice}</span>
            <button onClick={() => setNotice('')} className="text-xs font-bold hover:opacity-70">✕</button>
          </div>
        )}
        {error && (
          <div className="flex items-center justify-between rounded-xl border border-rust/30 bg-rust-soft px-4 py-3 text-xs font-medium text-rust shadow-2xs">
            <span>⚠ {error}</span>
            <button onClick={() => setError('')} className="text-xs font-bold hover:opacity-70">✕</button>
          </div>
        )}

        {/* ── 概览指标卡片 ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-line bg-surface p-4 shadow-2xs">
            <p className="text-xs font-medium text-ink-faint">{currentYear} 年度法定公假</p>
            <p className="mt-1 font-mono text-2xl font-bold text-ink">{thisYearHolidays.length} <span className="text-xs font-normal text-ink-faint font-sans">天</span></p>
            <p className="mt-0.5 text-[11px] text-ink-faint">全年在册法定公假日</p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-4 shadow-2xs">
            <p className="text-xs font-medium text-ink-faint">已生效扣减排除</p>
            <p className="mt-1 font-mono text-2xl font-bold text-emerald-600">{enabledCount} <span className="text-xs font-normal text-emerald-700 font-sans">天</span></p>
            <p className="mt-0.5 text-[11px] text-emerald-700">请年假时自动不计扣减</p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-4 shadow-2xs">
            <p className="text-xs font-medium text-ink-faint">每周标准工作天数</p>
            <p className="mt-1 font-mono text-2xl font-bold text-pine">{totalWeeklyDays.toFixed(1).replace(/\.0$/, '')} <span className="text-xs font-normal text-pine font-sans">天/周</span></p>
            <p className="mt-0.5 text-[11px] text-pine-deep">用于年假折算标准工作日</p>
          </div>
        </div>

        {/* ── 工作周排期卡片 ── */}
        <div className="rounded-xl border border-line bg-surface p-5 shadow-2xs space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-ink">每周工作日考勤制度 (Work Week Schedule)</h2>
                <span className="rounded bg-paper px-2 py-0.5 text-[10px] font-mono font-medium text-ink-soft">
                  标准 {totalWeeklyDays}d/周
                </span>
              </div>
              <p className="mt-0.5 text-xs text-ink-faint">
                年假仅按考勤工作日扣减。请设定每周一至周日为全天（1.0）、半天（0.5）或公休（0）。
              </p>
            </div>
            <button
              onClick={handleSaveWorkWeek}
              disabled={savingWeek}
              className="inline-flex items-center justify-center rounded-lg bg-pine px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-pine-deep disabled:opacity-50"
            >
              {savingWeek ? '保存中...' : '保存考勤排期'}
            </button>
          </div>

          {/* 7 天排期网格 */}
          <div className="grid grid-cols-7 gap-2">
            {WEEKDAYS.map(({ day, label }) => {
              const weight = workWeek[day]
              const isFull = weight === 1
              const isHalf = weight === 0.5
              const isOff = weight === 0

              return (
                <div
                  key={day}
                  className={`rounded-xl border p-2.5 text-center transition ${
                    isFull
                      ? 'border-pine/30 bg-pine-soft/30'
                      : isHalf
                      ? 'border-amber-300 bg-amber-50'
                      : 'border-line bg-paper/60'
                  }`}
                >
                  <p className="text-xs font-bold text-ink mb-2">{label}</p>
                  <select
                    value={workWeek[day]}
                    onChange={(e) => setDayWeight(day, Number(e.target.value))}
                    className="w-full rounded-md border border-line bg-surface py-1 text-center font-mono text-xs font-semibold text-ink focus:border-pine focus:outline-none"
                  >
                    <option value={1}>全天 1.0d</option>
                    <option value={0.5}>半天 0.5d</option>
                    <option value={0}>休息 0d</option>
                  </select>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── 法定节假日列表 ── */}
        <div className="rounded-xl border border-line bg-surface shadow-2xs overflow-hidden">
          {/* 控制条 */}
          <div className="flex flex-col gap-4 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between bg-paper/30">
            {/* 年份 Tab */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setHolidayTab('thisYear')}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                  holidayTab === 'thisYear'
                    ? 'bg-surface text-pine shadow-2xs border border-line'
                    : 'text-ink-soft hover:text-ink'
                }`}
              >
                {currentYear} 年度公假 ({thisYearHolidays.length})
              </button>
              {otherHolidays.length > 0 && (
                <button
                  onClick={() => setHolidayTab('other')}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                    holidayTab === 'other'
                      ? 'bg-surface text-pine shadow-2xs border border-line'
                      : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  其他年度 ({otherHolidays.length})
                </button>
              )}
              <button
                onClick={() => setHolidayTab('all')}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                  holidayTab === 'all'
                    ? 'bg-surface text-pine shadow-2xs border border-line'
                    : 'text-ink-soft hover:text-ink'
                }`}
              >
                全部 ({holidays.length})
              </button>
            </div>

            {/* 搜索 */}
            <div className="relative">
              <input
                type="text"
                placeholder="搜索公假日名称或日期..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-48 sm:w-60 rounded-lg border border-line bg-surface pl-8 pr-6 text-xs text-ink placeholder:text-ink-faint focus:border-pine focus:outline-none focus:ring-1 focus:ring-pine/20"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint text-xs">🔍</span>
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-ink-faint hover:text-ink">✕</button>
              )}
            </div>
          </div>

          {/* 表格 */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-paper/60 text-xs font-medium text-ink-soft">
                  <th className="py-3 pl-6 pr-4">公假日历</th>
                  <th className="py-3 px-4">节假日名称</th>
                  <th className="py-3 px-4 text-center">考勤生效状态</th>
                  <th className="py-3 pl-4 pr-6 text-right">管理操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {displayList.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-xs text-ink-faint">
                      暂无法定公假记录。点击右上角 "+ 添加公假日" 进行新增。
                    </td>
                  </tr>
                ) : (
                  displayList.map((h) => {
                    const d = new Date(h.holiday_date + 'T00:00:00')
                    const monthStr = d.toLocaleDateString('zh-CN', { month: 'short' })
                    const dayNum = d.getDate()
                    const weekday = d.toLocaleDateString('zh-CN', { weekday: 'short' })

                    return (
                      <tr key={h.id} className={`transition hover:bg-paper/40 ${!h.is_enabled ? 'opacity-60' : ''}`}>
                        {/* 1. 日期小块 */}
                        <td className="py-3.5 pl-6 pr-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl border border-line bg-paper shadow-2xs">
                              <span className="text-[10px] font-bold text-ink-faint uppercase leading-none">
                                {monthStr}
                              </span>
                              <span className="font-mono text-sm font-bold text-ink leading-tight">
                                {dayNum}
                              </span>
                            </div>
                            <div>
                              <p className="font-mono text-xs font-semibold text-ink">{h.holiday_date}</p>
                              <p className="text-[11px] text-ink-faint font-medium">{weekday}</p>
                            </div>
                          </div>
                        </td>

                        {/* 2. 名称 */}
                        <td className="py-3.5 px-4 font-semibold text-ink text-xs">
                          {h.name}
                        </td>

                        {/* 3. 状态开关 */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={h.is_enabled}
                            onClick={() => toggleEnabled(h.id, h.is_enabled)}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                              h.is_enabled
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'bg-line text-ink-soft hover:bg-line/80'
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${h.is_enabled ? 'bg-emerald-500' : 'bg-ink-faint'}`} />
                            {h.is_enabled ? '已启用 (扣减排除)' : '已停用'}
                          </button>
                        </td>

                        {/* 4. 删除 */}
                        <td className="py-3.5 pl-4 pr-6 text-right">
                          <button
                            type="button"
                            onClick={() => handleDelete(h.id)}
                            title="删除节假日"
                            className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-rust hover:bg-rust-soft transition"
                          >
                            <TrashIcon />
                            删除
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-line px-5 py-3 bg-surface text-xs text-ink-faint">
            <span>显示 {displayList.length} 个节假日安排</span>
            <span>💡 提示：公假生效后，审批通过的年假若跨过该日将自动重算扣减天数</span>
          </div>
        </div>

      </div>

      {/* ════════════════════════════════════════════
          MODAL: 添加公假日模态框
          ════════════════════════════════════════════ */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-xs"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between border-b border-line pb-4">
              <div>
                <h2 className="text-base font-bold text-ink">添加法定公假日</h2>
                <p className="mt-0.5 text-xs text-ink-faint">新增国家公假并在年假排期中予以排除</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1.5 text-ink-faint hover:bg-paper hover:text-ink transition"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-4 text-xs">
              <div>
                <label className="field-label">公假日日期 *</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="field-input font-mono"
                />
              </div>

              <div>
                <label className="field-label">节假日名称 *</label>
                <input
                  type="text"
                  required
                  placeholder="例如：Hari Raya Aidilfitri / 国庆日"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="field-input"
                />
              </div>

              {error && <p className="text-xs text-rust">{error}</p>}

              <div className="mt-6 flex justify-end gap-2.5 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-line bg-surface px-4 py-2 text-xs font-medium text-ink-soft hover:bg-paper transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-pine px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-pine-deep disabled:opacity-50 transition"
                >
                  {submitting ? '添加中...' : '确认添加'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
