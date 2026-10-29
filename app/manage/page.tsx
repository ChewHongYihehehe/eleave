'use client'
import React from 'react'

import MobileEmployees from '@/components/manager/MobileEmployees'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import ManagerShell from '@/components/ManagerShell'
import { useEmployee } from '@/lib/useEmployee'
import AuthStatus from '@/components/AuthStatus'
import { getYearsOfService } from '@/lib/leaveRules'
import { useTr } from '@/lib/tr'

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
type StatusFilter = 'all' | 'active' | 'inactive'

function getInitials(name: string) {
  if (!name) return 'U'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ── Icons ────────────────────────────────────────────────────────────────────
function SearchIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`h-3.5 w-3.5 shrink-0 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  )
}

function PlusIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`h-4 w-4 shrink-0 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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

function KeyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
    </svg>
  )
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
  )
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// 电脑版: 钉钉企业花名册风格 (Desktop Employees Roster)
// ═════════════════════════════════════════════════════════════════════════════
function DesktopEmployees(): React.ReactElement | null {
  const auth = useEmployee({ requireManager: true })
  const { tr } = useTr()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('full_time')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [resettingEmployee, setResettingEmployee] = useState<{ id: string; name: string } | null>(null)

  // Add Form state
  const [staffId, setStaffId] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [dateOfCommencement, setDateOfCommencement] = useState('')
  const [employmentType, setEmploymentType] = useState('full_time')
  const [role, setRole] = useState('staff')
  const [submitting, setSubmitting] = useState(false)

  // Edit Form state
  const [editCommencement, setEditCommencement] = useState('')
  const [editRole, setEditRole] = useState('staff')
  const [editOverride, setEditOverride] = useState('')
  const [editCarry, setEditCarry] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Reset Password state
  const [newPassword, setNewPassword] = useState('')
  const [resetting, setResetting] = useState(false)

  const isPartTime = employmentType === 'part_time'

  useEffect(() => {
    if (auth.status === 'ready') loadEmployees()
  }, [auth.status])

  async function loadEmployees() {
    setLoading(true)
    const { data, error: loadError } = await supabase
      .from('employees')
      .select('id, employee_no, full_name, date_of_commencement, employment_type, role, annual_leave_carry_forward, annual_leave_entitlement_override, is_active')
      .order('employment_type', { ascending: false })
      .order('employee_no', { ascending: true })
    if (loadError) setError('Could not load employees.')
    if (data) setEmployees(data)
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
      setMessage(tr(`兼职员工 "${fullName}" 已创建。`, `Part-time staff "${fullName}" created.`, `Pekerja sambilan "${fullName}" telah dicipta.`))
    } else {
      setMessage(tr(`员工 "${fullName}" 创建成功！工号: ${staffId}，请将初始密码通知员工。`, `Employee "${fullName}" created! Staff ID: ${staffId}. Please share the initial password with them.`, `Pekerja "${fullName}" berjaya dicipta! ID pekerja: ${staffId}. Sila maklumkan kata laluan awal kepada pekerja.`))
    }

    setStaffId(''); setPassword(''); setFullName('')
    setDateOfCommencement(''); setEmploymentType('full_time'); setRole('staff')
    setShowAddModal(false)
    loadEmployees()
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingEmployee) return
    setSavingEdit(true)
    setError('')

    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    const isFull = editingEmployee.employment_type === 'full_time'

    const tasks: Promise<Response>[] = []

    if (editCommencement !== editingEmployee.date_of_commencement) {
      tasks.push(
        fetch('/api/employees', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ id: editingEmployee.id, field: 'date_of_commencement', value: editCommencement }),
        })
      )
    }

    if (isFull) {
      if (editRole !== editingEmployee.role) {
        tasks.push(
          fetch('/api/employees', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ id: editingEmployee.id, field: 'role', value: editRole }),
          })
        )
      }

      const ov = editOverride.trim() === '' ? null : Number(editOverride)
      if (ov !== editingEmployee.annual_leave_entitlement_override) {
        tasks.push(
          fetch('/api/employees', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ id: editingEmployee.id, field: 'annual_leave_entitlement_override', value: ov }),
          })
        )
      }

      const carry = Number(editCarry) || 0
      if (carry !== editingEmployee.annual_leave_carry_forward) {
        tasks.push(
          fetch('/api/employees', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ id: editingEmployee.id, field: 'annual_leave_carry_forward', value: carry }),
          })
        )
      }
    }

    await Promise.all(tasks)
    setSavingEdit(false)
    setEditingEmployee(null)
    setMessage(tr(`员工 ${editingEmployee.full_name} 资料已成功更新。`, `Profile of ${editingEmployee.full_name} was updated.`, `Profil ${editingEmployee.full_name} berjaya dikemas kini.`))
    loadEmployees()
  }

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
    if (!res.ok) setError(result.error || tr('更新在职状态失败。', 'Failed to update active status.', 'Gagal mengemas kini status aktif.'))
    loadEmployees()
  }

  async function handleConfirmResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!resettingEmployee) return
    if (newPassword.length < 6) {
      setError(tr('密码长度至少需要 6 个字符。', 'Password must be at least 6 characters.', 'Kata laluan mesti sekurang-kurangnya 6 aksara.'))
      return
    }

    setResetting(true)
    setError('')
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/employees', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ id: resettingEmployee.id, password: newPassword }),
    })
    const result = await res.json().catch(() => ({}))
    setResetting(false)

    if (!res.ok) {
      setError(result.error || tr('重置密码失败。', 'Failed to reset password.', 'Gagal menetapkan semula kata laluan.'))
      return
    }

    setMessage(tr(`已重置员工 ${resettingEmployee.name} 的登录密码，请单独将新密码告知该员工。`, `Password for ${resettingEmployee.name} has been reset. Please share the new password with them separately.`, `Kata laluan ${resettingEmployee.name} telah ditetapkan semula. Sila maklumkan kata laluan baharu secara berasingan.`))
    setResettingEmployee(null)
    setNewPassword('')
  }

  function openEditModal(emp: Employee) {
    setEditingEmployee(emp)
    setEditCommencement(emp.date_of_commencement || '')
    setEditRole(emp.role || 'staff')
    setEditOverride(emp.annual_leave_entitlement_override == null ? '' : String(emp.annual_leave_entitlement_override))
    setEditCarry(String(emp.annual_leave_carry_forward ?? 0))
  }

  if (auth.status !== 'ready') return <AuthStatus state={auth} />
  if (loading) return <div className="p-12 text-center text-xs text-ink-faint">Loading employee roster...</div>

  // Statistics
  const totalEmployees = employees.length
  const activeCount = employees.filter((e) => e.is_active).length
  const fullTimeEmployees = employees.filter((e) => e.employment_type === 'full_time')
  const partTimeEmployees = employees.filter((e) => e.employment_type === 'part_time')

  // Search & Filter
  const currentTabList = activeTab === 'full_time' ? fullTimeEmployees : partTimeEmployees
  const filteredList = currentTabList.filter((emp) => {
    if (statusFilter === 'active' && !emp.is_active) return false
    if (statusFilter === 'inactive' && emp.is_active) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      const matchName = emp.full_name.toLowerCase().includes(q)
      const matchNo = emp.employee_no ? String(emp.employee_no).includes(q) : false
      return matchName || matchNo
    }
    return true
  })

  return (
    <ManagerShell>
      <div className="space-y-6 pb-16">

        {/* ── 顶部操作栏与概览 ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-ink">{tr('员工花名册', 'Employee Directory', 'Direktori Pekerja')}</h1>
              <span className="rounded-full bg-pine-soft px-2.5 py-0.5 text-xs font-semibold text-pine">
                {tr(`${totalEmployees} 人`, `${totalEmployees} staff`, `${totalEmployees} orang`)}
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-faint">
              {tr('管理全公司正式员工与兼职人员档案、假额特批与系统访问权限', 'Manage full-time and part-time staff records, leave entitlement overrides and system access', 'Urus rekod pekerja sepenuh masa dan sambilan, pelepasan kelayakan cuti dan akses sistem')}
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
              <PlusIcon className="h-4 w-4" /> {tr('新增员工', 'Add Employee', 'Tambah Pekerja')}
            </button>
          </div>
        </div>

        {/* ── 提示消息通知 ── */}
        {message && (
          <div className="flex items-center justify-between rounded-xl border border-st-approved/30 bg-st-approved-soft px-4 py-3 text-xs font-medium text-st-approved-text">
            <span>✓ {message}</span>
            <button onClick={() => setMessage('')} className="text-xs font-bold hover:opacity-70">✕</button>
          </div>
        )}
        {error && (
          <div className="flex items-center justify-between rounded-xl border border-rust/30 bg-rust-soft px-4 py-3 text-xs font-medium text-rust">
            <span>⚠ {error}</span>
            <button onClick={() => setError('')} className="text-xs font-bold hover:opacity-70">✕</button>
          </div>
        )}

        {/* ── 钉钉概览卡片 (4 栏指标) ── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-line bg-surface p-4 shadow-2xs">
            <p className="text-xs font-medium text-ink-faint">{tr('在册员工总数', 'Total Staff', 'Jumlah Pekerja')}</p>
            <p className="mt-1 font-mono text-2xl font-bold text-ink">{totalEmployees}</p>
            <p className="mt-0.5 text-[11px] text-ink-faint">{tr('涵盖所有用工类型', 'All employment types', 'Semua jenis pekerjaan')}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-4 shadow-2xs">
            <p className="text-xs font-medium text-ink-faint">{tr('在职生效账号', 'Active Accounts', 'Akaun Aktif')}</p>
            <p className="mt-1 font-mono text-2xl font-bold text-emerald-600">{activeCount}</p>
            <p className="mt-0.5 text-[11px] text-emerald-700">{tr('正常登录与考勤', 'Can log in and apply leave', 'Boleh log masuk dan memohon cuti')}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-4 shadow-2xs">
            <p className="text-xs font-medium text-ink-faint">{tr('全职正式员工', 'Full-time Staff', 'Pekerja Sepenuh Masa')}</p>
            <p className="mt-1 font-mono text-2xl font-bold text-pine">{fullTimeEmployees.length}</p>
            <p className="mt-0.5 text-[11px] text-pine-deep">{tr('拥有独立年假额度', 'Own annual leave entitlement', 'Kelayakan cuti tahunan sendiri')}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-4 shadow-2xs">
            <p className="text-xs font-medium text-ink-faint">{tr('兼职人员', 'Part-time Staff', 'Pekerja Sambilan')}</p>
            <p className="mt-1 font-mono text-2xl font-bold text-amber-600">{partTimeEmployees.length}</p>
            <p className="mt-0.5 text-[11px] text-amber-700">{tr('按工时模块记录', 'Tracked by work hours', 'Direkod melalui jam kerja')}</p>
          </div>
        </div>

        {/* ── 列表筛选与搜索控制栏 ── */}
        <div className="rounded-xl border border-line bg-surface shadow-2xs overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between bg-paper/30">
            {/* Tabs */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setActiveTab('full_time'); setStatusFilter('all') }}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                  activeTab === 'full_time'
                    ? 'bg-surface text-pine shadow-2xs border border-line'
                    : 'text-ink-soft hover:text-ink'
                }`}
              >
                {tr('全职正式员工', 'Full-time Staff', 'Pekerja Sepenuh Masa')}
                <span className="rounded-full bg-paper px-1.5 py-0.5 text-[10px] font-mono text-ink-faint">
                  {fullTimeEmployees.length}
                </span>
              </button>

              <button
                onClick={() => { setActiveTab('part_time'); setStatusFilter('all') }}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                  activeTab === 'part_time'
                    ? 'bg-surface text-pine shadow-2xs border border-line'
                    : 'text-ink-soft hover:text-ink'
                }`}
              >
                {tr('兼职人员', 'Part-time Staff', 'Pekerja Sambilan')}
                <span className="rounded-full bg-paper px-1.5 py-0.5 text-[10px] font-mono text-ink-faint">
                  {partTimeEmployees.length}
                </span>
              </button>
            </div>

            {/* 搜索与在职状态过滤 */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-faint" />
                <input
                  type="text"
                  placeholder={tr('搜索姓名或工号...', 'Search name or staff ID...', 'Cari nama atau ID pekerja...')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 w-48 sm:w-60 rounded-lg border border-line bg-surface pl-8 pr-3 text-xs text-ink placeholder:text-ink-faint focus:border-pine focus:outline-none focus:ring-1 focus:ring-pine/20"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink">
                    <XIcon className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Status filter pills */}
              <div className="inline-flex rounded-lg border border-line bg-surface p-0.5">
                {(['all', 'active', 'inactive'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                      statusFilter === st ? 'bg-pine-soft text-pine font-semibold' : 'text-ink-soft hover:text-ink'
                    }`}
                  >
                    {st === 'all' ? tr('全部', 'All', 'Semua') : st === 'active' ? tr('在职', 'Active', 'Aktif') : tr('已停用', 'Inactive', 'Tidak aktif')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── 表格区域 ── */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-paper/60 text-xs font-medium text-ink-soft">
                  <th className="py-3 pl-6 pr-4">{tr('员工信息', 'Employee', 'Pekerja')}</th>
                  <th className="py-3 px-4">{tr('入职时间 / 司龄', 'Joined / Service', 'Tarikh Mula / Tempoh')}</th>
                  {activeTab === 'full_time' && <th className="py-3 px-4">{tr('年假额度口径', 'Annual Entitlement', 'Kelayakan Cuti Tahunan')}</th>}
                  {activeTab === 'full_time' && <th className="py-3 px-4">{tr('结转天数', 'Carry Forward', 'Bawa Ke Hadapan')}</th>}
                  {activeTab === 'full_time' && <th className="py-3 px-4">{tr('系统权限', 'Role', 'Peranan')}</th>}
                  <th className="py-3 px-4 text-center">{tr('账号状态', 'Status', 'Status')}</th>
                  <th className="py-3 pl-4 pr-6 text-right">{tr('操作管理', 'Actions', 'Tindakan')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={activeTab === 'full_time' ? 7 : 4} className="py-12 text-center text-xs text-ink-faint">
                      {tr('未找到符合筛选条件的员工记录。', 'No employees match the filter.', 'Tiada pekerja sepadan dengan penapis.')}
                    </td>
                  </tr>
                ) : (
                  filteredList.map((emp) => {
                    const initials = getInitials(emp.full_name)
                    const years = getYearsOfService(emp.date_of_commencement)

                    return (
                      <tr key={emp.id} className={`transition hover:bg-paper/40 ${!emp.is_active ? 'bg-paper/30 opacity-70' : ''}`}>
                        {/* 1. 员工信息 */}
                        <td className="py-3.5 pl-6 pr-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pine/90 to-pine text-xs font-bold text-white shadow-2xs">
                              {initials}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-ink">{emp.full_name}</span>
                                {emp.employee_no && (
                                  <span className="font-mono text-[11px] text-ink-faint bg-paper px-1.5 py-0.5 rounded border border-line/60">
                                    #{emp.employee_no}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-ink-faint">
                                {emp.employment_type === 'full_time' ? tr('全职员工', 'Full-time', 'Sepenuh Masa') : tr('兼职人员', 'Part-time', 'Sambilan')}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* 2. 入职时间与司龄 */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-xs text-ink">
                          <span className="font-mono">{emp.date_of_commencement}</span>
                          <span className="ml-2 rounded bg-paper px-1.5 py-0.5 text-[10px] text-ink-faint font-medium">
                            {tr(`${years.toFixed(1)} 年`, `${years.toFixed(1)} yrs`, `${years.toFixed(1)} thn`)}
                          </span>
                        </td>

                        {/* 3. 年假额度 */}
                        {activeTab === 'full_time' && (
                          <td className="py-3.5 px-4 whitespace-nowrap text-xs text-ink">
                            {emp.annual_leave_entitlement_override != null ? (
                              <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                                {tr(`特批 ${emp.annual_leave_entitlement_override} 天`, `Override ${emp.annual_leave_entitlement_override} days`, `Pelepasan ${emp.annual_leave_entitlement_override} hari`)}
                              </span>
                            ) : (
                              <span className="text-ink-soft">{tr('按司龄自动计算', 'Auto by years of service', 'Auto mengikut tempoh khidmat')}</span>
                            )}
                          </td>
                        )}

                        {/* 4. 结转天数 */}
                        {activeTab === 'full_time' && (
                          <td className="py-3.5 px-4 whitespace-nowrap text-xs font-mono text-ink">
                            {emp.annual_leave_carry_forward > 0 ? (
                              <span className="font-semibold text-pine">{tr(`${emp.annual_leave_carry_forward} 天`, `${emp.annual_leave_carry_forward} days`, `${emp.annual_leave_carry_forward} hari`)}</span>
                            ) : (
                              <span className="text-ink-faint">{tr('0 天', '0 days', '0 hari')}</span>
                            )}
                          </td>
                        )}

                        {/* 5. 角色 */}
                        {activeTab === 'full_time' && (
                          <td className="py-3.5 px-4 whitespace-nowrap text-xs">
                            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${
                              emp.role === 'manager'
                                ? 'bg-pine-soft text-pine border border-pine/30'
                                : 'bg-paper text-ink-soft border border-line'
                            }`}>
                              {emp.role === 'manager' ? tr('负责人 (Manager)', 'Manager', 'Pengurus') : tr('普通员工 (Staff)', 'Staff', 'Kakitangan')}
                            </span>
                          </td>
                        )}

                        {/* 6. 状态 */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleToggleActive(emp.id, emp.is_active)}
                            title={tr('点击快速切换在职/停用状态', 'Click to toggle active / inactive', 'Klik untuk tukar aktif / tidak aktif')}
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition ${
                              emp.is_active
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'bg-rust-soft text-rust hover:bg-rust/20'
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${emp.is_active ? 'bg-emerald-500' : 'bg-rust'}`} />
                            {emp.is_active ? tr('在职', 'Active', 'Aktif') : tr('已停用', 'Inactive', 'Tidak aktif')}
                          </button>
                        </td>

                        {/* 7. 操作 */}
                        <td className="py-3.5 pl-4 pr-6 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openEditModal(emp)}
                              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-ink-soft hover:bg-paper hover:text-ink transition"
                            >
                              <EditIcon className="h-3.5 w-3.5 text-ink-faint" />
                              {tr('编辑', 'Edit', 'Edit')}
                            </button>

                            {emp.employment_type === 'full_time' && (
                              <button
                                onClick={() => {
                                  setError('')
                                  setNewPassword('')
                                  setResettingEmployee({ id: emp.id, name: emp.full_name })
                                }}
                                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-pine hover:bg-pine-soft/60 transition"
                              >
                                <KeyIcon className="h-3.5 w-3.5" />
                                {tr('重置密码', 'Reset Password', 'Tetap Semula Kata Laluan')}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 表格底部信息 */}
          <div className="flex items-center justify-between border-t border-line px-5 py-3 bg-surface text-xs text-ink-faint">
            <span>
              {tr(`显示 ${filteredList.length} / 共 ${currentTabList.length} 位员工`, `Showing ${filteredList.length} of ${currentTabList.length} staff`, `Memaparkan ${filteredList.length} daripada ${currentTabList.length} pekerja`)}
            </span>
            <span>💡 {tr('提示：点击状态胶囊可直接切换账户启停', 'Tip: click the status pill to activate / deactivate an account', 'Petua: klik status untuk mengaktif / menyahaktifkan akaun')}</span>
          </div>
        </div>

      </div>

      {/* ════════════════════════════════════════════
          MODAL 1: 新增员工模态框 (替代原先笨重下拉)
          ════════════════════════════════════════════ */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-xs"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between border-b border-line pb-4">
              <div>
                <h2 className="text-base font-bold text-ink">{tr('新增员工账号', 'Add Employee', 'Tambah Pekerja')}</h2>
                <p className="mt-0.5 text-xs text-ink-faint">{tr('为新入职人员建立组织人事档案', 'Create a staff record for a new hire', 'Cipta rekod untuk pekerja baharu')}</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1.5 text-ink-faint hover:bg-paper hover:text-ink transition"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddEmployee} className="space-y-4 text-xs">
              {/* 用工类型切换 */}
              <div>
                <label className="field-label">{tr('用工类型', 'Employment Type', 'Jenis Pekerjaan')}</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setEmploymentType('full_time'); setRole('staff') }}
                    className={`rounded-lg border py-2 text-center text-xs font-medium transition ${
                      employmentType === 'full_time'
                        ? 'border-pine bg-pine-soft text-pine font-semibold'
                        : 'border-line text-ink-soft hover:bg-paper'
                    }`}
                  >
                    {tr('全职正式员工', 'Full-time Staff', 'Pekerja Sepenuh Masa')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEmploymentType('part_time'); setRole('staff') }}
                    className={`rounded-lg border py-2 text-center text-xs font-medium transition ${
                      employmentType === 'part_time'
                        ? 'border-pine bg-pine-soft text-pine font-semibold'
                        : 'border-line text-ink-soft hover:bg-paper'
                    }`}
                  >
                    {tr('兼职人员', 'Part-time Staff', 'Pekerja Sambilan')}
                  </button>
                </div>
              </div>

              {/* 姓名与入职日期 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">{tr('员工姓名', 'Full Name', 'Nama Penuh')} *</label>
                  <input
                    type="text"
                    required
                    placeholder={tr('如：张三 / John Doe', 'e.g. John Doe', 'cth: Ahmad bin Ali')}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="field-input"
                  />
                </div>
                <div>
                  <label className="field-label">{tr('入职日期', 'Commencement Date', 'Tarikh Mula Kerja')} *</label>
                  <input
                    type="date"
                    required
                    value={dateOfCommencement}
                    onChange={(e) => setDateOfCommencement(e.target.value)}
                    className="field-input"
                  />
                </div>
              </div>

              {/* 全职员工专属信息 (工号、初始密码、角色) */}
              {!isPartTime ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="field-label">{tr('系统工号 (纯数字)', 'Staff ID (numbers only)', 'ID Pekerja (nombor sahaja)')} *</label>
                      <input
                        type="text"
                        required
                        inputMode="numeric"
                        pattern="[0-9]{1,9}"
                        title={tr('只能填数字', 'Numbers only', 'Nombor sahaja')}
                        placeholder={tr('例如：003', 'e.g. 003', 'cth: 003')}
                        value={staffId}
                        onChange={(e) => setStaffId(e.target.value)}
                        className="field-input font-mono"
                      />
                    </div>
                    <div>
                      <label className="field-label">{tr('系统权限角色', 'System Role', 'Peranan Sistem')}</label>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="field-input"
                      >
                        <option value="staff">{tr('普通员工 (Staff)', 'Staff', 'Kakitangan')}</option>
                        <option value="manager">{tr('主管/负责人 (Manager)', 'Manager', 'Pengurus')}</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="field-label">{tr('初始登录密码 (至少 6 位)', 'Initial password (min. 6 characters)', 'Kata laluan awal (min. 6 aksara)')} *</label>
                    <input
                      type="text"
                      required
                      minLength={6}
                      placeholder={tr('设置默认初始密码', 'Set an initial password', 'Tetapkan kata laluan awal')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="field-input font-mono"
                    />
                    <p className="mt-1 text-[11px] text-ink-faint">
                      {tr('员工首次登录后可在个人菜单自行修改密码。', 'Staff can change their password from their profile menu after first login.', 'Pekerja boleh menukar kata laluan melalui menu profil selepas log masuk pertama.')}
                    </p>
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-line bg-paper/60 p-3 text-ink-soft">
                  <p className="font-semibold text-ink">ℹ️ {tr('兼职人员无系统登录账号', 'Part-time staff have no login account', 'Pekerja sambilan tiada akaun log masuk')}</p>
                  <p className="mt-0.5 text-[11px] text-ink-faint">
                    {tr('兼职人员不需要独立系统账户，工时由负责人在【工时记录】页面统一登记核算。', 'Part-time staff do not need a system account. Managers record their hours on the Work Hours page.', 'Pekerja sambilan tidak memerlukan akaun sistem. Pengurus merekod jam kerja mereka di halaman Jam Kerja.')}
                  </p>
                </div>
              )}

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
                  {submitting ? tr('保存中...', 'Saving...', 'Menyimpan...') : tr('确认添加', 'Add', 'Tambah')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          MODAL 2: 编辑员工档案抽屉 / 模态框
          ════════════════════════════════════════════ */}
      {editingEmployee && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-xs"
          onClick={() => setEditingEmployee(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between border-b border-line pb-4">
              <div>
                <h2 className="text-base font-bold text-ink">{tr('编辑员工档案', 'Edit Employee', 'Edit Pekerja')}</h2>
                <p className="mt-0.5 text-xs text-ink-faint">
                  {editingEmployee.full_name} {editingEmployee.employee_no ? `(#${editingEmployee.employee_no})` : ''}
                </p>
              </div>
              <button
                onClick={() => setEditingEmployee(null)}
                className="rounded-lg p-1.5 text-ink-faint hover:bg-paper hover:text-ink transition"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div>
                <label className="field-label">{tr('入职日期 (Commencement Date)', 'Commencement Date', 'Tarikh Mula Kerja')}</label>
                <input
                  type="date"
                  required
                  value={editCommencement}
                  onChange={(e) => setEditCommencement(e.target.value)}
                  className="field-input"
                />
              </div>

              {editingEmployee.employment_type === 'full_time' && (
                <>
                  <div>
                    <label className="field-label">{tr('系统权限角色', 'System Role', 'Peranan Sistem')}</label>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      className="field-input"
                    >
                      <option value="staff">{tr('普通员工 (Staff)', 'Staff', 'Kakitangan')}</option>
                      <option value="manager">{tr('主管/负责人 (Manager)', 'Manager', 'Pengurus')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="field-label">{tr('年假额度特批覆盖 (Override)', 'Annual Leave Override', 'Pelepasan Cuti Tahunan')}</label>
                    <input
                      type="number"
                      step="0.5"
                      placeholder={tr('留空则按法定年资自动计算', 'Leave blank to calculate automatically', 'Biarkan kosong untuk pengiraan automatik')}
                      value={editOverride}
                      onChange={(e) => setEditOverride(e.target.value)}
                      className="field-input"
                    />
                    <p className="mt-1 text-[11px] text-ink-faint">
                      {tr('留空表示自动按马来西亚劳工法排期计算；填写数字则固定为该天数。', 'Leave blank to calculate automatically under Malaysian labour law; enter a number to fix the entitlement.', 'Biarkan kosong untuk pengiraan automatik mengikut undang-undang buruh Malaysia; masukkan nombor untuk menetapkan kelayakan.')}
                    </p>
                  </div>

                  <div>
                    <label className="field-label">{tr('年假结转天数 (Carry Forward)', 'Carry Forward Days', 'Hari Dibawa Ke Hadapan')}</label>
                    <input
                      type="number"
                      step="0.5"
                      value={editCarry}
                      onChange={(e) => setEditCarry(e.target.value)}
                      className="field-input"
                    />
                    <p className="mt-1 text-[11px] text-ink-faint">{tr('从去年结转至今年的年假天数。', 'Annual leave days carried over from last year.', 'Hari cuti tahunan yang dibawa dari tahun lepas.')}</p>
                  </div>
                </>
              )}

              <div className="mt-6 flex justify-end gap-2.5 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  className="rounded-lg border border-line bg-surface px-4 py-2 text-xs font-medium text-ink-soft hover:bg-paper transition"
                >
                  {tr('取消', 'Cancel', 'Batal')}
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="rounded-lg bg-pine px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-pine-deep disabled:opacity-50 transition"
                >
                  {savingEdit ? tr('保存中...', 'Saving...', 'Menyimpan...') : tr('保存更改', 'Save Changes', 'Simpan Perubahan')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          MODAL 3: 重置员工密码模态框 (告别 window.prompt)
          ════════════════════════════════════════════ */}
      {resettingEmployee && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-xs"
          onClick={() => setResettingEmployee(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between border-b border-line pb-3">
              <div>
                <h2 className="text-base font-bold text-ink">{tr('重置员工密码', 'Reset Password', 'Tetap Semula Kata Laluan')}</h2>
                <p className="mt-0.5 text-xs text-ink-faint">{tr('员工', 'Employee', 'Pekerja')}: {resettingEmployee.name}</p>
              </div>
              <button
                onClick={() => setResettingEmployee(null)}
                className="rounded-lg p-1.5 text-ink-faint hover:bg-paper hover:text-ink transition"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmResetPassword} className="space-y-4 text-xs">
              <div>
                <label className="field-label">{tr('输入新密码 (至少 6 位)', 'New password (min. 6 characters)', 'Kata laluan baharu (min. 6 aksara)')}</label>
                <input
                  type="text"
                  required
                  minLength={6}
                  autoFocus
                  placeholder={tr('请输入新密码', 'Enter new password', 'Masukkan kata laluan baharu')}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="field-input font-mono"
                />
              </div>

              {error && <p className="text-xs text-rust">{error}</p>}

              <div className="mt-5 flex justify-end gap-2.5 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setResettingEmployee(null)}
                  className="rounded-lg border border-line bg-surface px-4 py-2 text-xs font-medium text-ink-soft hover:bg-paper transition"
                >
                  {tr('取消', 'Cancel', 'Batal')}
                </button>
                <button
                  type="submit"
                  disabled={resetting || newPassword.length < 6}
                  className="rounded-lg bg-pine px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-pine-deep disabled:opacity-40 transition"
                >
                  {resetting ? tr('重置中...', 'Resetting...', 'Menetapkan semula...') : tr('确认重置', 'Reset', 'Tetap Semula')}
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
export default function ManageEmployeesPage() {
  return (
    <>
      <div className="md:hidden">
        <MobileEmployees />
      </div>
      <div className="hidden md:block">
        <DesktopEmployees />
      </div>
    </>
  )
}
