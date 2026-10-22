'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useEmployee } from '@/lib/useEmployee'
import { loadWorkWeek } from '@/lib/settings'
import { DEFAULT_WORK_WEEK, daysInYear, getEntitlementForYear, type WorkWeek } from '@/lib/leaveRules'

// 负责人手机版共用的数据:所有请假申请 + 员工资料 + 决定动作。
// 所有审批动作都走服务器 /api/leave-applications/decision(规则、审计日志、通知都在那边)。

export type Person = { full_name: string; employment_type?: string; employee_no?: number | null }

export type Application = {
  id: string
  employee_id: string
  leave_type: string
  start_date: string
  end_date: string
  total_days: number
  reason: string | null
  status: string
  is_half_day: boolean
  half_day_period: string | null
  remarks: string | null
  cancellation_status: string
  cancellation_requested_at: string | null
  cancellation_decision_reason: string | null
  mc_attachment_path: string | null
  created_at: string
  last_decision_at: string | null
  person: Person
}

export type StaffRow = {
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

export type Action = 'approve' | 'reject' | 'cancel' | 'confirm_cancellation' | 'decline_cancellation'

export const isAttention = (a: Application) => a.status === 'pending' || (a.status === 'approved' && a.cancellation_status === 'requested')
export const isImported = (a: Pick<Application, 'remarks'>) => !!a.remarks?.includes('Historical import')

const SELECT = `
  id, employee_id, leave_type, start_date, end_date, total_days,
  reason, status, is_half_day, half_day_period, remarks,
  cancellation_status, cancellation_requested_at, cancellation_decision_reason, mc_attachment_path,
  created_at, last_decision_at,
  employees!leave_applications_employee_id_fkey(full_name, employment_type, employee_no)
`

export function useApprovals() {
  const auth = useEmployee({ requireManager: true })
  const [apps, setApps] = useState<Application[]>([])
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [holidays, setHolidays] = useState<string[]>([])
  const [workWeek, setWorkWeek] = useState<WorkWeek>(DEFAULT_WORK_WEEK)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    const [{ data: rows, error: e1 }, { data: emps }, { data: hol }, ww] = await Promise.all([
      supabase.from('leave_applications').select(SELECT).order('created_at', { ascending: false }),
      supabase
        .from('employees')
        .select('id, employee_no, full_name, date_of_commencement, employment_type, role, annual_leave_carry_forward, annual_leave_entitlement_override, is_active')
        .order('full_name', { ascending: true }),
      supabase.from('public_holidays').select('holiday_date').eq('is_enabled', true),
      loadWorkWeek(),
    ])
    // 失败就保留上一次的数据,不要用空列表覆盖(否则会被误当成"没有待办")
    if (e1) { setError('Could not load requests.'); setLoading(false); return }
    setError('')
    // 关联查询在某些版本会回传数组,两种都接受
    const list: Application[] = ((rows || []) as unknown as (Omit<Application, 'person'> & { employees: Person | Person[] | null })[]).map((r) => {
      const { employees, ...rest } = r
      const p = Array.isArray(employees) ? employees[0] : employees
      return { ...rest, person: p || { full_name: 'Employee' } }
    })
    setApps(list)
    setStaff((emps || []) as StaffRow[])
    setHolidays((hol || []).map((h) => h.holiday_date))
    setWorkWeek(ww)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (auth.status === 'ready') reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status])

  // 成功回 null,失败回错误文字
  async function send(action: Action, ids: string[], reason?: string): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/leave-applications/decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ ids, action, reason }),
    })
    const err = res.ok ? null : ((await res.json().catch(() => ({}))).error || 'Something went wrong. Please try again.')
    await reload()
    return err
  }

  const attention = useMemo(() => apps.filter(isAttention), [apps])

  // 某员工今年某假种的额度 / 已用 / 待审批 / 剩余(帮负责人判断要不要批)
  function balanceFor(employeeId: string, type: string, year: number = new Date().getFullYear()) {
    const emp = staff.find((s) => s.id === employeeId)
    if (!emp) return null
    const base = getEntitlementForYear(emp, type, year)
    if (base == null) return null
    const total = base + (type === 'annual' ? Number(emp.annual_leave_carry_forward) || 0 : 0)
    let used = 0
    let pending = 0
    for (const a of apps) {
      if (a.employee_id !== employeeId || a.leave_type !== type) continue
      if (a.status !== 'approved' && a.status !== 'pending') continue
      const d = daysInYear(a, year, holidays, workWeek)
      if (a.status === 'approved') used += d
      else pending += d
    }
    return { total, used, pending, remaining: total - used - pending }
  }

  return { auth, me: auth.status === 'ready' ? auth.employee : null, apps, staff, loading, error, reload, send, attention, balanceFor }
}

// 只要"待处理数量"(底部栏红点、不需要整份数据的页面用)
export function useAttentionCount() {
  const [n, setN] = useState<number | undefined>(undefined)
  useEffect(() => {
    let cancelled = false
    supabase
      .from('leave_applications')
      .select('id', { count: 'exact', head: true })
      .or('status.eq.pending,cancellation_status.eq.requested')
      .then(({ count }) => { if (!cancelled && typeof count === 'number') setN(count) })
    return () => { cancelled = true }
  }, [])
  return n
}
