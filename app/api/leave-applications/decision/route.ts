import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { applyDecisions, DECISION_ACTIONS, needsReason, type DecisionAction } from '@/lib/leaveDecision'

// ─────────────────────────────────────────────────────────────────────────────
// 负责人对请假申请做的决定(网页入口)。
//
// 为什么在服务器而不是让浏览器直接 supabase.update:
// 这些动作需要留下审计记录("谁、什么时候、做了什么决定"),只在浏览器端更新数据库,
// 就没有一个可信的地方能同时写 audit_log。真正的规则在 lib/leaveDecision.ts,
// Telegram 按钮也共用同一份。
//
// 支持批量(ids 可以有多个,用于 /approve 的批量批准/拒绝)。
// ─────────────────────────────────────────────────────────────────────────────

async function requireManager(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null
  const token = authHeader.replace(/^Bearer\s+/i, '')

  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return null

  const { data: me } = await supabaseAdmin
    .from('employees')
    .select('id, full_name, role, is_active')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!me || me.role !== 'manager' || me.is_active === false) return null
  return { employeeId: me.id as string, name: me.full_name as string }
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

  const action = String(body.action ?? '') as DecisionAction
  if (!DECISION_ACTIONS.includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
  const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : []
  if (ids.length === 0) {
    return NextResponse.json({ error: 'No applications selected' }, { status: 400 })
  }
  const reason = body.reason == null ? '' : String(body.reason).trim()
  if (needsReason(action) && !reason) {
    return NextResponse.json({ error: 'A reason is required.' }, { status: 400 })
  }

  let result
  try {
    result = await applyDecisions({
      managerId: manager.employeeId,
      managerName: manager.name,
      action,
      ids,
      reason,
      via: 'web',
    })
  } catch {
    return NextResponse.json({ error: 'Could not load the selected applications.' }, { status: 500 })
  }

  if (result.updated === 0) {
    return NextResponse.json({
      error: 'Could not apply this action — the selected application(s) may have changed status already. Please refresh and try again.',
    }, { status: 400 })
  }

  return NextResponse.json({ ok: true, updated: result.updated, skipped: result.skipped })
}
