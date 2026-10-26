'use client'

import MobileApprove from '@/components/manager/MobileApprove'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import ManagerShell from '@/components/ManagerShell'
import PageHeader, { PrimaryButton } from '@/components/PageHeader'
import { Avatar, UnderlineTabs } from '@/components/employee/EmployeeShell'
import { useLang, leaveTypeName, type Lang } from '@/lib/lang'
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

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// 日期:中文用 2026-10-26 至 2026-10-28(后台表格里最好扫读),英文保持原来的写法
function formatLeaveDates(startDate: string, endDate: string, lang: Lang) {
  if (!startDate) return ''
  if (lang === 'zh') return startDate === endDate ? startDate : `${startDate} 至 ${endDate}`
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  const startMonth = start.toLocaleDateString('en-US', { month: 'short' })
  const startDay = start.getDate()
  const startYear = start.getFullYear()
  if (startDate === endDate) return `${startMonth} ${startDay}, ${startYear}`
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' })
  const endDay = end.getDate()
  const endYear = end.getFullYear()
  if (startYear === endYear) {
    if (startMonth === endMonth) return `${startMonth} ${startDay} – ${endDay}, ${startYear}`
    return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${startYear}`
  }
  return `${startMonth} ${startDay}, ${startYear} – ${endMonth} ${endDay}, ${endYear}`
}

// 状态:钉钉/Ant 的 Badge 写法 —— 一个小圆点 + 彩色文字,不加底色和边框
function StatusBadge({ status, cancellationStatus }: { status: string; cancellationStatus?: string }) {
  const { t } = useLang()
  let dot = 'bg-ink-faint'
  let text = 'text-ink-soft'
  let label: string = status
  let pulse = false
  if (status === 'approved' && cancellationStatus === 'requested') {
    dot = 'bg-st-pending'; text = 'text-st-pending-text'; label = t('sCancelReq'); pulse = true
  } else if (status === 'approved') {
    dot = 'bg-st-approved'; text = 'text-st-approved-text'; label = t('sApproved')
  } else if (status === 'pending') {
    dot = 'bg-st-pending'; text = 'text-st-pending-text'; label = t('sPending')
  } else if (status === 'rejected') {
    dot = 'bg-st-rejected'; text = 'text-st-rejected-text'; label = t('sRejected')
  } else if (status === 'cancelled') {
    label = t('sCancelled')
  }
  return (
    <span className={`inline-flex items-center gap-1.5 text-[13px] ${text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot} ${pulse ? 'animate-pulse' : ''}`} />
      {label}
    </span>
  )
}

// 分页页码:当前页前后各 1 页,首尾页固定显示,中间用省略号
function pageList(total: number, cur: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const out: (number | '…')[] = [1]
  const from = Math.max(2, cur - 1)
  const to = Math.min(total - 1, cur + 1)
  if (from > 2) out.push('…')
  for (let i = from; i <= to; i++) out.push(i)
  if (to < total - 1) out.push('…')
  out.push(total)
  return out
}

// ─────────────────────────────────────────────────────────────────────────────

function DesktopApprove() {
  const auth = useEmployee({ requireManager: true })
  const { lang, t } = useLang()
  const zh = lang === 'zh'
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

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

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

  const tabCount = (k: string) => applications.filter((a) => a.status === k).length
  const dayWord = (n: number) => (zh ? `${n} 天` : `${n} ${n === 1 ? 'day' : 'days'}`)
  const pagerBtn = 'flex h-8 min-w-[32px] items-center justify-center rounded-md border px-2 text-[13px] transition-colors'

  return (
    <ManagerShell pendingCount={pendingCount}>
      <div className="mx-auto max-w-[1360px] space-y-4 pb-12">
        <PageHeader
          title={t('apprTitle')}
          subtitle={t('apprSub')}
          actions={
            <PrimaryButton onClick={() => { setNotice(''); setRecordOpen(true) }}>
              <PlusIcon className="h-3.5 w-3.5" />
              {t('recordForEmployee')}
            </PrimaryButton>
          }
        />

        {notice && <p className="rounded-md border border-st-approved/25 bg-st-approved-soft px-4 py-2.5 text-[13px] text-st-approved-text">{notice}</p>}
        {actionError && <p className="rounded-md border border-rust/30 bg-rust-soft px-4 py-2.5 text-[13px] text-rust">{actionError}</p>}

        <div className="overflow-hidden rounded-lg border border-line bg-white">
          {/* 状态标签页(钉钉审批:下划线标签 + 数字) */}
          <div className="border-b border-line px-3">
            <UnderlineTabs
              scroll
              value={filter}
              onChange={(k) => { setFilter(k); setCurrentPage(1) }}
              items={[
                { key: 'pending' as const, label: t('sPending'), count: pendingCount },
                { key: 'all' as const, label: t('all') },
                { key: 'approved' as const, label: t('sApproved') },
                { key: 'rejected' as const, label: t('sRejected') },
                { key: 'cancelled' as const, label: t('sCancelled') },
              ]}
            />
          </div>

          {/* 筛选条 */}
          <div className="flex flex-wrap items-center gap-3 px-5 py-3">
            <select
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
              className="h-8 w-52 rounded-md border border-line bg-white px-2.5 text-[13px] text-ink transition-colors hover:border-pine focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/15"
            >
              <option value="">{t('allEmployees')}</option>
              {employeeOptions.map((emp) => (
                <option key={emp.id} value={emp.full_name}>{emp.full_name}</option>
              ))}
            </select>
            {search && (
              <button type="button" onClick={() => { setSearch(''); setCurrentPage(1) }} className="text-[13px] text-pine hover:text-pine-deep">
                {zh ? '重置' : 'Reset'}
              </button>
            )}
            <span className="ml-auto text-[13px] text-ink-faint">
              {zh ? `共 ${filteredApplications.length} 条` : `${filteredApplications.length} total`}
            </span>
          </div>

          {/* 批量操作条:选中后出现 */}
          {filter === 'pending' && selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-y border-pine/15 bg-pine-soft px-5 py-2">
              <span className="text-[13px] text-ink">
                {zh ? <>已选择 <b className="font-semibold text-pine">{selected.size}</b> 项</> : <><b className="font-semibold text-pine">{selected.size}</b> selected</>}
              </span>
              <div className="ml-auto flex gap-2">
                <button
                  disabled={batchBusy}
                  onClick={handleBatchApprove}
                  className="h-7 rounded-md bg-pine px-3 text-[13px] font-medium text-white transition-colors hover:bg-pine-deep disabled:opacity-40"
                >
                  {zh ? '批量同意' : 'Approve selected'}
                </button>
                <button
                  disabled={batchBusy}
                  onClick={() => openRejectDialog(Array.from(selected))}
                  className="h-7 rounded-md border border-rust/40 bg-white px-3 text-[13px] font-medium text-rust transition-colors hover:bg-rust-soft disabled:opacity-40"
                >
                  {zh ? '批量拒绝' : 'Reject selected'}
                </button>
              </div>
            </div>
          )}

          {/* 表格 */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-y border-line bg-[#FAFAFA] text-[13px] font-medium text-ink-soft">
                  {filter === 'pending' && (
                    <th className="w-12 py-2.5 pl-5 pr-2">
                      <input
                        type="checkbox"
                        checked={selected.size === paginatedApplications.length && paginatedApplications.length > 0}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-line text-pine focus:ring-pine"
                      />
                    </th>
                  )}
                  <th className={`py-2.5 pr-4 ${filter === 'pending' ? 'pl-2' : 'pl-5'}`}>{t('colEmployee')}</th>
                  <th className="px-4 py-2.5">{t('leaveType')}</th>
                  <th className="px-4 py-2.5">{t('dates')}</th>
                  <th className="px-4 py-2.5">{t('duration')}</th>
                  <th className="px-4 py-2.5">{t('colStatus')}</th>
                  <th className="py-2.5 pl-4 pr-5 text-right">{t('colAction')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {paginatedApplications.length === 0 ? (
                  <tr>
                    <td colSpan={filter === 'pending' ? 7 : 6} className="py-16 text-center text-[13px] text-ink-faint">
                      {applications.length === 0
                        ? t('noRequests')
                        : search
                          ? (zh ? `${search} 没有这类申请` : `No ${filter} requests from ${search}`)
                          : t('noRequests')}
                    </td>
                  </tr>
                ) : (
                  paginatedApplications.map((app) => {
                    const empName = app.employees?.full_name || (zh ? '员工' : 'Employee')
                    const empNo = app.employees?.employee_no
                    const isCancelReq = app.status === 'approved' && app.cancellation_status === 'requested'
                    return (
                      <tr key={app.id} className="align-top transition-colors hover:bg-[#FAFAFA]">
                        {filter === 'pending' && (
                          <td className="py-3.5 pl-5 pr-2">
                            <input
                              type="checkbox"
                              checked={selected.has(app.id)}
                              onChange={() => toggleSelected(app.id)}
                              className="mt-1.5 h-4 w-4 rounded border-line text-pine focus:ring-pine"
                            />
                          </td>
                        )}

                        {/* 员工 */}
                        <td className={`py-3.5 pr-4 ${filter === 'pending' ? 'pl-2' : 'pl-5'}`}>
                          <div className="flex items-center gap-2.5">
                            <Avatar name={empName} size={32} />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-ink">{empName}</p>
                              {!!empNo && <p className="text-xs text-ink-faint">{zh ? `工号 ${empNo}` : `#${empNo}`}</p>}
                            </div>
                          </div>
                        </td>

                        {/* 假种 */}
                        <td className="max-w-[260px] px-4 py-3.5">
                          <p className="text-sm text-ink">
                            {leaveTypeName(app.leave_type, lang)}
                            {app.is_half_day && app.half_day_period && (
                              <span className="ml-1.5 rounded bg-paper px-1.5 py-0.5 text-xs text-ink-soft">
                                {t('halfDay')} · {app.half_day_period === 'am' ? t('am') : t('pm')}
                              </span>
                            )}
                          </p>
                          {app.reason && (
                            <p className="mt-0.5 line-clamp-1 text-xs text-ink-faint" title={app.reason}>
                              {t('note')}:{app.reason}
                            </p>
                          )}
                          {app.mc_attachment_path && (
                            <button
                              onClick={() => handleViewMc(app.mc_attachment_path as string)}
                              className="mt-0.5 text-xs text-pine hover:text-pine-deep"
                            >
                              {t('viewMc')}
                            </button>
                          )}
                        </td>

                        {/* 日期 */}
                        <td className="whitespace-nowrap px-4 py-3.5 text-sm tabular-nums text-ink">
                          {formatLeaveDates(app.start_date, app.end_date, lang)}
                        </td>

                        {/* 时长 */}
                        <td className="whitespace-nowrap px-4 py-3.5 text-sm tabular-nums text-ink">
                          {dayWord(app.total_days)}
                        </td>

                        {/* 状态 */}
                        <td className="whitespace-nowrap px-4 py-3.5">
                          <StatusBadge status={app.status} cancellationStatus={app.cancellation_status} />
                          {isCancelReq && app.cancellation_requested_at && (
                            <p className="mt-0.5 text-xs text-ink-faint">
                              {zh ? '申请于 ' : 'Requested '}
                              {new Date(app.cancellation_requested_at).toLocaleDateString(zh ? 'zh-CN' : 'en-MY')}
                            </p>
                          )}
                          {app.status === 'approved' && app.cancellation_status === 'none' && app.cancellation_decision_reason && (
                            <p className="mt-0.5 max-w-[200px] text-xs text-rust">
                              {t('cancelDeclined')}:{app.cancellation_decision_reason}
                            </p>
                          )}
                          {app.status === 'cancelled' && app.cancellation_decision_reason && (
                            <p className="mt-0.5 max-w-[200px] text-xs text-ink-faint">
                              {t('cancelReason')}:{app.cancellation_decision_reason}
                            </p>
                          )}
                          {app.status === 'rejected' && app.remarks && (
                            <p className="mt-0.5 max-w-[200px] text-xs text-rust">
                              {t('rejectReason')}:{app.remarks}
                            </p>
                          )}
                        </td>

                        {/* 操作:钉钉后台的文字链接 */}
                        <td className="whitespace-nowrap py-3.5 pl-4 pr-5 text-right">
                          <div className="inline-flex items-center gap-4 text-[13px]">
                            {app.status === 'pending' && (
                              <>
                                <button onClick={() => handleApprove(app.id)} className="text-pine transition-colors hover:text-pine-deep">{t('aApprove')}</button>
                                <button onClick={() => openRejectDialog([app.id])} className="text-rust transition-opacity hover:opacity-70">{t('aReject')}</button>
                              </>
                            )}
                            {isCancelReq && (
                              <>
                                <button onClick={() => handleConfirmCancellation(app.id)} className="text-pine transition-colors hover:text-pine-deep">{t('aConfirmCancel')}</button>
                                <button onClick={() => openDeclineCancelDialog(app.id)} className="text-rust transition-opacity hover:opacity-70">{t('aKeepLeave')}</button>
                              </>
                            )}
                            {app.status === 'approved' && app.cancellation_status !== 'requested' && (
                              <button onClick={() => openManagerCancelDialog(app.id)} className="text-ink-soft transition-colors hover:text-rust">{t('aCancelLeave')}</button>
                            )}
                            {(app.status === 'rejected' || app.status === 'cancelled') && <span className="text-ink-faint">–</span>}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 分页(Ant 风格:共 N 条 + 页码) */}
          <div className="flex items-center justify-between border-t border-line px-5 py-3">
            <span className="text-[13px] text-ink-soft">
              {zh ? `共 ${filteredApplications.length} 条,每页 ${pageSize} 条` : `${filteredApplications.length} requests · ${pageSize} per page`}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safeCurrentPage <= 1}
                aria-label={t('prevPage')}
                className={`${pagerBtn} border-line bg-white text-ink-soft hover:border-pine hover:text-pine disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink-soft`}
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
              {pageList(totalPages, safeCurrentPage).map((n, i) =>
                n === '…' ? (
                  <span key={`e${i}`} className="px-1 text-ink-faint">…</span>
                ) : (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCurrentPage(n)}
                    aria-current={n === safeCurrentPage ? 'page' : undefined}
                    className={`${pagerBtn} ${n === safeCurrentPage ? 'border-pine text-pine' : 'border-transparent text-ink hover:text-pine'}`}
                  >
                    {n}
                  </button>
                ),
              )}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage >= totalPages}
                aria-label={t('nextPage')}
                className={`${pagerBtn} border-line bg-white text-ink-soft hover:border-pine hover:text-pine disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink-soft`}
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
            setNotice(zh ? `已为 ${name} 补录请假(已批准)。` : `Leave recorded for ${name} (approved).`)
            loadData()
          }}
        />
      )}

      {/* ── Manager cancels an approved leave directly (any date) ── */}
      {managerCancelId && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => !managerCancelBusy && setManagerCancelId(null)}>
          <div className="w-full max-w-md rounded-lg border border-line bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-ink">{zh ? '取消这条已批准的假?' : 'Cancel this approved leave?'}</h2>
            <p className="mt-1 text-sm text-ink-soft">
              {zh ? '扣除的天数会退回员工的余额。即使假期已经开始或已是过去的日期,也可以取消。' : "The days used will be returned to the employee's balance. This works even if the leave already started or is in the past."}
            </p>
            <textarea
              rows={3}
              maxLength={300}
              value={managerCancelReason}
              onChange={(e) => setManagerCancelReason(e.target.value)}
              placeholder={zh ? '原因(选填)' : 'Reason (optional)'}
              className="field-input mt-3"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                disabled={managerCancelBusy}
                onClick={() => setManagerCancelId(null)}
                className="rounded-lg bg-paper px-3 py-1.5 text-sm font-medium text-ink-soft ring-1 ring-line disabled:opacity-40"
              >
                {zh ? '再想想' : 'Never mind'}
              </button>
              <button
                disabled={managerCancelBusy}
                onClick={confirmManagerCancel}
                className="rounded-lg bg-rust px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
              >
                {managerCancelBusy ? (zh ? '取消中...' : 'Cancelling...') : t('aCancelLeave')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Decline a cancellation request ── */}
      {declineCancelId && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => !declineCancelBusy && setDeclineCancelId(null)}>
          <div className="w-full max-w-md rounded-lg border border-line bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-ink">{zh ? '保留这条假期?' : 'Keep this leave as approved?'}</h2>
            <p className="mt-1 text-sm text-ink-soft">
              {zh ? '请填写理由,员工会看到,假期仍保持已批准。' : 'Give a reason. The employee will see it and the leave stays approved.'}
            </p>
            <textarea
              autoFocus
              rows={3}
              maxLength={300}
              value={declineCancelReason}
              onChange={(e) => setDeclineCancelReason(e.target.value)}
              placeholder={zh ? '例如:那一周已经有太多同事休假' : 'e.g. Too many staff on leave that week already'}
              className="field-input mt-3"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                disabled={declineCancelBusy}
                onClick={() => setDeclineCancelId(null)}
                className="rounded-lg bg-paper px-3 py-1.5 text-sm font-medium text-ink-soft ring-1 ring-line disabled:opacity-40"
              >
                {t('cancel')}
              </button>
              <button
                disabled={declineCancelBusy || !declineCancelReason.trim()}
                onClick={confirmDeclineCancel}
                className="rounded-lg bg-rust px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
              >
                {declineCancelBusy ? (zh ? '保存中...' : 'Saving...') : (zh ? '保留假期,拒绝取消' : 'Keep leave, decline cancellation')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject reason dialog ── */}
      {rejectIds && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => !rejectBusy && setRejectIds(null)}>
          <div className="w-full max-w-md rounded-lg border border-line bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-lg font-semibold text-ink">
              {zh ? (rejectIds.length > 1 ? `拒绝 ${rejectIds.length} 条申请` : '拒绝申请') : `Reject ${rejectIds.length > 1 ? `${rejectIds.length} applications` : 'application'}`}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              {zh ? '请填写拒绝理由,员工会在首页看到。' : 'Please give a reason. The employee will see it on their dashboard.'}
            </p>
            <textarea
              autoFocus
              rows={3}
              maxLength={300}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={zh ? '例如:那一周休假的人太多' : 'e.g. Too many staff on leave that week'}
              className="field-input mt-3"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                disabled={rejectBusy}
                onClick={() => setRejectIds(null)}
                className="rounded-lg bg-paper px-3 py-1.5 text-sm font-medium text-ink-soft ring-1 ring-line disabled:opacity-40"
              >
                {t('cancel')}
              </button>
              <button
                disabled={rejectBusy || !rejectReason.trim()}
                onClick={confirmReject}
                className="rounded-lg bg-rust px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
              >
                {rejectBusy ? (zh ? '处理中...' : 'Rejecting...') : t('aReject')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ManagerShell>
  )
}

// 手机/平板(< lg)用钉钉风格的手机版;电脑(≥ lg)用后台版。断点和 ManagerShell 一致。
export default function ApprovePage() {
  return (
    <>
      <div className="lg:hidden">
        <MobileApprove />
      </div>
      <div className="hidden lg:block">
        <DesktopApprove />
      </div>
    </>
  )
}
