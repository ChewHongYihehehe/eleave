'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import AuthStatus from '@/components/AuthStatus'
import { BottomSheet, Card, EI, Icon, ListSkeleton, SubPage, useToast } from '@/components/employee/EmployeeShell'
import { supabase } from '@/lib/supabaseClient'
import { useEmployee } from '@/lib/useEmployee'
import { useMgrT } from '@/lib/mgrText'
import { Avatar } from './ManagerTabs'

// 兼职工时 · 手机版(钉钉风格):
//  · 按月(预设):选月份 → 每个兼职员工一行,点一下弹出输入框,按"保存"才写入(不再靠"点别处自动存")
//  · 按年:一人一张卡片,12 个月一格一格,点哪个月就改哪个月
// 读写的表和电脑版一样:monthly_work_hours(employee_id, year, month, total_hours)。

const THIS_YEAR = new Date().getFullYear()
const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const GRADIENT = 'linear-gradient(135deg, #1677FF 0%, #4096FF 60%, #69B1FF 100%)'

type Emp = { id: string; full_name: string }
type Target = { empId: string; month: number }

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
const keyOf = (empId: string, month: number) => `${empId}|${month}`

// 输入面板:取消 | 标题 | 保存 放在最上面一行,键盘弹出来也不会挡住
function HoursSheet({
  title, subtitle, initial, busy, onSave, onClose,
}: { title: string; subtitle: string; initial: string; busy: boolean; onSave: (v: string) => void; onClose: () => void }) {
  const { t } = useMgrT()
  const [value, setValue] = useState(initial)
  return (
    <BottomSheet onClose={() => !busy && onClose()} pb="1.25rem">
        <div className="grid h-12 grid-cols-[4rem_1fr_4rem] items-center border-b border-gray-100 px-2">
          <button onClick={onClose} disabled={busy} className="text-[15px] text-gray-500">{t('cancel')}</button>
          <p className="truncate text-center text-base font-semibold text-gray-900">{title}</p>
          <button onClick={() => onSave(value)} disabled={busy} className="text-right text-[15px] font-semibold text-brand disabled:opacity-40">{t('save')}</button>
        </div>
        <div className="px-6 pb-2 pt-5 text-center">
          <p className="text-sm text-gray-500">{subtitle}</p>
          <div className="mt-3 flex items-end justify-center gap-2 border-b-2 border-brand pb-1">
            <input
              autoFocus
              type="number"
              inputMode="decimal"
              min="0"
              step="0.5"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0"
              className="w-40 bg-transparent text-center text-4xl font-semibold tabular-nums text-gray-900 placeholder:text-gray-300 focus:outline-none"
            />
            <span className="pb-1.5 text-sm text-gray-500">{t('hoursUnit')}</span>
          </div>
          <p className="mt-3 text-xs text-gray-500">{t('hoursHint')}</p>
        </div>
    </BottomSheet>
  )
}

