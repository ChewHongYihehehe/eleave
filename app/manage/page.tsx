'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import ManagerShell from '@/components/ManagerShell'
import { useEmployee } from '@/lib/useEmployee'
import AuthStatus from '@/components/AuthStatus'

type Employee = {
  id: string
  employee_no: number | null
  full_name: string
  date_of_commencement: string
  employment_type: string
  role: string
  annual_leave_carry_forward: number
  annual_leave_entitlement_override: number | null
  is_active: boolean
}

type Tab = 'full_time' | 'part_time'

export default function ManageEmployeesPage() {
  const auth = useEmployee({ requireManager: true })
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('full_time')
  const [showAddForm, setShowAddForm] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const managerId = auth.status === 'ready' ? auth.employee.id : null

  const [staffId, setStaffId] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [dateOfCommencement, setDateOfCommencement] = useState('')
  const [employmentType, setEmploymentType] = useState('full_time')
  const [role, setRole] = useState('staff')
  const [submitting, setSubmitting] = useState(false)

  const isPartTime = employmentType === 'part_time'

  useEffect(() => {
    if (auth.status === 'ready') loadEmployees()
  }, [auth.status])

  async function loadEmployees() {
    setLoading(true)
    const { data, error: loadError } = await supabase
      .from('employees')
      .select('id, employee_no, full_name, date_of_commencement, employment_type, role, annual_leave_carry_forward, annual_leave_entitlement_override, is_active, is_owner')
      .order('employment_type', { ascending: false })
      .order('employee_no', { ascending: true })
    if (loadError) setError('Could not load employees.')
    // 老板账号不列在这里(只能在 Supabase 后台管理)
    if (data) setEmployees(data.filter((e) => !e.is_owner))
    setLoading(false)
  }

  async function handleAddEmployee(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    setSubmitting(true)

    const { data: { session } } = await supabase.auth.getSession()

    const res = await fetch('/api/employees', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        staffId: isPartTime ? staffId || undefined : staffId,
        password: isPartTime ? undefined : password,
        full_name: fullName,
        date_of_commencement: dateOfCommencement,
        employment_type: employmentType,
        role,
      }),
    })

    const result = await res.json()
    setSubmitting(false)

    if (!res.ok) { setError(result.error || 'Failed to add employee.'); return }

    if (isPartTime) {
      setMessage(`Part-time employee "${fullName}" added. Their work hours can be recorded from the Work Hours page.`)
    } else {
      setMessage(`Added! Staff ID: ${staffId} — share their password separately.`)
    }

    setStaffId(''); setPassword(''); setFullName('')
    setDateOfCommencement(''); setEmploymentType('full_time'); setRole('staff')
    setShowAddForm(false)
    loadEmployees()
  }

  async function handleUpdateField(id: string, field: string, value: string | number) {
    setError('')
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/employees', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ id, field, value }),
    })
    const result = await res.json().catch(() => ({}))
    if (!res.ok) setError(result.error || `Failed to update: ${field}`)
    loadEmployees()
  }

  // 启用 / 停用要同时处理登录账号(封禁 / 解除封禁),必须走服务器 API。
  async function handleToggleActive(id: string, current: boolean) {
    setError(''); setMessage('')
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/employees', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ id, is_active: !current }),
    })
    const result = await res.json().catch(() => ({}))
    if (!res.ok) setError(result.error || 'Failed to update status.')
    loadEmployees()
  }

  // 重置员工密码:负责人输入新密码,走服务器 API 覆盖旧密码。
  async function handleResetPassword(id: string, name: string) {
    setError(''); setMessage('')
    const newPassword = window.prompt(`Enter a new password for ${name} (at least 6 characters):`)
    if (newPassword === null) return // 按了取消
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return }

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/employees', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ id, password: newPassword }),
    })
    const result = await res.json().catch(() => ({}))
    if (!res.ok) { setError(result.error || 'Failed to reset password.'); return }
    setMessage(`Password for ${name} has been reset. Share the new password with them separately.`)
  }

  if (auth.status !== 'ready') return <AuthStatus state={auth} />
  if (loading) return <div className="p-6 text-center text-ink-soft">Loading...</div>

  const fullTimeEmployees = employees.filter((e) => e.employment_type === 'full_time')
  const partTimeEmployees = employees.filter((e) => e.employment_type === 'part_time')

  return (
    <ManagerShell>
      <div className="space-y-6 pb-10"><h1 className="font-display text-2xl font-semibold text-ink">Manage Employees</h1>

        <button onClick={() => setShowAddForm(!showAddForm)} className="btn-primary">
          {showAddForm ? 'Cancel' : '+ Add New Employee'}
        </button>

        {showAddForm && (
          <form onSubmit={handleAddEmployee} className="panel space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">Employment Type</label>
                <select
                  value={employmentType}
                  onChange={(e) => {
                    setEmploymentType(e.target.value)
                    setRole('staff')
                    setStaffId('')
                    setPassword('')
                  }}
                  className="field-input"
                >
                  <option value="full_time">Full-time</option>
                  <option value="part_time">Part-time</option>
                </select>
              </div>
              <div>
                <label className="field-label">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="field-input"
                  disabled={isPartTime}
                >
                  <option value="staff">Staff</option>
                  {!isPartTime && <option value="manager">Manager</option>}
                </select>
              </div>
            </div>

            {!isPartTime && (
              <>
                <div>
                  <label className="field-label">Staff ID (number)</label>
                  <input type="text" required inputMode="numeric" pattern="[0-9]{1,9}" title="Digits only" value={staffId} onChange={(e) => setStaffId(e.target.value)} placeholder="e.g. 003" className="field-input" />
                </div>
                <div>
                  <label className="field-label">Initial Password</label>
                  <input type="text" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" className="field-input" />
                </div>
              </>
            )}

            {isPartTime && (
              <div className="rounded-md border border-line bg-paper px-4 py-3 text-sm text-ink-soft">
                <p className="font-medium text-ink">ℹ️ Part-time — no login account</p>
                <p className="mt-0.5">
                  Part-time employees don&apos;t have system access. Their work hours are recorded
                  by the manager from the <strong>Work Hours</strong> page.
                </p>
              </div>
            )}

            {isPartTime && (
              <div>
                <label className="field-label">Staff ID (optional, digits only)</label>
                <input type="text" inputMode="numeric" pattern="[0-9]{1,9}" title="Digits only" value={staffId} onChange={(e) => setStaffId(e.target.value)} placeholder="e.g. 101 (optional)" className="field-input" />
              </div>
            )}

            <div>
              <label className="field-label">Full Name</label>
              <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="field-input" />
            </div>
            <div>
              <label className="field-label">Date of Commencement</label>
              <input type="date" required value={dateOfCommencement} onChange={(e) => setDateOfCommencement(e.target.value)} className="field-input" />
            </div>

            {error && <p className="text-sm text-rust">{error}</p>}

            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Adding...' : isPartTime ? 'Add Part-time Employee' : 'Add Employee'}
            </button>
          </form>
        )}

        {message && <p className="rounded-md bg-pine-soft p-3 text-sm text-pine-deep">{message}</p>}
        {!showAddForm && error && <p className="rounded-md bg-rust-soft p-3 text-sm text-rust">{error}</p>}

        {/* ── Tabs ── */}
        <div className="border-b border-line">
          <div className="flex gap-0">
            <TabButton label="Full-time" count={fullTimeEmployees.length} active={activeTab === 'full_time'} onClick={() => setActiveTab('full_time')} />
            <TabButton label="Part-time" count={partTimeEmployees.length} active={activeTab === 'part_time'} onClick={() => setActiveTab('part_time')} />
          </div>
        </div>

        {/* ── Full-time tab ── */}
        {activeTab === 'full_time' && (
          fullTimeEmployees.length === 0
            ? <p className="text-sm text-ink-faint">No full-time employees.</p>
            : <FullTimeTable employees={fullTimeEmployees} managerId={managerId} onToggleActive={handleToggleActive} onUpdateField={handleUpdateField} onResetPassword={handleResetPassword} />
        )}

        {/* ── Part-time tab ── */}
        {activeTab === 'part_time' && (
          <div className="space-y-3">
            <p className="text-xs text-ink-faint">
              Part-time employees have no system login. Their hours are tracked on the Work Hours page.
            </p>
            {partTimeEmployees.length === 0
              ? <p className="text-sm text-ink-faint">No part-time employees.</p>
              : <PartTimeTable employees={partTimeEmployees} onToggleActive={handleToggleActive} onUpdateField={handleUpdateField} />
            }
          </div>
        )}
      </div>
    </ManagerShell>
  )
}

