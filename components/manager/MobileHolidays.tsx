'use client'

import { useEffect, useState } from 'react'
import AuthStatus from '@/components/AuthStatus'
import { BottomSheet, Card, ConfirmSheet, ListSkeleton, SubPage, useToast } from '@/components/employee/EmployeeShell'
import { supabase } from '@/lib/supabaseClient'
import { useEmployee } from '@/lib/useEmployee'
import { recalcAnnualLeave } from '@/lib/recalcLeave'
import { loadWorkWeek, saveWorkWeek } from '@/lib/settings'
import { DEFAULT_WORK_WEEK, type WorkWeek } from '@/lib/leaveRules'
import { toLocalDateStr } from '@/lib/dateUtils'
import { useMgrT } from '@/lib/mgrText'

// 公假 · 手机版(钉钉风格):
//  · 工作周:7 个按钮,点一下在 全天 → 半天 → 休息 之间切换,改了才出现"保存"
//  · 公假列表:按年份筛选、按月分组,每行右边一个开关(开 = 从年假里扣除)
//  · 点某一行 → 底部菜单 → 删除(再确认一次);底部固定按钮"新增公假"
// 读写的表和电脑版一样:public_holidays、app_settings(工作周)。

type Holiday = { id: string; holiday_date: string; name: string; is_enabled: boolean }

const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] // 周一排最前面,周日最后(getDay: 0 = 周日)
const NEXT_WEIGHT: Record<number, number> = { 1: 0.5, 0.5: 0, 0: 1 }

const fill = (s: string, n: number) => s.replace('{n}', String(n))
const parseDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m, d, dow: new Date(y, m - 1, d).getDay() }
}