export default function MobileWorkHours() {
  const auth = useEmployee({ requireManager: true })
  const { t, lang } = useMgrT()
  const { show, node: toastNode } = useToast()

  const [view, setView] = useState<'month' | 'year'>('month')
  const [year, setYear] = useState(THIS_YEAR)
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [employees, setEmployees] = useState<Emp[] | null>(null)
  const [hours, setHours] = useState<Record<string, number>>({})
  const [target, setTarget] = useState<Target | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (auth.status !== 'ready') return
    supabase
      .from('employees')
      .select('id, full_name')
      .eq('employment_type', 'part_time')
      .eq('is_active', true)
      .order('full_name', { ascending: true })
      .then(({ data }) => setEmployees((data || []) as Emp[]))
  }, [auth.status])

  const loadHours = useCallback(async () => {
    const { data } = await supabase.from('monthly_work_hours').select('employee_id, month, total_hours').eq('year', year)
    const map: Record<string, number> = {}
    for (const r of data || []) if (Number(r.total_hours) > 0) map[keyOf(r.employee_id, r.month)] = Number(r.total_hours)
    setHours(map)
  }, [year])

  useEffect(() => {
    if (auth.status === 'ready') loadHours()
  }, [auth.status, loadHours])

  if (auth.status !== 'ready') return <AuthStatus state={auth} />

  const monthLabel = (m: number) => (lang === 'zh' ? `${m}月` : MONTH_EN[m - 1])
  const emps = employees ?? []
  const rowTotal = (id: string) => { let s = 0; for (let m = 1; m <= 12; m++) s += hours[keyOf(id, m)] || 0; return s }
  const monthSum = emps.reduce((s, e) => s + (hours[keyOf(e.id, month)] || 0), 0)
  const monthEntered = emps.filter((e) => hours[keyOf(e.id, month)]).length
  const yearSum = emps.reduce((s, e) => s + rowTotal(e.id), 0)

  function shiftMonth(delta: number) {
    let m = month + delta
    let y = year
    if (m < 1) { m = 12; y -= 1 }
    if (m > 12) { m = 1; y += 1 }
    setMonth(m); setYear(y)
  }

  async function save(raw: string) {
    if (!target) return
    const trimmed = raw.trim()
    const num = trimmed === '' ? 0 : Number(trimmed)
    if (isNaN(num) || num < 0 || num > 744) { show(t('hoursInvalid')); return }
    setBusy(true)
    const { empId, month: m } = target
    // 0 或留空 = 删掉这一行,表保持干净(和电脑版一致)
    const { error } = num <= 0
      ? await supabase.from('monthly_work_hours').delete().eq('employee_id', empId).eq('year', year).eq('month', m)
      : await supabase.from('monthly_work_hours').upsert({ employee_id: empId, year, month: m, total_hours: num }, { onConflict: 'employee_id,year,month' })
    setBusy(false)
    if (error) { show(t('toastFail')); return }
    setHours((prev) => {
      const next = { ...prev }
      if (num <= 0) delete next[keyOf(empId, m)]
      else next[keyOf(empId, m)] = num
      return next
    })
    setTarget(null)
    show(t('hoursSaved'))
  }

  function handleExport() {
    const header = ['Employee', ...MONTH_EN, 'Total']
    const rows = emps.map((e) => [e.full_name, ...Array.from({ length: 12 }, (_, i) => hours[keyOf(e.id, i + 1)] ?? 0), rowTotal(e.id)])
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `work-hours-${year}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const targetEmp = target ? emps.find((e) => e.id === target.empId) : null

  return (
    <SubPage
      title={t('workHours')}
      backHref="/workspace"
      right={emps.length > 0 ? <button onClick={handleExport} className="text-[15px] text-brand">{t('exportCsv')}</button> : undefined}
    >
      {employees === null ? (
        <ListSkeleton />
      ) : emps.length === 0 ? (
        <Card className="mt-3">
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-gray-500">{t('noPartActive')}</p>
            <Link href="/manage" className="mt-3 inline-block text-sm text-brand">{t('goAddPart')} ›</Link>
          </div>
        </Card>
      ) : (
        <>
          <div className="px-4 pt-3">
            <div className="flex rounded-lg bg-gray-200/70 p-0.5">
              {([['month', t('tabMonth')], ['year', t('tabYear')]] as const).map(([k, label]) => (
                <button key={k} onClick={() => setView(k)} className={`flex-1 rounded-md py-1.5 text-sm ${view === k ? 'bg-white font-semibold text-gray-900 shadow-sm' : 'text-gray-500'}`}>{label}</button>
              ))}
            </div>
          </div>

          {/* 月份 / 年份步进器 */}
          <Card className="mt-3">
            <div className="flex h-12 items-center">
              <button onClick={() => (view === 'month' ? shiftMonth(-1) : setYear(year - 1))} className="flex h-12 w-12 items-center justify-center text-gray-500 active:bg-gray-50"><Icon d={EI.chevronL} size={20} /></button>
              <p className="flex-1 text-center text-base font-semibold text-gray-900">
                {view === 'month' ? (lang === 'zh' ? `${year}年${month}月` : `${MONTH_EN[month - 1]} ${year}`) : `${year}${lang === 'zh' ? '年' : ''}`}
              </p>
              <button onClick={() => (view === 'month' ? shiftMonth(1) : setYear(year + 1))} className="flex h-12 w-12 items-center justify-center text-gray-500 active:bg-gray-50"><Icon d={EI.chevronR} size={20} /></button>
            </div>
          </Card>

          {/* 摘要卡 */}
          <div className="mx-4 mt-3 overflow-hidden rounded-2xl text-white" style={{ background: GRADIENT }}>
            <div className="grid grid-cols-2">
              <div className="border-r border-white/20 px-5 py-4">
                <p className="text-xs text-blue-100">{view === 'month' ? t('monthTotal') : t('yearTotal')}</p>
                <p className="mt-1 text-3xl font-bold leading-none tabular-nums">{fmt(view === 'month' ? monthSum : yearSum)}<span className="ml-1 text-sm font-normal text-blue-100">h</span></p>
              </div>
              <div className="px-5 py-4">
                <p className="text-xs text-blue-100">{view === 'month' ? t('enteredCount') : t('ptStaff')}</p>
                <p className="mt-1 text-3xl font-bold leading-none tabular-nums">
                  {view === 'month' ? `${monthEntered}/${emps.length}` : emps.length}
                  <span className="ml-1 text-sm font-normal text-blue-100">{t('peopleUnit')}</span>
                </p>
              </div>
            </div>
          </div>

          {view === 'month' ? (
            <Card className="mt-3">
              {emps.map((e, i) => {
                const v = hours[keyOf(e.id, month)]
                return (
                  <button key={e.id} onClick={() => setTarget({ empId: e.id, month })} className={`flex w-full items-center gap-3 px-4 py-3 text-left active:bg-gray-50 ${i ? 'border-t border-gray-100' : ''}`}>
                    <Avatar name={e.full_name} size={40} />
                    <p className="min-w-0 flex-1 truncate text-[15px] font-medium text-gray-900">{e.full_name}</p>
                    {v ? (
                      <span className="text-[17px] font-semibold tabular-nums text-gray-900">{fmt(v)} <span className="text-xs font-normal text-gray-500">h</span></span>
                    ) : (
                      <span className="rounded-full bg-st-pending-soft px-2 py-0.5 text-xs font-medium text-st-pending-text">{t('notEntered')}</span>
                    )}
                    <Icon d={EI.chevronR} size={16} className="shrink-0 text-gray-300" />
                  </button>
                )
              })}
            </Card>
          ) : (
            emps.map((e) => (
              <Card key={e.id} className="mt-3">
                <div className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={e.full_name} size={40} />
                  <p className="min-w-0 flex-1 truncate text-[15px] font-medium text-gray-900">{e.full_name}</p>
                  <div className="text-right">
                    <p className="text-[17px] font-semibold leading-none tabular-nums text-gray-900">{fmt(rowTotal(e.id))} <span className="text-xs font-normal text-gray-500">h</span></p>
                    <p className="mt-1 text-[11px] text-gray-500">{t('yearTotal')}</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 border-t border-gray-100 p-3">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                    const v = hours[keyOf(e.id, m)]
                    return (
                      <button key={m} onClick={() => setTarget({ empId: e.id, month: m })} className={`rounded-lg py-2 text-center active:opacity-60 ${v ? 'bg-brand-soft' : 'bg-gray-50'}`}>
                        <p className="text-[11px] text-gray-500">{monthLabel(m)}</p>
                        <p className={`mt-0.5 text-[15px] font-semibold tabular-nums ${v ? 'text-brand' : 'text-gray-300'}`}>{v ? fmt(v) : '–'}</p>
                      </button>
                    )
                  })}
                </div>
              </Card>
            ))
          )}
        </>
      )}

      {target && targetEmp && (
        <HoursSheet
          key={keyOf(target.empId, target.month)}
          title={t('enterHours')}
          subtitle={`${targetEmp.full_name} · ${lang === 'zh' ? `${year}年${target.month}月` : `${MONTH_EN[target.month - 1]} ${year}`}`}
          initial={hours[keyOf(target.empId, target.month)] ? String(hours[keyOf(target.empId, target.month)]) : ''}
          busy={busy}
          onSave={save}
          onClose={() => setTarget(null)}
        />
      )}
      {toastNode}
    </SubPage>
  )
}
