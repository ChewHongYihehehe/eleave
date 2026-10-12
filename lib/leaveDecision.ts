import { supabaseAdmin } from './supabaseAdmin'
import { logAudit, type AuditAction } from './auditLog'
import { appLink, esc, fmtDays, fmtRange, notifyEmployee, resolveNotices } from './telegram'
import { LEAVE_TYPE_LABELS } from './leaveRules'

// ─────────────────────────────────────────────────────────────────────────────
// 负责人对请假申请做的决定 —— 批准 / 拒绝 / 直接取消 / 确认取消请求 / 不同意取消请求。
//
// 网页(/api/leave-applications/decision)和 Telegram 按钮(/api/telegram/webhook)
// 共用这一份,所以两边的规则永远一致:谁能做、什么状态才能做、要不要理由、
// 写不写审计日志、通知谁,都只在这里定义一次。
// ─────────────────────────────────────────────────────────────────────────────

export type DecisionAction = 'approve' | 'reject' | 'cancel' | 'confirm_cancellation' | 'decline_cancellation'
export const DECISION_ACTIONS: DecisionAction[] = ['approve', 'reject', 'cancel', 'confirm_cancellation', 'decline_cancellation']

/** 这些动作一定要填理由 */
export const needsReason = (action: DecisionAction) => action === 'reject' || action === 'decline_cancellation'

export async function applyDecisions(params: {
  managerId: string
  managerName: string
  action: DecisionAction
  ids: string[]
  reason: string
  via: 'web' | 'telegram'
}): Promise<{ updated: number; skipped: string[] }> {
  const { managerId, managerName, action, ids, reason, via } = params

  const { data: rows, error: loadError } = await supabaseAdmin
    .from('leave_applications')
    .select('id, employee_id, status, cancellation_status, leave_type, start_date, end_date, total_days, is_half_day, half_day_period')
    .in('id', ids)
  if (loadError) throw new Error('Could not load the selected applications.')

  let updated = 0
  const skipped: string[] = []
  // 通知先收集起来,全部决定做完后并行发送(批量批准时不会一笔一笔慢慢等)
  const after: Promise<unknown>[] = []

  for (const row of rows || []) {
    let patch: Record<string, unknown> | null = null
    let auditAction: AuditAction | null = null
    let auditDetails: Record<string, unknown> | null = null
    // 更新时再确认一次"状态还是我们刚才读到的那样"。
    // 两位负责人几乎同时点按钮时,只有第一位能成功,第二位会被当成"已被处理"。
    let requireStatus: { column: 'status' | 'cancellation_status'; value: string }

    const now = new Date().toISOString()
    if (action === 'approve') {
      if (row.status !== 'pending') { skipped.push(row.id); continue }
      patch = { status: 'approved', approved_by: managerId, approved_at: now, last_decision_at: now }
      auditAction = 'leave.approved'
      requireStatus = { column: 'status', value: 'pending' }
    } else if (action === 'reject') {
      if (row.status !== 'pending') { skipped.push(row.id); continue }
      patch = { status: 'rejected', approved_by: managerId, approved_at: now, remarks: reason, last_decision_at: now }
      auditAction = 'leave.rejected'
      auditDetails = { reason }
      requireStatus = { column: 'status', value: 'pending' }
    } else if (action === 'cancel') {
      // 负责人直接取消一笔已批准的假,不管日期是过去、现在还是未来。
      if (row.status !== 'approved') { skipped.push(row.id); continue }
      patch = { status: 'cancelled', cancellation_status: 'none', cancellation_decision_reason: reason || null, last_decision_at: now }
      auditAction = 'leave.cancelled_by_manager'
      auditDetails = { reason: reason || null, leave_type: row.leave_type, start_date: row.start_date, end_date: row.end_date, total_days: row.total_days }
      requireStatus = { column: 'status', value: 'approved' }
    } else if (action === 'confirm_cancellation') {
      if (row.cancellation_status !== 'requested') { skipped.push(row.id); continue }
      patch = { status: 'cancelled', cancellation_status: 'none', last_decision_at: now }
      auditAction = 'leave.cancellation_confirmed'
      requireStatus = { column: 'cancellation_status', value: 'requested' }
    } else {
      // decline_cancellation
      if (row.cancellation_status !== 'requested') { skipped.push(row.id); continue }
      patch = { cancellation_status: 'none', cancellation_decision_reason: reason, last_decision_at: now }
      auditAction = 'leave.cancellation_declined'
      auditDetails = { reason }
      requireStatus = { column: 'cancellation_status', value: 'requested' }
    }

    const { data: changed, error: updError } = await supabaseAdmin
      .from('leave_applications')
      .update(patch)
      .eq('id', row.id)
      .eq(requireStatus.column, requireStatus.value)
      .select('id')
    if (updError || !changed || changed.length === 0) { skipped.push(row.id); continue }

    updated += 1
    await logAudit({
      actorId: managerId,
      action: auditAction,
      targetEmployeeId: row.employee_id,
      leaveApplicationId: row.id,
      details: { ...(auditDetails || {}), via },
    })

    const typeLabel = esc(LEAVE_TYPE_LABELS[row.leave_type] ?? row.leave_type)
    const when = `${fmtRange(row.start_date, row.end_date, row.is_half_day ? row.half_day_period : null)} (${fmtDays(row.total_days)})`
    const why = reason ? `\nReason: ${esc(reason.slice(0, 300))}` : ''
    const link = appLink('/dashboard')
    const tail = link ? `\n\n${link}` : ''
    const by = esc(managerName)

    // 1) 通知申请人(没绑定 Telegram 的人会被静默跳过)
    // 2) 把负责人们手上那条"带按钮的通知"改成结果
    let toEmployee: string
    let resultLine: string
    if (action === 'approve') {
      toEmployee = `✅ <b>Leave approved</b>\n${typeLabel} · ${when}${tail}`
      resultLine = `✅ <b>Approved</b> by ${by}`
    } else if (action === 'reject') {
      toEmployee = `❌ <b>Leave rejected</b>\n${typeLabel} · ${when}${why}${tail}`
      resultLine = `❌ <b>Rejected</b> by ${by}${why}`
    } else if (action === 'cancel') {
      toEmployee = `⚠️ <b>Leave cancelled by your manager</b>\n${typeLabel} · ${when}${why}${tail}`
      resultLine = `⚠️ <b>Cancelled</b> by ${by}${why}`
    } else if (action === 'confirm_cancellation') {
      toEmployee = `✅ <b>Cancellation confirmed</b>\nYour ${typeLabel} leave (${when}) has been cancelled.${tail}`
      resultLine = `✅ <b>Cancellation confirmed</b> by ${by}`
    } else {
      toEmployee = `ℹ️ <b>Cancellation declined</b>\nYour ${typeLabel} leave (${when}) stays approved.${why}${tail}`
      resultLine = `ℹ️ <b>Cancellation declined</b> by ${by}${why}`
    }
    after.push(notifyEmployee(row.employee_id, toEmployee))
    after.push(resolveNotices(row.id, resultLine))
  }

  await Promise.allSettled(after)
  return { updated, skipped }
}
