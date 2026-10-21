'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useEmployee } from '@/lib/useEmployee'
import type { StaffRow } from '@/lib/useApprovals'

// 员工管理页用的轻量数据:只取员工资料。
export function useStaff() {
  const auth = useEmployee({ requireManager: true })
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [loading, setLoading] = useState(true)
  const reload = useCallback(async () => {
    const { data } = await supabase
      .from('employees')
      .select('id, employee_no, full_name, date_of_commencement, employment_type, role, annual_leave_carry_forward, annual_leave_entitlement_override, is_active')
      .order('employment_type', { ascending: false })
      .order('employee_no', { ascending: true })
    setStaff((data || []) as StaffRow[])
    setLoading(false)
  }, [])
  useEffect(() => {
    if (auth.status === 'ready') reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status])
  return { auth, me: auth.status === 'ready' ? auth.employee : null, staff, loading, reload }
}