function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? 'bg-brand' : 'bg-gray-300'}`}>
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

export default function MobileHolidays() {
  const auth = useEmployee({ requireManager: true })
  const { t, lang } = useMgrT()
  const { show, node: toastNode } = useToast()

  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loaded, setLoaded] = useState(false)
  const [year, setYear] = useState(new Date().getFullYear())
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const [workWeek, setWorkWeek] = useState<WorkWeek>(DEFAULT_WORK_WEEK)
  const [savedWeek, setSavedWeek] = useState<WorkWeek>(DEFAULT_WORK_WEEK)
  const [savingWeek, setSavingWeek] = useState(false)

  const [adding, setAdding] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)

  const [menuFor, setMenuFor] = useState<Holiday | null>(null)
  const [confirmDel, setConfirmDel] = useState<Holiday | null>(null)

  useEffect(() => {
    if (auth.status !== 'ready') return
    loadHolidays()
    loadWorkWeek().then((w) => { setWorkWeek(w); setSavedWeek(w) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status])

  async function loadHolidays() {
    const { data, error } = await supabase.from('public_holidays').select('id, holiday_date, name, is_enabled').order('holiday_date', { ascending: true })
    if (error) { setBanner({ kind: 'err', text: t('loadFail') }); return }
    setHolidays((data || []) as Holiday[])
    setLoaded(true)
  }

  // 公假有任何变动后,把覆盖该日期的年假申请(待批 + 已批)按新规则重算天数
  async function recalcForDate(date: string) {
    const { updated, error } = await recalcAnnualLeave({ kind: 'date', date })
    if (error) setBanner({ kind: 'err', text: `${t('recalcFailed')}${error}` })
    else if (updated > 0) setBanner({ kind: 'ok', text: fill(t('recalcDone'), updated) })
  }

  async function toggle(h: Holiday) {
    setBanner(null)
    // 先在画面上切换(开关立刻有反应),失败再换回来
    setHolidays((prev) => prev.map((x) => (x.id === h.id ? { ...x, is_enabled: !h.is_enabled } : x)))
    const { error } = await supabase.from('public_holidays').update({ is_enabled: !h.is_enabled }).eq('id', h.id)
    if (error) {
      setHolidays((prev) => prev.map((x) => (x.id === h.id ? { ...x, is_enabled: h.is_enabled } : x)))
      show(t('failUpdate'))
      return
    }
    await recalcForDate(h.holiday_date)
  }

  async function handleAdd() {
    if (!newDate || !newName.trim()) return
    setBanner(null)
    setBusy(true)
    const { error } = await supabase.from('public_holidays').insert({ holiday_date: newDate, name: newName.trim() })
    setBusy(false)
    if (error) { show(error.message.includes('duplicate') ? t('dupDate') : t('failAdd')); return }
    const added = newDate
    setAdding(false)
    setNewDate(''); setNewName('')
    setYear(parseDate(added).y) // 跳到刚加的那一年,让人看到它
    await recalcForDate(added)
    loadHolidays()
  }

  async function handleDelete(h: Holiday) {
    setBanner(null)
    setBusy(true)
    const { error } = await supabase.from('public_holidays').delete().eq('id', h.id)
    setBusy(false)
    setConfirmDel(null)
    if (error) { show(t('failRemove')); return }
    await recalcForDate(h.holiday_date)
    loadHolidays()
  }

  async function handleSaveWeek() {
    setBanner(null)
    setSavingWeek(true)
    const err = await saveWorkWeek(workWeek)
    if (err) { setSavingWeek(false); setBanner({ kind: 'err', text: err }); return }
    // 只重算"还没结束"的年假,已经休完的历史记录保持当时的算法
    const { updated, error } = await recalcAnnualLeave({ kind: 'from', fromDate: toLocalDateStr(new Date()) }, workWeek)
    setSavingWeek(false)
    setSavedWeek(workWeek)
    if (error) setBanner({ kind: 'err', text: `${t('recalcFailed')}${error}` })
    else if (updated > 0) setBanner({ kind: 'ok', text: `${t('weekSaved')} · ${fill(t('recalcDone'), updated)}` })
    else show(t('weekSaved'))
  }

  if (auth.status !== 'ready') return <AuthStatus state={auth} />

  const weekDirty = WEEK_ORDER.some((d) => workWeek[d] !== savedWeek[d])
  const dayNames = t('weekdays').split(',')
  const dayLabel = (d: number) => `${t('weekPrefix')}${dayNames[d]}`
  const weightLabel = (w: number) => (w === 1 ? t('dayFull') : w === 0.5 ? t('dayHalf') : t('dayOff'))
  const weightClass = (w: number) => (w === 1 ? 'bg-brand text-white' : w === 0.5 ? 'bg-brand-soft text-brand' : 'bg-gray-100 text-gray-500')

  const years = Array.from(new Set([new Date().getFullYear(), ...holidays.map((h) => parseDate(h.holiday_date).y)])).sort()
  const inYear = holidays.filter((h) => parseDate(h.holiday_date).y === year)
  const byMonth = new Map<number, Holiday[]>()
  for (const h of inYear) {
    const m = parseDate(h.holiday_date).m
    byMonth.set(m, [...(byMonth.get(m) || []), h])
  }
  const monthLabel = (m: number) => (lang === 'zh' ? `${m}月` : MONTH_EN[m - 1])

  return (
    <SubPage
      title={t('holidays')}
      backHref="/workspace"
      footer={
        <button onClick={() => setAdding(true)} className="w-full rounded-xl bg-brand py-3 text-base font-semibold text-white active:bg-brand-deep">{t('addHoliday')}</button>
      }
    >
      {banner && (
        <button onClick={() => setBanner(null)} className={`mx-4 mt-3 block w-[calc(100%-2rem)] rounded-lg p-3 text-left text-[13px] leading-snug ${banner.kind === 'ok' ? 'bg-brand-soft text-brand-deep' : 'bg-st-rejected-soft text-st-rejected-text'}`}>
          {banner.text}
        </button>
      )}

      {/* 工作周 */}
      <Card className="mt-3">
        <div className="px-4 pb-4 pt-4">
          <p className="text-[15px] font-semibold text-gray-900">{t('workWeek')}</p>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">{t('workWeekHint')}</p>
          <div className="mt-3 grid grid-cols-7 gap-1.5">
            {WEEK_ORDER.map((d) => (
              <button key={d} onClick={() => setWorkWeek((prev) => ({ ...prev, [d]: NEXT_WEIGHT[prev[d]] ?? 1 }))} className={`rounded-xl py-2.5 text-center active:opacity-70 ${weightClass(workWeek[d])}`}>
                <p className="text-[11px] opacity-80">{dayLabel(d)}</p>
                <p className="mt-0.5 text-base font-semibold">{weightLabel(workWeek[d])}</p>
              </button>
            ))}
          </div>
          {weekDirty && (
            <button onClick={handleSaveWeek} disabled={savingWeek} className="mt-3 w-full rounded-lg bg-brand py-2.5 text-[15px] font-semibold text-white disabled:opacity-50">
              {savingWeek ? t('loading') : t('saveWorkWeek')}
            </button>
          )}
        </div>
      </Card>

      {/* 年份筛选 */}
      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto px-4">
        {years.map((y) => (
          <button key={y} onClick={() => setYear(y)} className={`shrink-0 rounded-full px-4 py-1.5 text-sm ${y === year ? 'bg-brand text-white' : 'bg-white text-gray-500'}`}>
            {y}{t('yearSuffix')}
          </button>
        ))}
      </div>

      {/* 列表 */}
      {!loaded ? (
        <ListSkeleton rows={3} />
      ) : inYear.length === 0 ? (
        <Card className="mt-3"><p className="py-10 text-center text-sm text-gray-500">{t('noHolidays')}</p></Card>
      ) : (
        Array.from(byMonth.entries()).map(([m, list]) => (
          <div key={m}>
            <p className="px-5 pb-2 pt-4 text-sm font-medium text-gray-500">{monthLabel(m)}</p>
            <Card>
              {list.map((h, i) => {
                const p = parseDate(h.holiday_date)
                return (
                  <div key={h.id} className={`flex items-center gap-3 px-4 py-3 ${i ? 'border-t border-gray-100' : ''}`}>
                    <button onClick={() => setMenuFor(h)} className="flex min-w-0 flex-1 items-center gap-3 text-left active:opacity-60">
                      <span className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl ${h.is_enabled ? 'bg-brand-soft text-brand' : 'bg-gray-100 text-gray-500'}`}>
                        <span className="text-[10px] leading-none">{monthLabel(p.m)}</span>
                        <span className="mt-0.5 text-lg font-semibold leading-none tabular-nums">{p.d}</span>
                      </span>
                      <span className="min-w-0">
                        <span className={`block truncate text-[15px] font-medium ${h.is_enabled ? 'text-gray-900' : 'text-gray-500'}`}>{h.name}</span>
                        <span className="mt-0.5 block text-xs text-gray-500">{dayLabel(p.dow)} · {h.is_enabled ? t('holidayOn') : t('holidayOff')}</span>
                      </span>
                    </button>
                    <Switch on={h.is_enabled} onClick={() => toggle(h)} label={h.name} />
                  </div>
                )
              })}
            </Card>
          </div>
        ))
      )}
      <p className="mx-5 mt-3 text-xs leading-relaxed text-gray-500">{t('holidayNote')}</p>

      {/* 新增公假 */}
      {adding && (
        <BottomSheet onClose={() => !busy && setAdding(false)} pb="1.25rem">
            <div className="grid h-12 grid-cols-[4rem_1fr_4rem] items-center border-b border-gray-100 px-2">
              <button onClick={() => setAdding(false)} disabled={busy} className="text-[15px] text-gray-500">{t('cancel')}</button>
              <p className="truncate text-center text-base font-semibold text-gray-900">{t('addHoliday')}</p>
              <button onClick={handleAdd} disabled={busy || !newDate || !newName.trim()} className="text-right text-[15px] font-semibold text-brand disabled:opacity-40">{t('save')}</button>
            </div>
            <div className="space-y-3 px-4 pt-4">
              <div>
                <label className="mb-1 block text-xs text-gray-500">{t('holidayDate')}</label>
                <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-full rounded-lg bg-gray-50 p-3 text-[15px] text-gray-800 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">{t('holidayName')}</label>
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('holidayNamePh')} maxLength={60} className="w-full rounded-lg bg-gray-50 p-3 text-[15px] text-gray-800 placeholder:text-gray-400 focus:outline-none" />
              </div>
            </div>
        </BottomSheet>
      )}

      {/* 点某一行:底部菜单 */}
      {menuFor && (
        <BottomSheet onClose={() => setMenuFor(null)}>
          <div className="px-4 pt-3">
            <p className="text-center text-base font-semibold text-gray-900">{menuFor.name}</p>
            <p className="mt-1 text-center text-xs text-gray-500">{menuFor.holiday_date}</p>
            <button onClick={() => { setConfirmDel(menuFor); setMenuFor(null) }} className="mt-4 w-full rounded-xl bg-st-rejected-soft py-3 text-base font-semibold text-st-rejected-text">{t('deleteHoliday')}</button>
            <button onClick={() => setMenuFor(null)} className="mt-2 w-full rounded-xl bg-gray-100 py-3 text-base text-gray-700">{t('close')}</button>
          </div>
        </BottomSheet>
      )}

      <ConfirmSheet
        open={!!confirmDel}
        title={t('deleteHoliday')}
        message={confirmDel ? `${confirmDel.name} · ${confirmDel.holiday_date} — ${t('confirmDeleteHoliday')}` : undefined}
        confirmLabel={t('delete')}
        danger
        busy={busy}
        onConfirm={() => confirmDel && handleDelete(confirmDel)}
        onClose={() => setConfirmDel(null)}
      />
      {toastNode}
    </SubPage>
  )
}
