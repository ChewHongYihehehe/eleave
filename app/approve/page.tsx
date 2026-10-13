'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { LEAVE_TYPE_LABELS } from '@/lib/leaveRules'
import ManagerShell from '@/components/ManagerShell'
import { useEmployee } from '@/lib/useEmployee'
import AuthStatus from '@/components/AuthStatus'
import RecordLeaveModal from '@/components/RecordLeaveModal'
import { getMcSignedUrl } from '@/lib/mcAttachments'

type Application = {
  id: string
  employee_id: string
  leave_type: string
  start_date: string
  end_date: string
  total_days: number
  reason: string
  status: string
  is_half_day: boolean
  half_day_period: string | null
  remarks: string | null
  cancellation_status: string
  cancellation_requested_at: string | null
  cancellation_decision_reason: string | null
  mc_attachment_path: string | null
  employees: {
    full_name: string
    employment_type?: string
    employee_no?: number | null
  } | null
}

// ── Icons ────────────────────────────────────────────────────────────────────

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function MoreHorizontalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="19" cy="12" r="1.75" />
      <circle cx="5" cy="12" r="1.75" />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  if (!name) return 'U'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatLeaveDates(startDate: string, endDate: string) {
  if (!startDate) return ''
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  const startMonth = start.toLocaleDateString('en-US', { month: 'short' })
  const startDay = start.getDate()
  const startYear = start.getFullYear()

  if (startDate === endDate) {
    return `${startMonth} ${startDay}, ${startYear}`
  }

  const endMonth = end.toLocaleDateString('en-US', { month: 'short' })
  const endDay = end.getDate()
  const endYear = end.getFullYear()

  if (startYear === endYear) {
    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} – ${endDay}, ${startYear}`
    }
    return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${startYear}`
  }
  return `${startMonth} ${startDay}, ${startYear} – ${endMonth} ${endDay}, ${endYear}`
}

