'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { toLocalDateStr } from '@/lib/dateUtils'
import {
  getYearsOfService,
  getEntitlementForYear,
  daysInYear,
  DEFAULT_WORK_WEEK,
  LEAVE_TYPE_LABELS,
  type WorkWeek,
} from '@/lib/leaveRules'
import { loadWorkWeek } from '@/lib/settings'
import { useEmployee } from '@/lib/useEmployee'
import AuthStatus from '@/components/AuthStatus'
import { uploadMcFile, getMcSignedUrl, validateMcFile } from '@/lib/mcAttachments'

type Employee = {
  id: string
  employee_no: number | null
  full_name: string
  date_of_commencement: string
  employment_type: string
  annual_leave_carry_forward: number
  annual_leave_entitlement_override: number | null
}

type LeaveApplication = {
  id: string
  leave_type: string
  start_date: string
  end_date: string
  total_days: number
  status: string
  created_at: string
  is_half_day: boolean
  half_day_period: string | null
  remarks: string | null
  cancellation_status: string
  cancellation_decision_reason: string | null
  mc_attachment_path: string | null
  last_decision_at: string | null
}

type PublicHoliday = { holiday_date: string; name: string }

// ── Icons ────────────────────────────────────────────────────────────────────

function CalendarGridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
      <rect x="3" y="4" width="18" height="18" rx="3" strokeWidth={1.75} />
      <path d="M16 2v4M8 2v4M3 10h18" strokeWidth={1.75} strokeLinecap="round" />
      <circle cx="8" cy="14" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="14" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="14" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="8" cy="18" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="18" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="18" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  )
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
  )
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
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

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

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

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
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

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  )
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  if (!name) return 'U'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatLeaveDates(startDate: string, endDate: string, remarks?: string | null) {
  if (!startDate) return ''
  if (remarks && remarks.includes('Historical import')) {
    const start = new Date(startDate + 'T00:00:00')
    const month = start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    return `${month} (Imported)`
  }
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
  // If approved and cancellation has been requested by employee (matching manager's cancellations view)
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

export default function DashboardPage() {
  const router = useRouter()
  const auth = useEmployee()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [applications, setApplications] = useState<LeaveApplication[]>([])
  const [publicHolidays, setPublicHolidays] = useState<string[]>([])
  const [workWeek, setWorkWeek] = useState<WorkWeek>(DEFAULT_WORK_WEEK)
  const [upcomingHolidays, setUpcomingHolidays] = useState<PublicHoliday[]>([])
  // 今年已用天数(按落在今年内的天数算,跨年的假只算今年那一段)
  const [taken, setTaken] = useState<Record<string, number>>({})
  const [loadError, setLoadError] = useState('')

  // Filter & pagination state with Cancelled status added
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'cancelled'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const pageSize = 5

  // User profile menu state (matching manage)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement | null>(null)

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [leaveType, setLeaveType] = useState('annual')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isHalfDay, setIsHalfDay] = useState(false)
  const [halfDayPeriod, setHalfDayPeriod] = useState<'am' | 'pm'>('am')
  const [reason, setReason] = useState('')
  const [mcFile, setMcFile] = useState<File | null>(null)
  const [mcFileError, setMcFileError] = useState('')
  // 补传 MC:记住要补传给哪一笔申请,再触发隐藏的文件选择框
  const [attachTargetId, setAttachTargetId] = useState<string | null>(null)
  const [attachingId, setAttachingId] = useState<string | null>(null)
  const attachMcInputRef = useRef<HTMLInputElement | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  // Toast
  const [toast, setToast] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 3500)
  }

  useEffect(() => {
    if (auth.status === 'ready') loadData(auth.employee)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status])

  // "有更新"横幅:比对每笔申请最近一次被决定的时间,跟自己上次看过通知的时间。
  // 看过之后(离开这个页面或手动关掉)就去跟服务器说一声,下次就不会再提醒同一批。
  const seenAt = auth.status === 'ready' ? auth.employee.last_notifications_seen_at : null
  const unseenCount = applications.filter(
    (a) => a.last_decision_at && (!seenAt || a.last_decision_at > seenAt)
  ).length
  const [noticeDismissed, setNoticeDismissed] = useState(false)

  useEffect(() => {
    if (auth.status !== 'ready' || unseenCount === 0 || noticeDismissed) return
    const timer = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch('/api/notifications/seen', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      }).catch(() => { })
    }, 4000) // 横幅至少留着给他们看个几秒,不是一进来就立刻消失
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status, unseenCount])

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
      setActiveMenuId(null)
    }
    if (activeMenuId || userMenuOpen) {
      window.addEventListener('click', handleClickOutside)
      return () => window.removeEventListener('click', handleClickOutside)
    }
  }, [activeMenuId, userMenuOpen])

  async function loadData(emp: Employee) {
    setEmployee(emp)
    setLoadError('')

    const today = toLocalDateStr(new Date())

    const { data: holidays, error: holidayError } = await supabase
      .from('public_holidays')
      .select('holiday_date, name')
      .eq('is_enabled', true)
      .order('holiday_date', { ascending: true })
    if (holidayError) { setLoadError('Could not load public holidays.'); return }

    const holidayDates = (holidays || []).map((h) => h.holiday_date)
    setPublicHolidays(holidayDates)
    setUpcomingHolidays((holidays || []).filter((h) => h.holiday_date >= today).slice(0, 5))

    const ww = await loadWorkWeek()
    setWorkWeek(ww)

    // 取"和今年有重叠"的申请(包含从去年底跨到今年、或从今年跨到明年的假)
    const currentYear = new Date().getFullYear()
    const { data: apps, error: appsError } = await supabase
      .from('leave_applications')
      .select('id, leave_type, start_date, end_date, total_days, status, created_at, is_half_day, half_day_period, remarks, cancellation_status, cancellation_decision_reason, mc_attachment_path, last_decision_at')
      .eq('employee_id', emp.id)
      .lte('start_date', `${currentYear}-12-31`)
      .gte('end_date', `${currentYear}-01-01`)
      .order('created_at', { ascending: false })
    if (appsError) { setLoadError('Could not load your applications.'); return }

    setApplications(apps || [])
    const sums: Record<string, number> = {}
    for (const a of apps || []) {
      if (a.status !== 'approved' && a.status !== 'pending') continue
      const startYear = Number(a.start_date.slice(0, 4))
      const endYear   = Number(a.end_date.slice(0, 4))
      // If the leave is entirely within the current year, trust the stored
      // total_days value (avoids recalculating from placeholder import dates).
      // Only recalculate when a leave spans across year boundaries.
      const days = (startYear === currentYear && endYear === currentYear)
        ? Number(a.total_days)
        : daysInYear(a, currentYear, holidayDates, ww)
      sums[a.leave_type] = (sums[a.leave_type] || 0) + days
    }
    setTaken(sums)
  }

  function reload() {
    if (auth.status === 'ready') return loadData(auth.employee)
  }

  // 额度够不够、日期有没有重叠,这些真正的检查都在服务器端的
  // /api/leave-applications 里做(见该文件顶部注释)。这里只做"填了没有"
  // 这类最基本的输入检查,省一次没必要的网络来回。
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!employee) return
    setSubmitting(true)
    setFormError('')

    const actualEndDate = isHalfDay ? startDate : endDate
    if (!startDate || !actualEndDate) {
      setFormError('Please choose the leave dates.')
      setSubmitting(false)
      return
    }
    if (actualEndDate < startDate) {
      setFormError('End date cannot be before start date.')
      setSubmitting(false)
      return
    }

    // 病假如果选了附件,先传去 Storage,拿到路径再一起送去 API
    let mcAttachmentPath: string | undefined
    if (leaveType === 'medical' && mcFile) {
      const { path, error: uploadError } = await uploadMcFile(employee.id, mcFile)
      if (uploadError) {
        setFormError(uploadError)
        setSubmitting(false)
        return
      }
      mcAttachmentPath = path || undefined
    }

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/leave-applications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        leave_type: leaveType,
        start_date: startDate,
        end_date: actualEndDate,
        is_half_day: isHalfDay,
        half_day_period: isHalfDay ? halfDayPeriod : null,
        reason,
        mcAttachmentPath,
      }),
    })
    const result = await res.json().catch(() => ({}))
    setSubmitting(false)

    if (!res.ok) {
      setFormError(result.error || 'Failed to submit. Please try again.')
      return
    }
    setModalOpen(false)
    setStartDate(''); setEndDate(''); setReason(''); setIsHalfDay(false); setLeaveType('annual')
    setMcFile(null); setMcFileError('')
    showToast('Leave request submitted — pending approval.')
    reload()
  }

  async function handleViewMc(path: string) {
    const url = await getMcSignedUrl(path)
    if (!url) { showToast('Could not open the attachment. Please try again.'); return }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  // 申请时没附 MC:之后回来补传,直接挂到原本那一笔申请上,不用重新登记一次。
  function handleAttachMcClick(id: string) {
    setAttachTargetId(id)
    attachMcInputRef.current?.click()
  }

  async function handleAttachMcFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null
    const targetId = attachTargetId
    e.target.value = ''
    if (!file || !targetId || !employee) return

    const err = validateMcFile(file)
    if (err) { showToast(err); return }

    setAttachingId(targetId)
    const { path, error: uploadError } = await uploadMcFile(employee.id, file)
    if (uploadError) {
      setAttachingId(null)
      showToast(uploadError)
      return
    }
    const { error } = await supabase
      .from('leave_applications')
      .update({ mc_attachment_path: path })
      .eq('id', targetId)
    setAttachingId(null)
    if (error) { showToast('Could not attach the MC. Please try again.'); return }
    showToast('MC attached.')
    reload()
  }

  // 待审批的假:员工可以直接取消
  async function handleCancel(id: string) {
    const confirmed = window.confirm('Cancel this leave application?')
    if (!confirmed) return
    const { error } = await supabase.from('leave_applications').update({ status: 'cancelled' }).eq('id', id)
    if (error) { showToast('Could not cancel. Please try again.'); return }
    reload()
  }

  // 已批准、还没开始的假:发起取消申请
  async function handleRequestCancellation(id: string) {
    const confirmed = window.confirm('Request cancellation of this approved leave? Your manager will need to confirm before it is cancelled.')
    if (!confirmed) return
    const { error } = await supabase
      .from('leave_applications')
      .update({ cancellation_status: 'requested', cancellation_requested_at: new Date().toISOString(), cancellation_decision_reason: null })
      .eq('id', id)
    if (error) { showToast('Could not send the cancellation request. Please try again.'); return }
    // 通知负责人(失败也没关系,申请本身已经成功了)
    const { data: { session } } = await supabase.auth.getSession()
    fetch('/api/notifications/cancellation-requested', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ id }),
    }).catch(() => { })
    reload()
  }

  // 员工反悔,把取消申请撤回
  async function handleWithdrawCancellation(id: string) {
    const { error } = await supabase
      .from('leave_applications')
      .update({ cancellation_status: 'none' })
      .eq('id', id)
    if (error) { showToast('Could not withdraw the cancellation request. Please try again.'); return }
    reload()
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (auth.status !== 'ready') return <AuthStatus state={auth} />
  if (!employee) return <div className="p-8 text-center text-ink-soft">Loading...</div>

  const years = getYearsOfService(employee.date_of_commencement)
  const thisYear = new Date().getFullYear()
  const today = toLocalDateStr(new Date())
  const initials = getInitials(employee.full_name)

  // ── Stat cards: Keep original 4 leave types (Annual, Medical, Maternity, Paternity)
  // Wording formatted as "18 days of 25 days this year" (no more "entitled")
  const statCards = (
    [
      { type: 'annual', label: 'Annual Leave', Icon: CalendarGridIcon, accent: 'text-pine bg-pine-soft' },
      { type: 'medical', label: 'Medical Leave', Icon: HeartIcon, accent: 'text-rust bg-rust-soft' },
      { type: 'maternity', label: 'Maternity Leave', Icon: SparkleIcon, accent: 'text-emerald-700 bg-emerald-50' },
      { type: 'paternity', label: 'Paternity Leave', Icon: UserIcon, accent: 'text-amber-700 bg-amber-50' },
    ] as const
  ).map(({ type, label, Icon, accent }) => {
    const base = getEntitlementForYear(employee, type, thisYear) ?? 0
    const total = type === 'annual' ? base + (Number(employee.annual_leave_carry_forward) || 0) : base
    const remaining = Math.max(0, total - (taken[type] || 0))
    const formattedRemaining =
      remaining.toFixed(0) === remaining.toFixed(1)
        ? remaining.toFixed(0)
        : remaining.toFixed(1)
    return { label, remaining: formattedRemaining, total, Icon, accent }
  })

  // ── Filtered & Paginated Applications ───────────────────────────────────────
  // Includes separate tabs: All, Pending, Approved, Rejected, and Cancelled
  const filteredApps = applications.filter((app) => {
    if (filterTab === 'pending') return app.status === 'pending'
    if (filterTab === 'approved') return app.status === 'approved' && app.cancellation_status !== 'requested'
    if (filterTab === 'rejected') return app.status === 'rejected'
    if (filterTab === 'cancelled') return app.status === 'cancelled' || app.cancellation_status === 'requested'
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filteredApps.length / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * pageSize
  const paginatedApps = filteredApps.slice(startIndex, startIndex + pageSize)

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 space-y-7 pb-16">

      {/* ── "You have updates" banner ── */}
      {unseenCount > 0 && !noticeDismissed && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-gold/40 bg-gold-soft px-4 py-3 text-sm text-gold">
          <span>
            You have {unseenCount} update{unseenCount > 1 ? 's' : ''} on your leave application{unseenCount > 1 ? 's' : ''} below.
          </span>
          <button
            onClick={() => setNoticeDismissed(true)}
            className="shrink-0 text-xs font-medium underline decoration-dotted hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Top Bar with Manage-style User Profile ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Puro" width={44} height={44} className="h-11 w-11 shrink-0 rounded-xl" />
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
              Hi, {employee.full_name.split(' ')[0]} 👋
            </h1>
            <p className="mt-0.5 text-sm text-ink-soft">
              {employee.employee_no ? `#${employee.employee_no} · ` : ''}
              {years.toFixed(1)} years of service
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={() => { setModalOpen(true); setFormError('') }}
            className="inline-flex items-center gap-2 rounded-xl bg-pine px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-pine-deep focus:outline-none focus:ring-2 focus:ring-pine/30"
          >
            <PlusIcon className="h-4 w-4" />
            Request Leave
          </button>

          {/* User Profile matching ManagerShell style */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setUserMenuOpen((v) => !v)
              }}
              className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2 shadow-sm transition hover:bg-paper focus:outline-none"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pine/20 text-xs font-bold text-pine">
                {initials}
              </div>
              <span className="text-sm font-medium text-ink">
                {employee.full_name}
              </span>
              <ChevronDownIcon className="h-4 w-4 text-ink-faint ml-0.5" />
            </button>

            {/* Dropdown menu matching ManagerShell sidebar account section */}
            {userMenuOpen && (
              <div
                className="absolute right-0 z-30 mt-2 w-64 rounded-2xl border border-line bg-surface p-2 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-1 flex flex-col gap-0.5">
                  <button
                    onClick={() => { setUserMenuOpen(false); router.push('/change-password') }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink-soft transition-colors hover:bg-paper hover:text-ink"
                  >
                    <KeyIcon className="h-4 w-4 text-ink-faint" />
                    Change Password
                  </button>
                  <button
                    onClick={() => { setUserMenuOpen(false); router.push('/notifications') }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink-soft transition-colors hover:bg-paper hover:text-ink"
                  >
                    <BellIcon className="h-4 w-4 text-ink-faint" />
                    Telegram Notifications
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink-soft transition-colors hover:bg-rust-soft hover:text-rust"
                  >
                    <LogoutIcon className="h-4 w-4 text-ink-faint" />
                    Log Out
                  </button>
                </div>

                {/* User Info Card matching manage */}
                <div className="flex items-center gap-3 rounded-xl border border-line bg-paper px-3 py-2.5 mt-1">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pine/20 text-xs font-bold text-pine">
                    {initials}
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="truncate text-sm font-medium text-ink">{employee.full_name}</p>
                    <p className="text-xs text-ink-faint capitalize">{employee.employment_type || 'Employee'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-rust/30 bg-rust-soft px-4 py-3 text-sm text-rust">
          {loadError}
        </div>
      )}

      {/* ── 4 Stat Cards (Annual, Medical, Maternity, Paternity) ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statCards.map(({ label, remaining, total, Icon, accent }) => (
          <div
            key={label}
            className="rounded-2xl border border-line bg-surface p-5 shadow-sm transition hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <span className="text-xs sm:text-sm font-medium text-ink-soft">{label}</span>
              <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${accent}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3.5 flex items-baseline">
              <span className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                {remaining}
              </span>
              <span className="ml-1.5 text-sm font-normal text-ink-soft">days</span>
            </div>
            <p className="mt-1 text-xs text-ink-soft">
              of {total} days this year
            </p>
          </div>
        ))}
      </div>

      {/* ── Upcoming Public Holidays ── */}
      {upcomingHolidays.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface shadow-sm overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-base font-semibold text-ink">Upcoming Public Holidays</h2>
            <p className="mt-0.5 text-xs text-ink-soft">Next {upcomingHolidays.length} upcoming holiday{upcomingHolidays.length > 1 ? 's' : ''}</p>
          </div>
          <div className="divide-y divide-line">
            {upcomingHolidays.map((h) => {
              const d = new Date(h.holiday_date + 'T00:00:00')
              const isToday = h.holiday_date === today
              return (
                <div key={h.holiday_date} className="flex items-center gap-3.5 px-5 py-3.5 transition hover:bg-paper/40">
                  <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl border border-line bg-paper">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                      {d.toLocaleDateString('en-MY', { month: 'short' })}
                    </span>
                    <span className="text-sm font-bold text-ink">{d.getDate()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{h.name}</p>
                    <p className="mt-0.5 text-xs text-ink-faint">
                      {d.toLocaleDateString('en-MY', { weekday: 'long' })}
                      {isToday && <span className="ml-2 font-semibold text-gold">· Today</span>}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Your leave requests (Design & Layout from reference) ── */}
      <div className="rounded-2xl border border-line bg-surface shadow-sm">
        {/* Card Header with Title and Segmented Status Tabs */}
        <div className="flex flex-col gap-4 border-b border-line p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">Your leave requests</h2>
            <p className="mt-0.5 text-xs sm:text-sm text-ink-soft">
              View the status of your time-off requests.
            </p>
          </div>

          {/* Filter Tabs including Cancelled matching manager architecture */}
          <div className="inline-flex flex-wrap self-start rounded-xl border border-line bg-paper p-1 gap-0.5">
            <button
              type="button"
              onClick={() => { setFilterTab('all'); setCurrentPage(1) }}
              className={`rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition ${filterTab === 'all'
                ? 'bg-surface text-ink font-semibold shadow-sm'
                : 'text-ink-soft hover:text-ink'
                }`}
            >
              All requests
            </button>
            <button
              type="button"
              onClick={() => { setFilterTab('pending'); setCurrentPage(1) }}
              className={`rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition ${filterTab === 'pending'
                ? 'bg-surface text-ink font-semibold shadow-sm'
                : 'text-ink-soft hover:text-ink'
                }`}
            >
              Pending
            </button>
            <button
              type="button"
              onClick={() => { setFilterTab('approved'); setCurrentPage(1) }}
              className={`rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition ${filterTab === 'approved'
                ? 'bg-surface text-ink font-semibold shadow-sm'
                : 'text-ink-soft hover:text-ink'
                }`}
            >
              Approved
            </button>
            <button
              type="button"
              onClick={() => { setFilterTab('rejected'); setCurrentPage(1) }}
              className={`rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition ${filterTab === 'rejected'
                ? 'bg-surface text-ink font-semibold shadow-sm'
                : 'text-ink-soft hover:text-ink'
                }`}
            >
              Rejected
            </button>
            <button
              type="button"
              onClick={() => { setFilterTab('cancelled'); setCurrentPage(1) }}
              className={`rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition ${filterTab === 'cancelled'
                ? 'bg-surface text-ink font-semibold shadow-sm'
                : 'text-ink-soft hover:text-ink'
                }`}
            >
              Cancelled
            </button>
          </div>
        </div>

        {/* Table View (Desktop & Tablet) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs font-semibold uppercase tracking-wider text-ink-soft">
                <th className="py-3.5 pl-6 pr-4">Employee</th>
                <th className="py-3.5 px-4">Leave type</th>
                <th className="py-3.5 px-4">Dates</th>
                <th className="py-3.5 px-4">Duration</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 pl-4 pr-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {paginatedApps.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-ink-faint">
                    No leave requests found in this category.
                  </td>
                </tr>
              ) : (
                paginatedApps.map((app) => {
                  const itemInitials = getInitials(employee.full_name)
                  const isUpcomingApproved =
                    app.status === 'approved' &&
                    app.cancellation_status === 'none' &&
                    app.start_date > today

                  return (
                    <tr key={app.id} className="transition hover:bg-paper/40">
                      {/* Employee */}
                      <td className="py-4 pl-6 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pine/20 font-bold text-xs text-pine">
                            {itemInitials}
                          </div>
                          <div>
                            <p className="font-medium text-ink">{employee.full_name}</p>
                            <p className="text-xs text-ink-faint">
                              {employee.employment_type || (employee.employee_no ? `#${employee.employee_no}` : 'Staff')}
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
                        {app.remarks && (
                          <p className="mt-0.5 line-clamp-1 text-xs text-ink-soft" title={app.remarks}>
                            Note: {app.remarks}
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
                        {!app.mc_attachment_path && app.leave_type === 'medical' && (app.status === 'pending' || app.status === 'approved') && (
                          <button
                            onClick={() => handleAttachMcClick(app.id)}
                            disabled={attachingId === app.id}
                            className="mt-0.5 block text-xs font-medium text-ink-soft underline decoration-dotted hover:text-ink disabled:opacity-50"
                          >
                            {attachingId === app.id ? 'Uploading...' : 'Attach MC'}
                          </button>
                        )}
                      </td>

                      {/* Dates */}
                      <td className="py-4 px-4 whitespace-nowrap text-sm text-ink-soft">
                        {formatLeaveDates(app.start_date, app.end_date, app.remarks)}
                      </td>

                      {/* Duration */}
                      <td className="py-4 px-4 whitespace-nowrap text-sm text-ink-soft">
                        {app.total_days} {app.total_days === 1 ? 'day' : 'days'}
                      </td>

                      {/* Status badge matching ManagerShell/Approve */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <StatusBadge
                          status={app.status}
                          cancellationStatus={app.cancellation_status}
                        />
                        {app.status === 'approved' && app.cancellation_status === 'requested' && (
                          <p className="mt-1 text-[11px] text-amber-700 font-medium">
                            Waiting for manager confirmation
                          </p>
                        )}
                        {app.status === 'approved' && app.cancellation_status === 'none' && app.cancellation_decision_reason && (
                          <p className="mt-1 text-[11px] text-rust font-medium">
                            Cancel declined: {app.cancellation_decision_reason}
                          </p>
                        )}
                        {app.status === 'cancelled' && app.cancellation_decision_reason && (
                          <p className="mt-1 text-[11px] text-ink-soft">
                            Cancelled reason: {app.cancellation_decision_reason}
                          </p>
                        )}
                        {app.status === 'rejected' && app.remarks && (
                          <p className="mt-1 text-[11px] text-rust font-medium">
                            Reason: {app.remarks}
                          </p>
                        )}
                      </td>

                      {/* Action menu */}
                      <td className="py-4 pl-4 pr-6 text-right relative">
                        <div className="inline-flex items-center justify-end gap-2">
                          {app.status === 'pending' && (
                            <button
                              onClick={() => handleCancel(app.id)}
                              className="rounded-lg border border-rust/30 bg-rust-soft px-2.5 py-1 text-xs font-medium text-rust transition hover:bg-rust/20"
                            >
                              Cancel
                            </button>
                          )}

                          {isUpcomingApproved && (
                            <button
                              onClick={() => handleRequestCancellation(app.id)}
                              className="rounded-lg border border-gold/40 bg-gold-soft px-2.5 py-1 text-xs font-medium text-gold transition hover:bg-gold/30"
                            >
                              Request cancel
                            </button>
                          )}

                          {app.status === 'approved' && app.cancellation_status === 'requested' && (
                            <button
                              onClick={() => handleWithdrawCancellation(app.id)}
                              className="rounded-lg border border-line bg-paper px-2.5 py-1 text-xs font-medium text-ink-soft transition hover:bg-line/40"
                            >
                              Withdraw
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
                                  <button
                                    onClick={() => { setActiveMenuId(null); handleCancel(app.id) }}
                                    className="flex w-full items-center px-4 py-2 text-xs font-medium text-rust hover:bg-rust-soft"
                                  >
                                    Cancel request
                                  </button>
                                )}
                                {isUpcomingApproved && (
                                  <button
                                    onClick={() => { setActiveMenuId(null); handleRequestCancellation(app.id) }}
                                    className="flex w-full items-center px-4 py-2 text-xs font-medium text-gold hover:bg-gold-soft"
                                  >
                                    Request cancellation
                                  </button>
                                )}
                                {app.status === 'approved' && app.cancellation_status === 'requested' && (
                                  <button
                                    onClick={() => { setActiveMenuId(null); handleWithdrawCancellation(app.id) }}
                                    className="flex w-full items-center px-4 py-2 text-xs font-medium text-ink-soft hover:bg-paper"
                                  >
                                    Withdraw cancellation
                                  </button>
                                )}
                                <div className="border-t border-line my-1" />
                                <div className="px-4 py-1.5 text-[11px] text-ink-faint">
                                  Submitted {new Date(app.created_at).toLocaleDateString('en-MY')}
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

        {/* Mobile Card List View (Dedicated mobile experience) */}
        <div className="md:hidden divide-y divide-line">
          {paginatedApps.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-faint">
              No leave requests found in this category.
            </p>
          ) : (
            paginatedApps.map((app) => {
              const itemInitials = getInitials(employee.full_name)
              const isUpcomingApproved =
                app.status === 'approved' &&
                app.cancellation_status === 'none' &&
                app.start_date > today

              return (
                <div key={app.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pine/20 font-bold text-xs text-pine">
                        {itemInitials}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-ink">{employee.full_name}</p>
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
                        {formatLeaveDates(app.start_date, app.end_date, app.remarks)}
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

                  {app.remarks && (
                    <p className="text-xs text-ink-soft">
                      <span className="text-ink-faint">Note:</span> {app.remarks}
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
                  {!app.mc_attachment_path && app.leave_type === 'medical' && (app.status === 'pending' || app.status === 'approved') && (
                    <button
                      onClick={() => handleAttachMcClick(app.id)}
                      disabled={attachingId === app.id}
                      className="block text-xs font-medium text-ink-soft underline decoration-dotted disabled:opacity-50"
                    >
                      {attachingId === app.id ? 'Uploading...' : 'Attach MC'}
                    </button>
                  )}

                  {app.status === 'approved' && app.cancellation_status === 'requested' && (
                    <p className="text-xs text-amber-700 font-medium">
                      Cancellation requested · waiting for manager confirmation
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
                      <button
                        onClick={() => handleCancel(app.id)}
                        className="rounded-lg border border-rust/30 bg-rust-soft px-3 py-1.5 text-xs font-medium text-rust transition hover:bg-rust/20"
                      >
                        Cancel Request
                      </button>
                    )}

                    {isUpcomingApproved && (
                      <button
                        onClick={() => handleRequestCancellation(app.id)}
                        className="rounded-lg border border-gold/40 bg-gold-soft px-3 py-1.5 text-xs font-medium text-gold transition hover:bg-gold/30"
                      >
                        Request Cancellation
                      </button>
                    )}

                    {app.status === 'approved' && app.cancellation_status === 'requested' && (
                      <button
                        onClick={() => handleWithdrawCancellation(app.id)}
                        className="rounded-lg border border-line bg-paper px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-line/40"
                      >
                        Withdraw Request
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer Pagination (Design copied from reference) */}
        <div className="flex items-center justify-between border-t border-line px-5 py-3.5">
          <span className="text-xs sm:text-sm text-ink-soft">
            {filteredApps.length === 0 ? (
              'Showing 0 of 0 requests'
            ) : (
              `Showing ${Math.min(filteredApps.length, paginatedApps.length)} of ${filteredApps.length} requests`
            )}
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

      {/* ── Request Leave Modal ── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">Request Leave</h2>
                <p className="mt-0.5 text-xs text-ink-soft">Submit a new time-off request.</p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-ink-faint transition hover:bg-paper hover:text-ink"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="field-label">Leave Type</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  className="field-input"
                >
                  {Object.entries(LEAVE_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
                {leaveType === 'annual' && (
                  <p className="mt-1 text-xs text-ink-faint">
                    Weekends and public holidays won&apos;t be counted.
                  </p>
                )}
              </div>

              {leaveType === 'medical' && (
                <div>
                  <label className="field-label">
                    MC <span className="font-normal text-ink-faint">(optional — photo or PDF, max 5MB)</span>
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null
                      if (f) {
                        const err = validateMcFile(f)
                        if (err) { setMcFileError(err); setMcFile(null); e.target.value = ''; return }
                      }
                      setMcFileError('')
                      setMcFile(f)
                    }}
                    className="field-input file:mr-3 file:rounded-md file:border-0 file:bg-paper file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-ink-soft"
                  />
                  {mcFileError && <p className="mt-1 text-xs text-rust">{mcFileError}</p>}
                  {mcFile && !mcFileError && <p className="mt-1 text-xs text-ink-faint">Selected: {mcFile.name}</p>}
                  <p className="mt-1 text-xs text-ink-faint">
                    You can also hand this in later — just note it, and your manager can attach it when recording your leave.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Start Date</label>
                  <input
                    type="date"
                    required
                    min={toLocalDateStr(new Date())}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="field-input"
                  />
                </div>
                <div>
                  <label className="field-label">End Date</label>
                  <input
                    type="date"
                    required
                    min={toLocalDateStr(new Date())}
                    disabled={isHalfDay}
                    value={isHalfDay ? startDate : endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="field-input"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={isHalfDay}
                    onChange={(e) => setIsHalfDay(e.target.checked)}
                    className="h-4 w-4 rounded border-line text-pine focus:ring-pine"
                  />
                  Half day
                </label>
                {isHalfDay && (
                  <select
                    value={halfDayPeriod}
                    onChange={(e) => setHalfDayPeriod(e.target.value as 'am' | 'pm')}
                    className="rounded-md border border-line bg-surface px-2.5 py-1 text-sm text-ink focus:border-pine focus:outline-none"
                  >
                    <option value="am">AM</option>
                    <option value="pm">PM</option>
                  </select>
                )}
              </div>

              <div>
                <label className="field-label">
                  Note <span className="font-normal text-ink-faint">(optional)</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  className="field-input resize-none"
                  placeholder="Add a note for your manager"
                />
              </div>

              {formError && (
                <p className="rounded-lg border border-rust/30 bg-rust-soft p-2.5 text-xs text-rust">
                  {formError}
                </p>
              )}

              <div className="mt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-ghost"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary w-auto px-5"
                >
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Hidden input used by "Attach MC" on an existing application ── */}
      <input
        ref={attachMcInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
        onChange={handleAttachMcFileChosen}
        className="hidden"
      />

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border border-line bg-surface px-4 py-3 shadow-xl">
          <span className="h-2 w-2 rounded-full bg-pine" />
          <p className="text-sm font-medium text-ink">{toast}</p>
        </div>
      )}
    </div>
  )
}
