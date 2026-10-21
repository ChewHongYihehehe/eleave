'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { toLocalDateStr } from '@/lib/dateUtils'
import {
  getEntitlementForYear,
  daysInYear,
  DEFAULT_WORK_WEEK,
  type WorkWeek,
} from '@/lib/leaveRules'
import { loadWorkWeek } from '@/lib/settings'
import { useEmployee } from '@/lib/useEmployee'

// 员工端手机版所有页面共用的数据:员工资料、今年的申请、余额、即将到来的公假。
// 数据逻辑和电脑版 dashboard 保持一致(同样的额度、同样的天数算法)。

export type LeaveApp = {
  id: string
  leave_type: string
  start_date: string
  end_date: string
  total_days: number
  status: string
  created_at: string
  is_half_day: boolean
  half_day_period: string | null
  reason: string | null
  remarks: string | null
  cancellation_status: string
  cancellation_decision_reason: string | null
  mc_attachment_path: string | null
  last_decision_at: string | null
}

export type PublicHoliday = { holiday_date: string; name: string }

export const BALANCE_TYPES = ['annual', 'medical', 'maternity', 'paternity'] as const

export type Balance = {
  type: string
  base: number
  carry: number
  total: number
  used: number // 已批准
  pending: number // 待审批
  remaining: number
}

export const TYPE_COLOR: Record<string, string> = {
  annual: '#1677FF',
  medical: '#F5222D',
  maternity: '#EB2F96',
  paternity: '#722ED1',
  unpaid: '#8C8C8C',
}

export const fmtNum = (n: number) => String(Number(n.toFixed(1)))

const SELECT =
  'id, leave_type, start_date, end_date, total_days, status, created_at, is_half_day, half_day_period, reason, remarks, cancellation_status, cancellation_decision_reason, mc_attachment_path, last_decision_at'

export function useLeaveData() {
  const auth = useEmployee()
  const [apps, setApps] = useState<LeaveApp[]>([])
  const [holidayDates, setHolidayDates] = useState<string[]>([])
  const [upcoming, setUpcoming] = useState<PublicHoliday[]>([])
  const [workWeek, setWorkWeek] = useState<WorkWeek>(DEFAULT_WORK_WEEK)
  const [sums, setSums] = useState<{ used: Record<string, number>; pending: Record<string, number> }>({ used: {}, pending: {} })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // 进页面那一刻"上次看通知"的时间;整个访问期间保持不变,这样红点不会一下子消失
  const [seenAt, setSeenAt] = useState<string | null>(null)

  const employee = auth.status === 'ready' ? auth.employee : null

  const load = useCallback(async () => {
    if (!employee) return
    setError('')
    const today = toLocalDateStr(new Date())

    const { data: holidays, error: hErr } = await supabase
      .from('public_holidays')
      .select('holiday_date, name')
      .eq('is_enabled', true)
      .order('holiday_date', { ascending: true })
    if (hErr) { setError('Could not load public holidays.'); setLoading(false); return }

    const dates = (holidays || []).map((h) => h.holiday_date)
    setHolidayDates(dates)
    setUpcoming((holidays || []).filter((h) => h.holiday_date >= today).slice(0, 5))

    const ww = await loadWorkWeek()
    setWorkWeek(ww)

    const year = new Date().getFullYear()
    const { data, error: aErr } = await supabase
      .from('leave_applications')
      .select(SELECT)
      .eq('employee_id', employee.id)
      .lte('start_date', `${year}-12-31`)
      .gte('end_date', `${year}-01-01`)
      .order('created_at', { ascending: false })
    if (aErr) { setError('Could not load your applications.'); setLoading(false); return }

    const list = (data || []) as LeaveApp[]
    setApps(list)

    const used: Record<string, number> = {}
    const pending: Record<string, number> = {}
    for (const a of list) {
      if (a.status !== 'approved' && a.status !== 'pending') continue
      const days = daysInYear(a, year, dates, ww)
      const bucket = a.status === 'approved' ? used : pending
      bucket[a.leave_type] = (bucket[a.leave_type] || 0) + days
    }
    setSums({ used, pending })
    setLoading(false)
  }, [employee])

  useEffect(() => {
    if (auth.status !== 'ready') return
    setSeenAt(auth.employee.last_notifications_seen_at)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status])

  const balances: Balance[] = useMemo(() => {
    if (!employee) return []
    const year = new Date().getFullYear()
    return BALANCE_TYPES.map((type) => {
      const base = getEntitlementForYear(employee, type, year) ?? 0
      const carry = type === 'annual' ? Number(employee.annual_leave_carry_forward) || 0 : 0
      const total = base + carry
      const used = sums.used[type] || 0
      const pending = sums.pending[type] || 0
      return { type, base, carry, total, used, pending, remaining: Math.max(0, total - used - pending) }
    }).filter((b) => b.total > 0)
  }, [employee, sums])

  const unseenCount = apps.filter((a) => a.last_decision_at && (!seenAt || a.last_decision_at > seenAt)).length
  const isUnseen = (a: LeaveApp) => !!a.last_decision_at && (!seenAt || a.last_decision_at > seenAt)

  return {
    auth, employee, apps, balances, upcoming, holidayDates, workWeek,
    loading, error, reload: load, unseenCount, isUnseen,
  }
}
