import { supabase } from '@/lib/supabaseClient'

// 员工管理的写操作(负责人手机版)。成功回 null,失败回错误文字。
async function call(method: 'POST' | 'PATCH' | 'PUT', body: Record<string, unknown>): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/employees', {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify(body),
  })
  if (res.ok) return null
  return (await res.json().catch(() => ({}))).error || 'Something went wrong. Please try again.'
}

export const updateField = (id: string, field: string, value: string | number | null) => call('PATCH', { id, field, value })
export const setActive = (id: string, is_active: boolean) => call('PATCH', { id, is_active })
export const resetPassword = (id: string, password: string) => call('PUT', { id, password })
export const addEmployee = (b: Record<string, unknown>) => call('POST', b)
