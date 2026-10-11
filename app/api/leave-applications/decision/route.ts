import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logAudit, type AuditAction } from '@/lib/auditLog'
import { appLink, esc, fmtDays, fmtRange, notifyEmployee } from '@/lib/telegram'
import { LEAVE_TYPE_LABELS } from '@/lib/leaveRules'

// ─────────────────────────────────────────────────────────────────────────────
// 经理对请假申请做的决定 —— 批准 / 拒绝 / 直接取消 / 确认取消请求 / 不同意取消请求。
//
// 为什么挪到服务器(而不是像以前一样让浏览器直接 supabase.update):
// 这些都是需要留下审计记录的动作("谁、什么时候、做了什么决定"),
// 如果只在浏览器端更新数据库,就没有一个可信的地方能同时写一笔 audit_log ——
// 浏览器自己说"我批准了"没有意义,记录是不是真的发生过、是谁按的,
// 服务器用 service role key 写,才不怕被绕过或伪造。
//
// 支持批量(ids 可以有多个,用于 /approve 的批量批准/拒绝)。
// ─────────────────────────────────────────────────────────────────────────────

type Action = 'approve' | 'reject' | 'cancel' | 'confirm_cancellation' | 'decline_cancellation'
const ACTIONS: Action[] = ['approve', 'reject', 'cancel', 'confirm_cancellation', 'decline_cancellation']

async function requireManager(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null
  const token = authHeader.replace(/^Bearer\s+/i, '')

  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return null

  const { data: me } = await supabaseAdmin
    .from('employees')
    .select('id, role, is_active')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!me || me.role !== 'manager' || me.is_active === false) return null
  return { employeeId: me.id as string }
}

export async function POST(request: NextRequest) {
  const manager = await requireManager(request)
  if (!manager) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  let body: { ids?: unknown; action?: unknown; reason?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const action = String(body.action ?? '') as Action
  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
  const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : []
  if (ids.length === 0) {
    return NextResponse.json({ error: 'No applications selected' }, { status: 400 })
  }
  const reason = body.reason == null ? '' : String(body.reason).trim()
  if ((action === 'reject' || action === 'decline_cancellation') && !reason) {
    return NextResponse.json({ error: 'A reason is required.' }, { status: 400 })
  }

  const { data: rows, error: loadError } = await supabaseAdmin
    .from('leave_applications')
    .select('id, employee_id, status, cancellation_status, leave_type, start_date, end_date, total_days, is_half_day, half_day_period')
    .in('id', ids)
  if (loadError) {
    return NextResponse.json({ error: 'Could not load the selected applications.' }, { status: 500 })
  }

  let updated = 0
  const skipped: string[] = []
  // Telegram 通知先收集起来,全部决定做完后并行发送(批量批准时不会一笔一笔慢慢等)
  const notifications: Promise<void>[] = []

  for (const row of rows || []) {
    let patch: Record<string, unknown> | null = null
    let auditAction: AuditAction | null = null
    let auditDetails: Record<string, unknown> | null = null

    const now = new Date().toISOString()
    if (action === 'approve') {
      if (row.status !== 'pending') { skipped.push(row.id); continue }
      patch = { status: 'approved', approved_by: manager.employeeId, approved_at: now, last_decision_at: now }
      auditAction = 'leave.approved'
    } else if (action === 'reject') {
      if (row.status !== 'pending') { skipped.push(row.id); continue }
      patch = { status: 'rejected', approved_by: manager.employeeId, approved_at: now, remarks: reason, last_decision_at: now }
      auditAction = 'leave.rejected'
      auditDetails = { reason }
    } else if (action === 'cancel') {
      // 经理直接取消一笔已批准的假,不管日期是过去、现在还是未来。
      if (row.status !== 'approved') { skipped.push(row.id); continue }
      patch = { status: 'cancelled', cancellation_status: 'none', cancellation_decision_reason: reason || null, last_decision_at: now }
      auditAction = 'leave.cancelled_by_manager'
      auditDetails = { reason: reason || null, leave_type: row.leave_type, start_date: row.start_date, end_date: row.end_date, total_days: row.total_days }
    } else if (action === 'confirm_cancellation') {
      if (row.cancellation_status !== 'requested') { skipped.push(row.id); continue }
      patch = { status: 'cancelled', cancellation_status: 'none', last_decision_at: now }
      auditAction = 'leave.cancellation_confirmed'
    } else if (action === 'decline_cancellation') {
      if (row.cancellation_status !== 'requested') { skipped.push(row.id); continue }
      patch = { cancellation_status: 'none', cancellation_decision_reason: reason, last_decision_at: now }
      auditAction = 'leave.cancellation_declined'
      auditDetails = { reason }
    }

    if (!patch || !auditAction) continue

    const { error: updError } = await supabaseAdmin
      .from('leave_applications')
      .update(patch)
      .eq('id', row.id)
    if (updError) { skipped.push(row.id); continue }

    updated += 1
    await logAudit({
      actorId: manager.employeeId,
      action: auditAction,
      targetEmployeeId: row.employee_id,
      leaveApplicationId: row.id,
      details: auditDetails,
    })

    // 通知申请人(没绑定 Telegram 的人会被静默跳过)
    const typeLabel = esc(LEAVE_TYPE_LABELS[row.leave_type] ?? row.leave_type)
    const when = `${fmtRange(row.start_date, row.end_date, row.is_half_day ? row.half_day_period : null)} (${fmtDays(row.total_days)})`
    const why = reason ? `\nReason: ${esc(reason.slice(0, 300))}` : ''
    const link = appLink('/dashboard')
    const tail = link ? `\n\n${link}` : ''
    let text: string | null = null
    if (action === 'approve') text = `✅ <b>Leave approved</b>\n${typeLabel} · ${when}${tail}`
    else if (action === 'reject') text = `❌ <b>Leave rejected</b>\n${typeLabel} · ${when}${why}${tail}`
    else if (action === 'cancel') text = `⚠️ <b>Leave cancelled by your manager</b>\n${typeLabel} · ${when}${why}${tail}`
    else if (action === 'confirm_cancellation') text = `✅ <b>Cancellation confirmed</b>\nYour ${typeLabel} leave (${when}) has been cancelled.${tail}`
    else if (action === 'decline_cancellation') text = `ℹ️ <b>Cancellation declined</b>\nYour ${typeLabel} leave (${when}) stays approved.${why}${tail}`
    if (text) notifications.push(notifyEmployee(row.employee_id, text))
  }

  await Promise.allSettled(notifications)

  if (updated === 0) {
    return NextResponse.json({
      error: 'Could not apply this action — the selected application(s) may have changed status already. Please refresh and try again.',
    }, { status: 400 })
  }

  return NextResponse.json({ ok: true, updated, skipped })
}
