import { supabaseAdmin } from './supabaseAdmin'

// 只给服务器端的 API route 用(用 service role key,略过 RLS)。
// 这是 audit_log 表唯一的写入方式 —— 浏览器没有任何权限直接写这张表,
// 所以这个档案不能被 'use client' 的页面 import。

export type AuditAction =
  | 'leave.applied'
  | 'leave.recorded_by_manager'
  | 'leave.approved'
  | 'leave.rejected'
  | 'leave.cancelled_by_manager'
  | 'leave.cancellation_confirmed'
  | 'leave.cancellation_declined'
  | 'employee.password_reset'
  | 'employee.activated'
  | 'employee.deactivated'
  | 'employee.field_updated'

export async function logAudit(params: {
  actorId: string
  action: AuditAction
  targetEmployeeId?: string | null
  leaveApplicationId?: string | null
  details?: Record<string, unknown> | null
}) {
  // 故意不 throw、也不 return 错误给呼叫端:
  // 记录日志失败,不该连带让「批准假期」「重置密码」这些原本的操作也跟着失败。
  try {
    await supabaseAdmin.from('audit_log').insert({
      actor_id: params.actorId,
      action: params.action,
      target_employee_id: params.targetEmployeeId ?? null,
      leave_application_id: params.leaveApplicationId ?? null,
      details: params.details ?? null,
    })
  } catch {
    // ignore — 不影响主要操作
  }
}
