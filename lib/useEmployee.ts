'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from './supabaseClient'

export type CurrentEmployee = {
  id: string
  employee_no: number | null
  full_name: string
  date_of_commencement: string
  employment_type: string
  role: string
  is_active: boolean
  annual_leave_carry_forward: number
  annual_leave_entitlement_override: number | null
  last_notifications_seen_at: string | null
}

type State =
  | { status: 'loading' }
  | { status: 'ready'; employee: CurrentEmployee }
  | { status: 'error'; message: string }

/**
 * 每个页面共用的"取得目前登录的员工资料 + 权限检查"。
 * 真正的拦截在 middleware.ts(服务器端,页面渲染前);这里是第二道防线,
 * 同时负责把员工资料交给页面,并且在查不到资料时给出明确的错误画面,
 * 而不是让页面一直停在 Loading。
 */
export function useEmployee(opts: { requireManager?: boolean } = {}): State {
  const router = useRouter()
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    async function run() {
      const { data: { user }, error: userErr } = await supabase.auth.getUser()
      if (cancelled) return
      if (userErr || !user) { router.replace('/'); return }

      const { data: emp, error } = await supabase
        .from('employees')
        .select('id, employee_no, full_name, date_of_commencement, employment_type, role, is_active, annual_leave_carry_forward, annual_leave_entitlement_override, last_notifications_seen_at')
        .eq('auth_user_id', user.id)
        .maybeSingle()
      if (cancelled) return

      if (error) {
        setState({ status: 'error', message: `Could not load your profile: ${error.message}` })
        return
      }
      if (!emp) {
        setState({ status: 'error', message: 'No employee profile is linked to this account. Please contact your manager.' })
        return
      }
      if (emp.is_active === false) {
        await supabase.auth.signOut()
        router.replace('/?notice=inactive')
        return
      }
      if (emp.employment_type === 'part_time') {
        await supabase.auth.signOut()
        router.replace('/?notice=part-time')
        return
      }
      if (opts.requireManager && emp.role !== 'manager') {
        router.replace('/dashboard')
        return
      }
      setState({ status: 'ready', employee: emp as CurrentEmployee })
    }

    run()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return state
}
