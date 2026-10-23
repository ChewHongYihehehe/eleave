'use client'

import MobileWorkHoursPage from '@/components/manager/MobileWorkHours'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import ManagerShell from '@/components/ManagerShell'
import { useEmployee } from '@/lib/useEmployee'
import AuthStatus from '@/components/AuthStatus'

type Employee = { id: string; full_name: string }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const THIS_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => THIS_YEAR - 2 + i) // 2 years back → 2 years ahead

function DesktopWorkHours() {
  const router = useRouter()
  const auth = useEmployee({ requireManager: true })
  const [employees, setEmployees] = useState<Employee[]>([])
  const [year, setYear] = useState(THIS_YEAR)

  // hours[`${employeeId}|${month}`] → string value of that cell (controlled input)
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
      // Zero or empty → delete the row to keep the table clean
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

  // ── Totals ──────────────────────────────────────────────────────────────

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

  // ── Export CSV ───────────────────────────────────────────────────────────

  function handleExportCsv() {
    const header = ['Employee', ...MONTHS, 'Total']
    const rows = employees.map((emp) => [
      emp.full_name,
      ...Array.from({ length: 12 }, (_, i) => hours[key(emp.id, i + 1)] || '0'),
      String(rowTotal(emp.id)),
    ])
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `work-hours-${year}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ─────────────────────────────────────────────────────────────────────────

  if (auth.status !== 'ready') return <AuthStatus state={auth} />

  return (
    <ManagerShell>
      <div className="space-y-6 pb-10"><h1 className="font-display text-2xl font-semibold text-ink">Work Hours</h1>

      {employees.length === 0 ? (
        <div className="panel text-center space-y-2">
          <p className="text-sm text-ink-faint">No active part-time employees found.</p>
          <button
            onClick={() => router.push('/manage')}
            className="text-sm text-pine underline-offset-2 hover:underline"
          >
            Add part-time employees from the Employees page →
          </button>
        </div>
      ) : (
        <>
          {/* ── Controls ────────────────────────────────────────── */}
          <div className="flex items-center gap-3">
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="field-input max-w-[110px]"
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            <button
              onClick={handleExportCsv}
              className="btn-ghost ml-auto"
            >
              Export CSV
            </button>
          </div>

          {/* ── Desktop: Full spreadsheet grid ───────────────────── */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-paper">
                  <th className="sticky left-0 z-10 bg-paper px-3 py-2.5 text-left text-[13px] font-medium text-ink-faint">
                    Employee
                  </th>
                  {MONTHS.map((m) => (
                    <th key={m} className="px-2 py-2.5 text-center text-[13px] font-medium text-ink-faint whitespace-nowrap">
                      {m}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-right text-[13px] font-medium text-ink-faint">
                    Total
                  </th>
                </tr>
              </thead>

              <tbody>
                {employees.map((emp, idx) => (
                  <tr
                    key={emp.id}
                    className={`border-b border-line transition-colors ${idx % 2 === 0 ? 'bg-surface' : 'bg-paper/40'}`}
                  >
                    <td className={`sticky left-0 z-10 px-3 py-2 font-medium text-ink whitespace-nowrap ${idx % 2 === 0 ? 'bg-surface' : 'bg-paper/40'}`}>
                      {emp.full_name}
                    </td>

                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                      const k = key(emp.id, m)
                      const isSaving = saving.has(k)
                      const hasValue = !!hours[k]
                      return (
                        <td key={m} className="px-1 py-1.5 text-center">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={hours[k] ?? ''}
                            onChange={(e) => handleChange(emp.id, m, e.target.value)}
                            onBlur={(e) => handleBlur(emp.id, m, e.target.value)}
                            placeholder="—"
                            className={[
                              'w-14 rounded border text-center text-sm py-1 focus:outline-none transition-all',
                              isSaving
                                ? 'border-pine bg-pine-soft text-pine-deep'
                                : hasValue
                                  ? 'border-line bg-surface text-ink focus:border-pine'
                                  : 'border-transparent bg-transparent text-ink-faint placeholder-ink-faint/50 hover:border-line focus:border-pine focus:bg-surface',
                            ].join(' ')}
                          />
                        </td>
                      )
                    })}

                    <td className="px-3 py-2 text-right font-semibold text-ink tabular-nums">
                      {rowTotal(emp.id) > 0 ? `${rowTotal(emp.id).toFixed(1)}h` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr className="border-t-2 border-line bg-paper">
                  <td className="sticky left-0 z-10 bg-paper px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                    Total
                  </td>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                    const t = colTotal(m)
                    return (
                      <td key={m} className="px-2 py-2 text-center text-xs font-semibold text-ink tabular-nums">
                        {t > 0 ? t.toFixed(1) : ''}
                      </td>
                    )
                  })}
                  <td className="px-3 py-2 text-right font-bold text-ink tabular-nums">
                    {grandTotal().toFixed(1)}h
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ── Mobile: Employee picker + month cards ─────────────── */}
          <div className="md:hidden space-y-4">
            {/* Employee selector */}
            {(() => {
              const [mobileEmpId, setMobileEmpId] = [
                employees[0]?.id ?? '',
                (v: string) => { /* handled by select below */ void v }
              ] as const
              return null
            })()}
            <MobileWorkHours
              employees={employees}
              hours={hours}
              saving={saving}
              months={MONTHS}
              onChangeHours={handleChange}
              onBlurHours={handleBlur}
              rowTotal={rowTotal}
              keyFn={key}
            />
          </div>

          <p className="text-xs text-ink-faint">
            Click any cell to enter hours for that month. Saves automatically when you click away.
          </p>
        </>
      )}
    </div>
  </ManagerShell>
  )
}

// ─── Mobile helper sub-component ─────────────────────────────────────────────

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
          {/* Month grid — 2 columns */}
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

// 手机(< md)用钉钉风格的新版页面;电脑(≥ md)保持原来的版面。
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
