import type { NextRequest } from 'next/server'
import { supabaseAdmin } from './supabaseAdmin'

// 给新的 API route 共用:从 Bearer token 找出"目前登录、启用中、全职"的员工。
export async function getActiveEmployee(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null
  const token = authHeader.replace(/^Bearer\s+/i, '')

  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return null

  const { data: emp } = await supabaseAdmin
    .from('employees')
    .select('id, full_name, role, is_active, employment_type, telegram_chat_id, employee_no, auth_user_id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!emp || emp.is_active === false || emp.employment_type !== 'full_time') return null
  return emp
}
