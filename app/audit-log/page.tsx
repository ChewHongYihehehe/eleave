'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import ManagerShell from '@/components/ManagerShell'
import { useEmployee } from '@/lib/useEmployee'
import AuthStatus from '@/components/AuthStatus'
import MobileAuditLog from '@/components/manager/MobileAuditLog'

type LogRow = {
  id: string
  action: string
  created_at: string
  details: Record<string, unknown> | null
  actor: { full_name: string } | null
  target: { full_name: string } | null
  leave_application_id: string | null
}

const ACTION_LABELS: Record<string, string> = {
  'leave.recorded_by_manager': 'Recorded leave for employee',
  'leave.approved': 'Approved leave',
  'leave.rejected': 'Rejected leave',
  'leave.cancelled_by_manager': 'Cancelled an approved leave',
  'leave.cancellation_confirmed': 'Confirmed a cancellation request',
  'leave.cancellation_declined': 'Declined a cancellation request',
  'employee.password_reset': 'Reset a password',
  'employee.activated': 'Activated an employee',
  'employee.deactivated': 'Deactivated an employee',
  'employee.field_updated': 'Edited employee details',
}

const FIELD_LABELS: Record<string, string> = {
  date_of_commencement: 'Commencement date',
  annual_leave_carry_forward: 'Annual leave carry-forward',
  role: 'Role',
}

const PAGE_SIZE = 40

function describeDetails(action: string, details: Record<string, unknown> | null): string | null {
  if (!details) return null
  if (action === 'leave.rejected' || action === 'leave.cancellation_declined') {
    return details.reason ? `Reason: ${details.reason}` : null
  }
  if (action === 'leave.cancelled_by_manager') {
    const bits = []
    if (details.start_date && details.end_date) bits.push(`${details.start_date} → ${details.end_date}`)
    if (typeof details.total_days === 'number') bits.push(`${details.total_days} day(s)`)
    if (details.reason) bits.push(`Reason: ${details.reason}`)
    return bits.join(' · ') || null
  }
  if (action === 'leave.recorded_by_manager') {
    const bits = []
    if (details.leave_type) bits.push(String(details.leave_type))
    if (details.start_date && details.end_date) bits.push(`${details.start_date} → ${details.end_date}`)
    if (typeof details.total_days === 'number') bits.push(`${details.total_days} day(s)`)
    if (details.mc_attached) bits.push('MC attached')
    return bits.join(' · ') || null
  }
  if (action === 'employee.field_updated') {
    const field = FIELD_LABELS[String(details.field)] || String(details.field)
    return `${field}: ${String(details.from ?? '—')} → ${String(details.to ?? '—')}`
  }
  return null
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-MY', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function DesktopAuditLog() {
  const auth = useEmployee({ requireManager: true })
  const [logs, setLogs] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [employeeOptions, setEmployeeOptions] = useState<{ id: string; full_name: string }[]>([])
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (auth.status === 'ready') {
      loadEmployeeOptions()
      loadLogs()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status])

  useEffect(() => {
    if (auth.status === 'ready') loadLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeFilter, actionFilter])

  async function loadEmployeeOptions() {
    const { data } = await supabase.from('employees').select('id, full_name').order('full_name', { ascending: true })
    if (data) setEmployeeOptions(data)
  }

  async function loadLogs() {
    setLoading(true)
    setLoadError('')
    let query = supabase
      .from('audit_log')
      .select(`
        id, action, created_at, details, leave_application_id,
        actor:employees!audit_log_actor_id_fkey(full_name),
        target:employees!audit_log_target_employee_id_fkey(full_name)
      `)
      .order('created_at', { ascending: false })
      .limit(500)

    if (employeeFilter) query = query.or(`actor_id.eq.${employeeFilter},target_employee_id.eq.${employeeFilter}`)
    if (actionFilter) query = query.eq('action', actionFilter)

    const { data, error } = await query
    setLoading(false)
    if (error) { setLoadError('Could not load the audit log. Please try again.'); return }
    setLogs((data || []) as unknown as LogRow[])
    setPage(1)
  }

  const paginated = useMemo(
    () => logs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [logs, page]
  )
  const totalPages = Math.max(1, Math.ceil(logs.length / PAGE_SIZE))

  if (auth.status !== 'ready') return <AuthStatus state={auth} />

  return (
    <ManagerShell>
      <div className="space-y-6 pb-10">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Audit Log</h1>
          <p className="mt-0.5 text-sm text-ink-soft">
            Who did what, and when — approvals, rejections, cancellations, password resets, and employee record changes.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            className="field-input w-auto min-w-[180px]"
          >
            <option value="">All employees</option>
            {employeeOptions.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.full_name}</option>
            ))}
          </select>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="field-input w-auto min-w-[200px]"
          >
            <option value="">All actions</option>
            {Object.entries(ACTION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {loadError && <p className="rounded-xl border border-rust/30 bg-rust-soft p-3.5 text-sm text-rust">{loadError}</p>}

        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          {loading ? (
            <p className="p-8 text-center text-sm text-ink-faint">Loading...</p>
          ) : paginated.length === 0 ? (
            <p className="p-8 text-center text-sm text-ink-faint">No matching log entries.</p>
          ) : (
            <>
              {/* ── Desktop table ── */}
              <table className="hidden md:table w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-paper/60 text-left text-[13px] font-medium text-ink-faint">
                    <th className="px-4 py-2.5">When</th>
                    <th className="px-4 py-2.5">Who</th>
                    <th className="px-4 py-2.5">Action</th>
                    <th className="px-4 py-2.5">On behalf of</th>
                    <th className="px-4 py-2.5">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((log) => (
                    <tr key={log.id} className="border-b border-line last:border-b-0">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-soft">{formatWhen(log.created_at)}</td>
                      <td className="px-4 py-3 font-medium text-ink">{log.actor?.full_name || '—'}</td>
                      <td className="px-4 py-3 text-ink-soft">{ACTION_LABELS[log.action] || log.action}</td>
                      <td className="px-4 py-3 text-ink-soft">{log.target?.full_name || '—'}</td>
                      <td className="max-w-xs px-4 py-3 text-xs text-ink-faint">{describeDetails(log.action, log.details)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 text-sm text-ink-soft">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md bg-paper px-3 py-1.5 ring-1 ring-line disabled:opacity-40"
            >
              Previous
            </button>
            <span>Page {page} of {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-md bg-paper px-3 py-1.5 ring-1 ring-line disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </ManagerShell>
  )
}

// 手机用新的钉钉风格页面,电脑沿用下面这个表格版
export default function AuditLogPage() {
  return (
    <>
      <div className="md:hidden">
        <MobileAuditLog />
      </div>
      <div className="hidden md:block">
        <DesktopAuditLog />
      </div>
    </>
  )
}