// ─── Tab button ───────────────────────────────────────────────────────────────

function TabButton({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={[
        'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
        active ? 'border-pine text-pine' : 'border-transparent text-ink-soft hover:text-ink hover:border-line',
      ].join(' ')}
    >
      {label}
      <span className={['rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums', active ? 'bg-pine-soft text-pine-deep' : 'bg-paper text-ink-faint'].join(' ')}>
        {count}
      </span>
    </button>
  )
}

// ─── Full-time table ──────────────────────────────────────────────────────────

function FullTimeTable({ employees, managerId, onToggleActive, onUpdateField, onResetPassword }: {
  employees: Employee[]
  managerId: string | null
  onToggleActive: (id: string, current: boolean) => void
  onUpdateField: (id: string, field: string, value: string | number) => void
  onResetPassword: (id: string, name: string) => void
}) {
  const th = 'px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-ink-faint whitespace-nowrap'
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-paper">
            <th className={`sticky left-0 z-10 bg-paper text-left ${th}`}>Employee</th>
            <th className={`text-left ${th}`}>Commencement</th>
            <th className={`text-left ${th}`}>Entitled (Override)</th>
            <th className={`text-left ${th}`}>Leave Carry-Fwd</th>
            <th className={`text-left ${th}`}>Role</th>
            <th className={`text-center ${th}`}>Status</th>
            <th className={`text-center ${th}`}>Password</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp, idx) => {
            const bg = idx % 2 === 0 ? 'bg-surface' : 'bg-paper/40'
            return (
              <tr key={emp.id} className={`border-b border-line last:border-b-0 ${bg} ${!emp.is_active ? 'opacity-50' : ''}`}>
                <td className={`sticky left-0 z-10 px-3 py-2.5 whitespace-nowrap ${bg}`}>
                  <span className="mr-1.5 text-xs text-ink-faint">{emp.employee_no ? `#${emp.employee_no}` : '—'}</span>
                  <span className="font-medium text-ink">{emp.full_name}</span>
                </td>
                <td className="px-3 py-2">
                  <input type="date" defaultValue={emp.date_of_commencement} onBlur={(e) => onUpdateField(emp.id, 'date_of_commencement', e.target.value)} className="field-input py-1 text-xs" />
                </td>
                <td className="px-3 py-2">
                  <input type="number" step="0.5" defaultValue={emp.annual_leave_entitlement_override ?? ''} placeholder="auto" onBlur={(e) => {
                    const v = e.target.value.trim()
                    onUpdateField(emp.id, 'annual_leave_entitlement_override', v === '' ? (null as unknown as number) : Number(v))
                  }} className="field-input w-20 py-1 text-xs" />
                </td>
                <td className="px-3 py-2">
                  <input type="number" step="0.5" defaultValue={emp.annual_leave_carry_forward} onBlur={(e) => onUpdateField(emp.id, 'annual_leave_carry_forward', Number(e.target.value))} className="field-input w-20 py-1 text-xs" />
                </td>
                <td className="px-3 py-2">
                  <select value={emp.role} onChange={(e) => onUpdateField(emp.id, 'role', e.target.value)} className="field-input py-1 text-xs">
                    <option value="staff">Staff</option>
                    <option value="manager">Manager</option>
                  </select>
                </td>
                <td className="px-3 py-2 text-center">
                  <button onClick={() => onToggleActive(emp.id, emp.is_active)} className={`badge ${emp.is_active ? 'bg-paper text-ink-soft' : 'badge-rejected'}`}>
                    {emp.is_active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-3 py-2 text-center">
                  <button onClick={() => onResetPassword(emp.id, emp.full_name)} className="rounded-md bg-paper px-2.5 py-1 text-xs font-medium text-ink-soft ring-1 ring-line hover:bg-pine-soft/40">
                    Reset
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Part-time table ──────────────────────────────────────────────────────────

function PartTimeTable({ employees, onToggleActive, onUpdateField }: {
  employees: Employee[]
  onToggleActive: (id: string, current: boolean) => void
  onUpdateField: (id: string, field: string, value: string | number) => void
}) {
  const th = 'px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-ink-faint whitespace-nowrap'
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-paper">
            <th className={`sticky left-0 z-10 bg-paper text-left ${th}`}>Employee</th>
            <th className={`text-left ${th}`}>Commencement</th>
            <th className={`text-center ${th}`}>Status</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp, idx) => {
            const bg = idx % 2 === 0 ? 'bg-surface' : 'bg-paper/40'
            return (
              <tr key={emp.id} className={`border-b border-line last:border-b-0 ${bg} ${!emp.is_active ? 'opacity-50' : ''}`}>
                <td className={`sticky left-0 z-10 px-3 py-2.5 whitespace-nowrap ${bg}`}>
                  <span className="mr-1.5 text-xs text-ink-faint">{emp.employee_no ? `#${emp.employee_no}` : '—'}</span>
                  <span className="font-medium text-ink">{emp.full_name}</span>
                </td>
                <td className="px-3 py-2">
                  <input type="date" defaultValue={emp.date_of_commencement} onBlur={(e) => onUpdateField(emp.id, 'date_of_commencement', e.target.value)} className="field-input py-1 text-xs" />
                </td>
                <td className="px-3 py-2 text-center">
                  <button onClick={() => onToggleActive(emp.id, emp.is_active)} className={`badge ${emp.is_active ? 'bg-paper text-ink-soft' : 'badge-rejected'}`}>
                    {emp.is_active ? 'Active' : 'Inactive'}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
