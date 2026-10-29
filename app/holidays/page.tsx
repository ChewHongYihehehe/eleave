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
import { useTr } from '@/lib/tr'

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
  const { tr, locale } = useTr()
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
    if (loadError) { setError(tr('无法加载公假列表。', 'Could not load holidays.', 'Tidak dapat memuatkan senarai cuti umum.')); return }
    if (data) setHolidays(data)
  }

  // 公假有任何变动后,把覆盖该日期的年假申请(待批 + 已批)按新规则重算天数
  async function recalcForDate(holidayDate: string) {
    const { updated, error: recalcError } = await recalcAnnualLeave({ kind: 'date', date: holidayDate })
    if (recalcError) {
      setError(tr(`公假已保存，但重算请假天数失败: ${recalcError}`, `Holiday saved, but recalculating leave days failed: ${recalcError}`, `Cuti umum disimpan, tetapi pengiraan semula hari cuti gagal: ${recalcError}`))
    } else if (updated > 0) {
      setNotice(tr(`已按最新公假列表重算 ${updated} 笔年假申请。`, `${updated} annual leave application${updated > 1 ? 's were' : ' was'} recalculated to match the updated holiday list.`, `${updated} permohonan cuti tahunan telah dikira semula mengikut senarai cuti umum terkini.`))
    }
  }

  async function toggleEnabled(id: string, current: boolean) {
    setError(''); setNotice('')
    const target = holidays.find((h) => h.id === id)
    const { error: updError } = await supabase
      .from('public_holidays')
      .update({ is_enabled: !current })
      .eq('id', id)
    if (updError) { setError(tr('更新公假失败。', 'Failed to update holiday.', 'Gagal mengemas kini cuti umum.')); return }
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
      setError(insertError.message.includes('duplicate')
        ? tr('该日期已存在法定公假。', 'A public holiday already exists on this date.', 'Cuti umum pada tarikh ini sudah wujud.')
        : tr('添加法定公假失败。', 'Failed to add public holiday.', 'Gagal menambah cuti umum.'))
      return
    }

    await recalcForDate(date)
    setDate('')
    setName('')
    setShowAddModal(false)
    setNotice(tr(`公假 "${name}" (${date}) 已成功加入。`, `Public holiday "${name}" (${date}) added successfully.`, `Cuti umum "${name}" (${date}) berjaya ditambah.`))
    loadHolidays()
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm(tr('确定要删除此法定公假日吗？删除后将自动重算覆盖该日期的年假扣减天数。', 'Delete this public holiday? Annual leave days covering this date will be recalculated automatically.', 'Padam cuti umum ini? Hari cuti tahunan yang merangkumi tarikh ini akan dikira semula secara automatik.'))
    if (!confirmed) return
    setError(''); setNotice('')
    const target = holidays.find((h) => h.id === id)
    const { error: delError } = await supabase.from('public_holidays').delete().eq('id', id)
    if (delError) { setError(tr('删除公假失败。', 'Failed to remove holiday.', 'Gagal memadam cuti umum.')); return }
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
      setError(tr(`保存工作周失败: ${saveError}`, `Failed to save work week: ${saveError}`, `Gagal menyimpan minggu bekerja: ${saveError}`))
      return
    }
    // 只重算"还没结束"的年假,已经休完的历史记录保持当时的算法
    const { updated, error: recalcError } = await recalcAnnualLeave(
      { kind: 'from', fromDate: toLocalDateStr(new Date()) },
      workWeek
    )
    setSavingWeek(false)
    if (recalcError) setError(tr(`工作周排期已保存，但重算年假扣减失败: ${recalcError}`, `Work week saved, but recalculating annual leave failed: ${recalcError}`, `Minggu bekerja disimpan, tetapi pengiraan semula cuti tahunan gagal: ${recalcError}`))
    else setNotice(
      updated > 0
        ? tr(`工作周考勤制度已更新。已自动重算 ${updated} 笔未生效的年假申请。`, `Work week updated. ${updated} upcoming annual leave application(s) were recalculated.`, `Minggu bekerja dikemas kini. ${updated} permohonan cuti tahunan akan datang telah dikira semula.`)
        : tr('工作周考勤制度已成功保存。', 'Work week saved successfully.', 'Minggu bekerja berjaya disimpan.')
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
              <h1 className="text-xl font-bold tracking-tight text-ink">{tr('法定节假日与工作周排期', 'Public Holidays & Work Week', 'Cuti Umum & Minggu Bekerja')}</h1>
              <span className="rounded-full bg-pine-soft px-2.5 py-0.5 text-xs font-semibold text-pine">
                {tr(`${currentYear} 年度`, `Year ${currentYear}`, `Tahun ${currentYear}`)}
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-faint">
              {tr('设定企业常规工作日考勤制度及国家法定公假，系统自动排期并在审批时准确剔除假期扣减', 'Set the regular work week and public holidays. Holidays are automatically excluded when leave is approved.', 'Tetapkan minggu bekerja biasa dan cuti umum. Cuti umum akan dikecualikan secara automatik semasa kelulusan cuti.')}
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
              <PlusIcon className="h-4 w-4" /> {tr('添加公假日', 'Add Holiday', 'Tambah Cuti Umum')}
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
            <p className="text-xs font-medium text-ink-faint">{tr(`${currentYear} 年度法定公假`, `${currentYear} Public Holidays`, `Cuti Umum ${currentYear}`)}</p>
            <p className="mt-1 font-mono text-2xl font-bold text-ink">{thisYearHolidays.length} <span className="text-xs font-normal text-ink-faint font-sans">{tr('天', 'days', 'hari')}</span></p>
            <p className="mt-0.5 text-[11px] text-ink-faint">{tr('全年在册法定公假日', 'Public holidays on record this year', 'Cuti umum direkodkan tahun ini')}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-4 shadow-2xs">
            <p className="text-xs font-medium text-ink-faint">{tr('已生效扣减排除', 'Active (excluded from deduction)', 'Aktif (dikecualikan daripada tolakan)')}</p>
            <p className="mt-1 font-mono text-2xl font-bold text-emerald-600">{enabledCount} <span className="text-xs font-normal text-emerald-700 font-sans">{tr('天', 'days', 'hari')}</span></p>
            <p className="mt-0.5 text-[11px] text-emerald-700">{tr('请年假时自动不计扣减', 'Not deducted from annual leave', 'Tidak ditolak daripada cuti tahunan')}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-4 shadow-2xs">
            <p className="text-xs font-medium text-ink-faint">{tr('每周标准工作天数', 'Standard working days per week', 'Hari bekerja standard seminggu')}</p>
            <p className="mt-1 font-mono text-2xl font-bold text-pine">{totalWeeklyDays.toFixed(1).replace(/\.0$/, '')} <span className="text-xs font-normal text-pine font-sans">{tr('天/周', 'days/wk', 'hari/mgg')}</span></p>
            <p className="mt-0.5 text-[11px] text-pine-deep">{tr('用于年假折算标准工作日', 'Used to convert annual leave into working days', 'Digunakan untuk mengira cuti tahunan dalam hari bekerja')}</p>
          </div>
        </div>

        {/* ── 工作周排期卡片 ── */}
        <div className="rounded-xl border border-line bg-surface p-5 shadow-2xs space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-ink">{tr('每周工作日考勤制度 (Work Week Schedule)', 'Work Week Schedule', 'Jadual Minggu Bekerja')}</h2>
                <span className="rounded bg-paper px-2 py-0.5 text-[10px] font-mono font-medium text-ink-soft">
                  {tr(`标准 ${totalWeeklyDays}d/周`, `Standard ${totalWeeklyDays}d/wk`, `Standard ${totalWeeklyDays}h/mgg`)}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-ink-faint">
                {tr('年假仅按考勤工作日扣减。请设定每周一至周日为全天（1.0）、半天（0.5）或公休（0）。', 'Annual leave is deducted on working days only. Set each day from Monday to Sunday as full day (1.0), half day (0.5) or off (0).', 'Cuti tahunan hanya ditolak pada hari bekerja. Tetapkan setiap hari Isnin hingga Ahad sebagai hari penuh (1.0), separuh hari (0.5) atau cuti (0).')}
              </p>
            </div>
            <button
              onClick={handleSaveWorkWeek}
              disabled={savingWeek}
              className="inline-flex items-center justify-center rounded-lg bg-pine px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-pine-deep disabled:opacity-50"
            >
              {savingWeek ? tr('保存中...', 'Saving...', 'Menyimpan...') : tr('保存考勤排期', 'Save Schedule', 'Simpan Jadual')}
            </button>
          </div>

          {/* 7 天排期网格 */}
          <div className="grid grid-cols-7 gap-2">
            {WEEKDAYS.map(({ day }) => {
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
                  <p className="text-xs font-bold text-ink mb-2">{new Date(2024, 0, 7 + day).toLocaleDateString(locale, { weekday: 'short' })}</p>
                  <select
                    value={workWeek[day]}
                    onChange={(e) => setDayWeight(day, Number(e.target.value))}
                    className="w-full rounded-md border border-line bg-surface py-1 text-center font-mono text-xs font-semibold text-ink focus:border-pine focus:outline-none"
                  >
                    <option value={1}>{tr('全天 1.0d', 'Full 1.0d', 'Penuh 1.0h')}</option>
                    <option value={0.5}>{tr('半天 0.5d', 'Half 0.5d', 'Separuh 0.5h')}</option>
                    <option value={0}>{tr('休息 0d', 'Off 0d', 'Cuti 0h')}</option>
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
                {tr(`${currentYear} 年度公假`, `${currentYear} Holidays`, `Cuti Umum ${currentYear}`)} ({thisYearHolidays.length})
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
                  {tr('其他年度', 'Other Years', 'Tahun Lain')} ({otherHolidays.length})
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
                {tr('全部', 'All', 'Semua')} ({holidays.length})
              </button>
            </div>

            {/* 搜索 */}
            <div className="relative">
              <input
                type="text"
                placeholder={tr('搜索公假日名称或日期...', 'Search holiday name or date...', 'Cari nama atau tarikh cuti umum...')}
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
                  <th className="py-3 pl-6 pr-4">{tr('公假日历', 'Date', 'Tarikh')}</th>
                  <th className="py-3 px-4">{tr('节假日名称', 'Holiday Name', 'Nama Cuti')}</th>
                  <th className="py-3 px-4 text-center">{tr('考勤生效状态', 'Status', 'Status')}</th>
                  <th className="py-3 pl-4 pr-6 text-right">{tr('管理操作', 'Actions', 'Tindakan')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {displayList.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-xs text-ink-faint">
                      {tr('暂无法定公假记录。点击右上角 "+ 添加公假日" 进行新增。', 'No public holidays yet. Click "+ Add Holiday" at the top right to add one.', 'Tiada rekod cuti umum. Klik "+ Tambah Cuti Umum" di bahagian atas kanan untuk menambah.')}
                    </td>
                  </tr>
                ) : (
                  displayList.map((h) => {
                    const d = new Date(h.holiday_date + 'T00:00:00')
                    const monthStr = d.toLocaleDateString(locale, { month: 'short' })
                    const dayNum = d.getDate()
                    const weekday = d.toLocaleDateString(locale, { weekday: 'short' })

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
                            {h.is_enabled ? tr('已启用 (扣减排除)', 'Enabled (excluded)', 'Aktif (dikecualikan)') : tr('已停用', 'Disabled', 'Dinyahaktifkan')}
                          </button>
                        </td>

                        {/* 4. 删除 */}
                        <td className="py-3.5 pl-4 pr-6 text-right">
                          <button
                            type="button"
                            onClick={() => handleDelete(h.id)}
                            title={tr('删除节假日', 'Delete holiday', 'Padam cuti umum')}
                            className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-rust hover:bg-rust-soft transition"
                          >
                            <TrashIcon />
                            {tr('删除', 'Delete', 'Padam')}
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
            <span>{tr(`显示 ${displayList.length} 个节假日安排`, `Showing ${displayList.length} holiday(s)`, `Memaparkan ${displayList.length} cuti umum`)}</span>
            <span>💡 {tr('提示：公假生效后，审批通过的年假若跨过该日将自动重算扣减天数', 'Tip: once a holiday is active, approved annual leave spanning that date is recalculated automatically.', 'Petua: apabila cuti umum aktif, cuti tahunan yang diluluskan merentasi tarikh itu akan dikira semula secara automatik.')}</span>
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
                <h2 className="text-base font-bold text-ink">{tr('添加法定公假日', 'Add Public Holiday', 'Tambah Cuti Umum')}</h2>
                <p className="mt-0.5 text-xs text-ink-faint">{tr('新增国家公假并在年假排期中予以排除', 'Add a public holiday and exclude it from annual leave deductions', 'Tambah cuti umum dan kecualikannya daripada tolakan cuti tahunan')}</p>
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
                <label className="field-label">{tr('公假日日期', 'Date', 'Tarikh')} *</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="field-input font-mono"
                />
              </div>

              <div>
                <label className="field-label">{tr('节假日名称', 'Holiday name', 'Nama cuti umum')} *</label>
                <input
                  type="text"
                  required
                  placeholder={tr('例如：Hari Raya Aidilfitri / 国庆日', 'e.g. Hari Raya Aidilfitri / National Day', 'cth: Hari Raya Aidilfitri / Hari Kebangsaan')}
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
                  {tr('取消', 'Cancel', 'Batal')}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-pine px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-pine-deep disabled:opacity-50 transition"
                >
                  {submitting ? tr('添加中...', 'Adding...', 'Menambah...') : tr('确认添加', 'Confirm', 'Sahkan')}
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