function StatusBadge({
  status,
  cancellationStatus,
}: {
  status: string
  cancellationStatus?: string
}) {
  if (status === 'approved' && cancellationStatus === 'requested') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold-soft px-2.5 py-0.5 text-xs font-medium text-gold">
        <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse" />
        Cancel Requested
      </span>
    )
  }
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-pine/20 bg-pine-soft px-2.5 py-0.5 text-xs font-medium text-pine-deep">
        <span className="h-1.5 w-1.5 rounded-full bg-pine" />
        Approved
      </span>
    )
  }
  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold-soft px-2.5 py-0.5 text-xs font-medium text-gold">
        <span className="h-1.5 w-1.5 rounded-full bg-gold" />
        Pending
      </span>
    )
  }
  if (status === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-rust/20 bg-rust-soft px-2.5 py-0.5 text-xs font-medium text-rust">
        <span className="h-1.5 w-1.5 rounded-full bg-rust" />
        Rejected
      </span>
    )
  }
  if (status === 'cancelled') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-0.5 text-xs font-medium text-ink-faint">
        <span className="h-1.5 w-1.5 rounded-full bg-ink-faint" />
        Cancelled
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-0.5 text-xs font-medium text-ink-faint">
      <span className="h-1.5 w-1.5 rounded-full bg-ink-faint" />
      {status}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ApprovePage() {
  const auth = useEmployee({ requireManager: true })
  const approverId = auth.status === 'ready' ? auth.employee.id : null
  const [applications, setApplications] = useState<Application[]>([])
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'cancelled'>('pending')
  const [employeeOptions, setEmployeeOptions] = useState<{ id: string; full_name: string }[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [batchBusy, setBatchBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [recordOpen, setRecordOpen] = useState(false)

  // Pagination & action menu state
  const [currentPage, setCurrentPage] = useState(1)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const pageSize = 5

  // 拒绝时要填理由
  const [rejectIds, setRejectIds] = useState<string[] | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectBusy, setRejectBusy] = useState(false)

  // 拒绝"取消申请"时要填理由
  const [declineCancelId, setDeclineCancelId] = useState<string | null>(null)
  const [declineCancelReason, setDeclineCancelReason] = useState('')
  const [declineCancelBusy, setDeclineCancelBusy] = useState(false)

  // 经理直接取消一笔已批准的假
  const [managerCancelId, setManagerCancelId] = useState<string | null>(null)
  const [managerCancelReason, setManagerCancelReason] = useState('')
  const [managerCancelBusy, setManagerCancelBusy] = useState(false)

  useEffect(() => {
    if (auth.status !== 'ready') return
    loadData()
    setSelected(new Set())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status])

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside() {
      setActiveMenuId(null)
    }
    if (activeMenuId) {
      window.addEventListener('click', handleClickOutside)
      return () => window.removeEventListener('click', handleClickOutside)
    }
  }, [activeMenuId])

  async function loadData() {
    if (employeeOptions.length === 0) {
      const { data: emps } = await supabase
        .from('employees')
        .select('id, full_name')
        .order('full_name', { ascending: true })
      if (emps) setEmployeeOptions(emps)
    }

    const { data: apps } = await supabase
      .from('leave_applications')
      .select(`
        id, employee_id, leave_type, start_date, end_date, total_days,
        reason, status, is_half_day, half_day_period, remarks,
        cancellation_status, cancellation_requested_at, cancellation_decision_reason, mc_attachment_path,
        employees!leave_applications_employee_id_fkey(full_name, employment_type, employee_no)
      `)
      .order('created_at', { ascending: false })

    if (apps) {
      setApplications(apps as unknown as Application[])
    }
  }

  // Filtered applications
  const filteredApplications = applications.filter((app) => {
    if (search && app.employees?.full_name !== search) return false
    if (filter === 'pending') return app.status === 'pending'
    if (filter === 'approved') return app.status === 'approved' && app.cancellation_status !== 'requested'
    if (filter === 'rejected') return app.status === 'rejected'
    if (filter === 'cancelled') return app.status === 'cancelled' || app.cancellation_status === 'requested'
    return true
  })

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredApplications.length / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * pageSize
  const paginatedApplications = filteredApplications.slice(startIndex, startIndex + pageSize)

  async function handleViewMc(path: string) {
    const url = await getMcSignedUrl(path)
    if (!url) { setActionError('Could not open the attachment. Please try again.'); return }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelected((prev) =>
      prev.size === paginatedApplications.length
        ? new Set()
        : new Set(paginatedApplications.map((app) => app.id))
    )
  }

  // 所有审批动作统一走服务器的 /api/leave-applications/decision:
  // 规则只在服务器一处定义,而且会写审计日志、通知员工的 Telegram、收掉其他负责人的按钮。
  // 成功回 null,失败回要显示给负责人的错误文字。
  async function sendDecision(action: string, ids: string[], reason?: string): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/leave-applications/decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ ids, action, reason }),
    })
    if (res.ok) return null
    const body = await res.json().catch(() => ({}))
    return body.error || 'Something went wrong. Please try again.'
  }

  async function handleBatchApprove() {
    if (!approverId || selected.size === 0) return
    setActionError('')
    setBatchBusy(true)
    const err = await sendDecision('approve', Array.from(selected))
    if (err) setActionError(err)
    setSelected(new Set())
    setBatchBusy(false)
    loadData()
  }

  function openRejectDialog(ids: string[]) {
    setActionError('')
    setRejectReason('')
    setRejectIds(ids)
  }

  async function confirmReject() {
    if (!approverId || !rejectIds || rejectIds.length === 0) return
    const reason = rejectReason.trim()
    if (!reason) return
    setRejectBusy(true)
    const err = await sendDecision('reject', rejectIds, reason)
    setRejectBusy(false)
    if (err) { setActionError(err); return }
    setRejectIds(null)
    setRejectReason('')
    setSelected(new Set())
    loadData()
  }

  async function handleApprove(id: string) {
    if (!approverId) return
    setActionError('')
    const err = await sendDecision('approve', [id])
    if (err) setActionError(err)
    loadData()
  }

  async function handleConfirmCancellation(id: string) {
    setActionError('')
    const err = await sendDecision('confirm_cancellation', [id])
    if (err) { setActionError(err); loadData(); return }
    loadData()
  }

  function openManagerCancelDialog(id: string) {
    setActionError('')
    setManagerCancelReason('')
    setManagerCancelId(id)
  }

  async function confirmManagerCancel() {
    if (!managerCancelId) return
    setManagerCancelBusy(true)
    const reason = managerCancelReason.trim()
    const err = await sendDecision('cancel', [managerCancelId], reason)
    setManagerCancelBusy(false)
    if (err) { setActionError(err); return }
    setManagerCancelId(null)
    setManagerCancelReason('')
    loadData()
  }

  function openDeclineCancelDialog(id: string) {
    setActionError('')
    setDeclineCancelReason('')
    setDeclineCancelId(id)
  }

  async function confirmDeclineCancel() {
    if (!declineCancelId) return
    const reason = declineCancelReason.trim()
    if (!reason) return
    setDeclineCancelBusy(true)
    const err = await sendDecision('decline_cancellation', [declineCancelId], reason)
    setDeclineCancelBusy(false)
    if (err) { setActionError(err); return }
    setDeclineCancelId(null)
    setDeclineCancelReason('')
    loadData()
  }

  if (auth.status !== 'ready') return <AuthStatus state={auth} />

  const pendingCount = applications.filter((a) => a.status === 'pending').length

  return (
    <ManagerShell pendingCount={pendingCount}>
      <div className="space-y-6 pb-12">
        {/* Top Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">Leave Approvals</h1>
            <p className="mt-0.5 text-sm text-ink-soft">Review and process leave requests for all employees.</p>
          </div>
          <button
            onClick={() => { setNotice(''); setRecordOpen(true) }}
            className="inline-flex items-center gap-2 rounded-xl bg-pine px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-pine-deep self-start sm:self-auto"
          >
            <PlusIcon className="h-4 w-4" />
            Record leave for employee
          </button>
        </div>

        {notice && <p className="rounded-xl border border-pine/20 bg-pine-soft p-3.5 text-sm text-pine-deep">{notice}</p>}
        {actionError && <p className="rounded-xl border border-rust/30 bg-rust-soft p-3.5 text-sm text-rust">{actionError}</p>}

        {/* ── Main Leave Requests Card (Same design as Your Leave Requests) ── */}
        <div className="rounded-2xl border border-line bg-surface shadow-sm">
          {/* Card Header with Search and Segmented Filter Tabs */}
          <div className="flex flex-col gap-4 border-b border-line p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-ink">Employee leave requests</h2>
              <p className="mt-0.5 text-xs sm:text-sm text-ink-soft">
                View and manage time-off requests across your team.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Employee Search Filter */}
              <select
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
                className="rounded-xl border border-line bg-paper px-3 py-1.5 text-xs sm:text-sm text-ink focus:border-pine focus:outline-none"
              >
                <option value="">All employees</option>
                {employeeOptions.map((emp) => (
                  <option key={emp.id} value={emp.full_name}>
                    {emp.full_name}
                  </option>
                ))}
              </select>

              {/* Segmented Filter Tabs */}
              <div className="inline-flex flex-wrap rounded-xl border border-line bg-paper p-1 gap-0.5">
                <button
                  type="button"
                  onClick={() => { setFilter('all'); setCurrentPage(1) }}
                  className={`rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition ${filter === 'all'
                    ? 'bg-surface text-ink font-semibold shadow-sm'
                    : 'text-ink-soft hover:text-ink'
                    }`}
                >
                  All requests
                </button>
                <button
                  type="button"
                  onClick={() => { setFilter('pending'); setCurrentPage(1) }}
                  className={`rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition ${filter === 'pending'
                    ? 'bg-surface text-ink font-semibold shadow-sm'
                    : 'text-ink-soft hover:text-ink'
                    }`}
                >
                  Pending {pendingCount > 0 && `(${pendingCount})`}
                </button>
                <button
                  type="button"
                  onClick={() => { setFilter('approved'); setCurrentPage(1) }}
                  className={`rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition ${filter === 'approved'
                    ? 'bg-surface text-ink font-semibold shadow-sm'
                    : 'text-ink-soft hover:text-ink'
                    }`}
                >
                  Approved
                </button>
                <button
                  type="button"
                  onClick={() => { setFilter('rejected'); setCurrentPage(1) }}
                  className={`rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition ${filter === 'rejected'
                    ? 'bg-surface text-ink font-semibold shadow-sm'
                    : 'text-ink-soft hover:text-ink'
                    }`}
                >
                  Rejected
                </button>
                <button
                  type="button"
                  onClick={() => { setFilter('cancelled'); setCurrentPage(1) }}
                  className={`rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition ${filter === 'cancelled'
                    ? 'bg-surface text-ink font-semibold shadow-sm'
                    : 'text-ink-soft hover:text-ink'
                    }`}
                >
                  Cancelled
                </button>
              </div>
            </div>
          </div>

          {/* Batch Bar (For Pending approvals) */}
          {filter === 'pending' && selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-b border-line bg-paper px-6 py-2.5">
              <span className="text-xs sm:text-sm text-ink-soft">
                <span className="font-semibold text-ink">{selected.size}</span> selected
              </span>
              <div className="ml-auto flex gap-2">
                <button
                  disabled={batchBusy}
                  onClick={handleBatchApprove}
                  className="rounded-lg bg-pine px-3 py-1.5 text-xs font-medium text-white hover:bg-pine-deep disabled:opacity-40"
                >
                  Approve selected
                </button>
                <button
                  disabled={batchBusy}
                  onClick={() => openRejectDialog(Array.from(selected))}
                  className="rounded-lg border border-rust/30 bg-rust-soft px-3 py-1.5 text-xs font-medium text-rust hover:bg-rust/20 disabled:opacity-40"
                >
                  Reject selected
                </button>
              </div>
            </div>
          )}

          {/* Table View (Desktop & Tablet) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  {filter === 'pending' && (
                    <th className="py-3.5 pl-6 pr-2 w-10">
                      <input
                        type="checkbox"
                        checked={selected.size === paginatedApplications.length && paginatedApplications.length > 0}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-line text-pine focus:ring-pine"
                      />
                    </th>
                  )}
                  <th className={`py-3.5 ${filter === 'pending' ? 'pl-2' : 'pl-6'} pr-4`}>Employee</th>
                  <th className="py-3.5 px-4">Leave type</th>
                  <th className="py-3.5 px-4">Dates</th>
                  <th className="py-3.5 px-4">Duration</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 pl-4 pr-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {paginatedApplications.length === 0 ? (
                  <tr>
                    <td colSpan={filter === 'pending' ? 7 : 6} className="py-12 text-center text-sm text-ink-faint">
                      {applications.length === 0
                        ? 'No leave requests found.'
                        : search
                          ? `No ${filter} requests from ${search}.`
                          : `No ${filter} requests found.`}
                    </td>
                  </tr>
                ) : (
                  paginatedApplications.map((app) => {
                    const empName = app.employees?.full_name || 'Employee'
                    const initials = getInitials(empName)

                    return (
                      <tr key={app.id} className="transition hover:bg-paper/40">
                        {filter === 'pending' && (
                          <td className="py-4 pl-6 pr-2">
                            <input
                              type="checkbox"
                              checked={selected.has(app.id)}
                              onChange={() => toggleSelected(app.id)}
                              className="h-4 w-4 rounded border-line text-pine focus:ring-pine"
                            />
                          </td>
                        )}

                        {/* Employee */}
                        <td className={`py-4 ${filter === 'pending' ? 'pl-2' : 'pl-6'} pr-4`}>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pine/20 font-bold text-xs text-pine">
                              {initials}
                            </div>
                            <div>
                              <p className="font-medium text-ink">{empName}</p>
                              <p className="text-xs text-ink-faint">
                                {app.employees?.employment_type || (app.employees?.employee_no ? `#${app.employees.employee_no}` : 'Staff')}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Leave Type */}
                        <td className="py-4 px-4">
                          <p className="text-sm font-medium text-ink">
                            {LEAVE_TYPE_LABELS[app.leave_type] || app.leave_type}
                            {app.is_half_day && app.half_day_period && (
                              <span className="ml-1.5 text-xs text-ink-faint">
                                ({app.half_day_period.toUpperCase()})
                              </span>
                            )}
                          </p>
                          {app.reason && (
                            <p className="mt-0.5 line-clamp-1 text-xs text-ink-soft" title={app.reason}>
                              Note: {app.reason}
                            </p>
                          )}
                          {app.mc_attachment_path && (
                            <button
                              onClick={() => handleViewMc(app.mc_attachment_path as string)}
                              className="mt-0.5 text-xs font-medium text-pine underline decoration-dotted hover:text-pine-deep"
                            >
                              View MC
                            </button>
                          )}
                        </td>

                        {/* Dates */}
                        <td className="py-4 px-4 whitespace-nowrap text-sm text-ink-soft">
                          {formatLeaveDates(app.start_date, app.end_date)}
                        </td>

                        {/* Duration */}
                        <td className="py-4 px-4 whitespace-nowrap text-sm text-ink-soft">
                          {app.total_days} {app.total_days === 1 ? 'day' : 'days'}
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <StatusBadge
                            status={app.status}
                            cancellationStatus={app.cancellation_status}
                          />
                          {app.status === 'approved' && app.cancellation_status === 'requested' && (
                            <p className="mt-1 text-[11px] text-amber-700 font-medium">
                              {app.cancellation_requested_at
                                ? `Requested ${new Date(app.cancellation_requested_at).toLocaleDateString('en-MY')}`
                                : 'Cancellation requested'}
                            </p>
                          )}
                          {app.status === 'approved' && app.cancellation_status === 'none' && app.cancellation_decision_reason && (
                            <p className="mt-1 text-[11px] text-rust font-medium">
                              Cancel declined: {app.cancellation_decision_reason}
                            </p>
                          )}
                          {app.status === 'cancelled' && app.cancellation_decision_reason && (
                            <p className="mt-1 text-[11px] text-ink-soft">
                              Cancelled: {app.cancellation_decision_reason}
                            </p>
                          )}
                          {app.status === 'rejected' && app.remarks && (
                            <p className="mt-1 text-[11px] text-rust font-medium">
                              Reason: {app.remarks}
                            </p>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-4 pl-4 pr-6 text-right relative">
                          <div className="inline-flex items-center justify-end gap-2">
                            {/* Pending actions */}
                            {app.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleApprove(app.id)}
                                  className="rounded-lg bg-pine px-2.5 py-1 text-xs font-medium text-white transition hover:bg-pine-deep"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => openRejectDialog([app.id])}
                                  className="rounded-lg border border-rust/30 bg-rust-soft px-2.5 py-1 text-xs font-medium text-rust transition hover:bg-rust/20"
                                >
                                  Reject
                                </button>
                              </>
                            )}

                            {/* Cancellation request actions */}
                            {app.status === 'approved' && app.cancellation_status === 'requested' && (
                              <>
                                <button
                                  onClick={() => handleConfirmCancellation(app.id)}
                                  className="rounded-lg bg-pine px-2.5 py-1 text-xs font-medium text-white transition hover:bg-pine-deep"
                                >
                                  Confirm cancel
                                </button>
                                <button
                                  onClick={() => openDeclineCancelDialog(app.id)}
                                  className="rounded-lg border border-rust/30 bg-rust-soft px-2.5 py-1 text-xs font-medium text-rust transition hover:bg-rust/20"
                                >
                                  Keep leave
                                </button>
                              </>
                            )}

                            {/* Approved leave direct cancellation by manager */}
                            {app.status === 'approved' && app.cancellation_status !== 'requested' && (
                              <button
                                onClick={() => openManagerCancelDialog(app.id)}
                                className="rounded-lg border border-line bg-paper px-2.5 py-1 text-xs font-medium text-ink-soft transition hover:bg-rust-soft hover:text-rust"
                              >
                                Cancel
                              </button>
                            )}

                            {/* Dropdown toggle for extra details */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setActiveMenuId(activeMenuId === app.id ? null : app.id)
                                }}
                                className="rounded-lg p-1.5 text-ink-faint transition hover:bg-paper hover:text-ink"
                                title="Actions"
                              >
                                <MoreHorizontalIcon className="h-5 w-5" />
                              </button>

                              {activeMenuId === app.id && (
                                <div
                                  className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-line bg-surface py-1 text-left shadow-xl"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {app.status === 'pending' && (
                                    <>
                                      <button
                                        onClick={() => { setActiveMenuId(null); handleApprove(app.id) }}
                                        className="flex w-full items-center px-4 py-2 text-xs font-medium text-pine hover:bg-pine-soft"
                                      >
                                        Approve request
                                      </button>
                                      <button
                                        onClick={() => { setActiveMenuId(null); openRejectDialog([app.id]) }}
                                        className="flex w-full items-center px-4 py-2 text-xs font-medium text-rust hover:bg-rust-soft"
                                      >
                                        Reject request
                                      </button>
                                    </>
                                  )}

                                  {app.status === 'approved' && app.cancellation_status === 'requested' && (
                                    <>
                                      <button
                                        onClick={() => { setActiveMenuId(null); handleConfirmCancellation(app.id) }}
                                        className="flex w-full items-center px-4 py-2 text-xs font-medium text-pine hover:bg-pine-soft"
                                      >
                                        Confirm cancellation
                                      </button>
                                      <button
                                        onClick={() => { setActiveMenuId(null); openDeclineCancelDialog(app.id) }}
                                        className="flex w-full items-center px-4 py-2 text-xs font-medium text-rust hover:bg-rust-soft"
                                      >
                                        Decline cancellation
                                      </button>
                                    </>
                                  )}

                                  {app.status === 'approved' && app.cancellation_status !== 'requested' && (
                                    <button
                                      onClick={() => { setActiveMenuId(null); openManagerCancelDialog(app.id) }}
                                      className="flex w-full items-center px-4 py-2 text-xs font-medium text-rust hover:bg-rust-soft"
                                    >
                                      Cancel this leave
                                    </button>
                                  )}

                                  <div className="border-t border-line my-1" />
                                  <div className="px-4 py-1.5 text-[11px] text-ink-faint">
                                    Total: {app.total_days} day(s)
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View */}
          <div className="md:hidden divide-y divide-line">
            {paginatedApplications.length === 0 ? (
              <p className="py-10 text-center text-sm text-ink-faint">
                No leave requests found in this category.
              </p>
            ) : (
              paginatedApplications.map((app) => {
                const empName = app.employees?.full_name || 'Employee'
                const initials = getInitials(empName)

                return (
                  <div key={app.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pine/20 font-bold text-xs text-pine">
                          {initials}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-ink">{empName}</p>
                          <p className="text-xs text-ink-faint">{LEAVE_TYPE_LABELS[app.leave_type] || app.leave_type}</p>
                        </div>
                      </div>
                      <StatusBadge
                        status={app.status}
                        cancellationStatus={app.cancellation_status}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 rounded-xl bg-paper p-3 text-xs">
                      <div>
                        <span className="text-ink-faint block mb-0.5">Dates</span>
                        <span className="font-medium text-ink">
                          {formatLeaveDates(app.start_date, app.end_date)}
                        </span>
                      </div>
                      <div>
                        <span className="text-ink-faint block mb-0.5">Duration</span>
                        <span className="font-medium text-ink">
                          {app.total_days} {app.total_days === 1 ? 'day' : 'days'}
                          {app.is_half_day && app.half_day_period && ` (${app.half_day_period.toUpperCase()})`}
                        </span>
                      </div>
                    </div>

                    {app.reason && (
                      <p className="text-xs text-ink-soft">
                        <span className="text-ink-faint">Note:</span> {app.reason}
                      </p>
                    )}

                    {app.mc_attachment_path && (
                      <button
                        onClick={() => handleViewMc(app.mc_attachment_path as string)}
                        className="text-xs font-medium text-pine underline decoration-dotted"
                      >
                        View MC
                      </button>
                    )}

                    {app.status === 'approved' && app.cancellation_status === 'requested' && (
                      <p className="text-xs text-amber-700 font-medium">
                        Cancellation requested by employee
                      </p>
                    )}
                    {app.status === 'approved' && app.cancellation_status === 'none' && app.cancellation_decision_reason && (
                      <p className="text-xs text-rust font-medium">
                        Cancellation declined: {app.cancellation_decision_reason}
                      </p>
                    )}
                    {app.status === 'cancelled' && app.cancellation_decision_reason && (
                      <p className="text-xs text-ink-soft">
                        Cancelled reason: {app.cancellation_decision_reason}
                      </p>
                    )}
                    {app.status === 'rejected' && app.remarks && (
                      <p className="text-xs text-rust font-medium">
                        Reason: {app.remarks}
                      </p>
                    )}

                    {/* Mobile Action Buttons */}
                    <div className="flex items-center justify-end gap-2 pt-1">
                      {app.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(app.id)}
                            className="rounded-lg bg-pine px-3 py-1.5 text-xs font-medium text-white transition hover:bg-pine-deep"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => openRejectDialog([app.id])}
                            className="rounded-lg border border-rust/30 bg-rust-soft px-3 py-1.5 text-xs font-medium text-rust transition hover:bg-rust/20"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {app.status === 'approved' && app.cancellation_status === 'requested' && (
                        <>
                          <button
                            onClick={() => handleConfirmCancellation(app.id)}
                            className="rounded-lg bg-pine px-3 py-1.5 text-xs font-medium text-white transition hover:bg-pine-deep"
                          >
                            Confirm Cancel
                          </button>
                          <button
                            onClick={() => openDeclineCancelDialog(app.id)}
                            className="rounded-lg border border-rust/30 bg-rust-soft px-3 py-1.5 text-xs font-medium text-rust transition hover:bg-rust/20"
                          >
                            Keep Leave
                          </button>
                        </>
                      )}

                      {app.status === 'approved' && app.cancellation_status !== 'requested' && (
                        <button
                          onClick={() => openManagerCancelDialog(app.id)}
                          className="rounded-lg border border-line bg-paper px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-rust-soft hover:text-rust"
                        >
                          Cancel Leave
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer Pagination matching dashboard exactly */}
          <div className="flex items-center justify-between border-t border-line px-5 py-3.5">
            <span className="text-xs sm:text-sm text-ink-soft">
              {filteredApplications.length === 0
                ? 'Showing 0 of 0 requests'
                : `Showing ${paginatedApplications.length} of ${filteredApplications.length} requests`}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safeCurrentPage <= 1}
                aria-label="Previous page"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-ink-soft transition hover:bg-paper hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface disabled:hover:text-ink-soft"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage >= totalPages}
                aria-label="Next page"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-ink-soft transition hover:bg-paper hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface disabled:hover:text-ink-soft"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Record leave modal ── */}
      {recordOpen && approverId && (
        <RecordLeaveModal
          approverId={approverId}
          onClose={() => setRecordOpen(false)}
          onSaved={(name) => {
            setRecordOpen(false)
            setNotice(`Leave recorded for ${name} (approved).`)
            loadData()
          }}
        />
      )}

      {/* ── Manager cancels an approved leave directly (any date) ── */}
      {managerCancelId && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => !managerCancelBusy && setManagerCancelId(null)}>
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-lg font-semibold text-ink">Cancel this approved leave?</h2>
            <p className="mt-1 text-sm text-ink-soft">
              The days used will be returned to the employee&apos;s balance. This works even if the leave already started or is in the past.
            </p>
            <textarea
              rows={3}
              maxLength={300}
              value={managerCancelReason}
              onChange={(e) => setManagerCancelReason(e.target.value)}
              placeholder="Reason (optional)"
              className="field-input mt-3"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                disabled={managerCancelBusy}
                onClick={() => setManagerCancelId(null)}
                className="rounded-lg bg-paper px-3 py-1.5 text-sm font-medium text-ink-soft ring-1 ring-line disabled:opacity-40"
              >
                Never mind
              </button>
              <button
                disabled={managerCancelBusy}
                onClick={confirmManagerCancel}
                className="rounded-lg bg-rust px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
              >
                {managerCancelBusy ? 'Cancelling...' : 'Cancel this leave'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Decline a cancellation request ── */}
      {declineCancelId && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => !declineCancelBusy && setDeclineCancelId(null)}>
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-lg font-semibold text-ink">Keep this leave as approved?</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Give a reason. The employee will see it and the leave stays approved.
            </p>
            <textarea
              autoFocus
              rows={3}
              maxLength={300}
              value={declineCancelReason}
              onChange={(e) => setDeclineCancelReason(e.target.value)}
              placeholder="e.g. Too many staff on leave that week already"
              className="field-input mt-3"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                disabled={declineCancelBusy}
                onClick={() => setDeclineCancelId(null)}
                className="rounded-lg bg-paper px-3 py-1.5 text-sm font-medium text-ink-soft ring-1 ring-line disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                disabled={declineCancelBusy || !declineCancelReason.trim()}
                onClick={confirmDeclineCancel}
                className="rounded-lg bg-rust px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
              >
                {declineCancelBusy ? 'Saving...' : 'Keep leave, decline cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject reason dialog ── */}
      {rejectIds && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => !rejectBusy && setRejectIds(null)}>
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-lg font-semibold text-ink">
              Reject {rejectIds.length > 1 ? `${rejectIds.length} applications` : 'application'}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              Please give a reason. The employee will see it on their dashboard.
            </p>
            <textarea
              autoFocus
              rows={3}
              maxLength={300}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Too many staff on leave that week"
              className="field-input mt-3"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                disabled={rejectBusy}
                onClick={() => setRejectIds(null)}
                className="rounded-lg bg-paper px-3 py-1.5 text-sm font-medium text-ink-soft ring-1 ring-line disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                disabled={rejectBusy || !rejectReason.trim()}
                onClick={confirmReject}
                className="rounded-lg bg-rust px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
              >
                {rejectBusy ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ManagerShell>
  )
}
