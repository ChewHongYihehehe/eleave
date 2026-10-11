import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getActiveEmployee } from '@/lib/serverAuth'
import { appLink, esc, fmtDays, fmtRange, notifyManagers } from '@/lib/telegram'
import { LEAVE_TYPE_LABELS } from '@/lib/leaveRules'

// 员工"申请取消已批准的假"目前是浏览器直接更新数据库(RLS 允许),服务器不会知道,
// 所以员工端在更新成功后呼叫这支小接口,让它去通知负责人。
//
// 不能盲目相信呼叫端,所以这里重新从数据库验证:
//   · 这笔申请真的是呼叫者本人的
//   · 现在真的处于"已申请取消"状态
//   · 同一次申请只通知一次(cancellation_notified_at),不能被拿来刷屏
export async function POST(request: NextRequest) {
  const me = await getActiveEmployee(request)
  if (!me) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  let id = ''
  try {
    id = String((await request.json())?.id ?? '')
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { data: app } = await supabaseAdmin
    .from('leave_applications')
    .select('id, employee_id, leave_type, start_date, end_date, is_half_day, half_day_period, total_days, cancellation_status, cancellation_requested_at, cancellation_notified_at')
    .eq('id', id)
    .maybeSingle()

  if (!app || app.employee_id !== me.id || app.cancellation_status !== 'requested') {
    return NextResponse.json({ ok: true, notified: false })
  }
  if (app.cancellation_notified_at && app.cancellation_requested_at && app.cancellation_notified_at >= app.cancellation_requested_at) {
    return NextResponse.json({ ok: true, notified: false })
  }

  await supabaseAdmin
    .from('leave_applications')
    .update({ cancellation_notified_at: new Date().toISOString() })
    .eq('id', app.id)

  const link = appLink('/approve')
  await notifyManagers(
    [
      '↩️ <b>Cancellation request</b>',
      `${esc(me.full_name)} wants to cancel approved leave:`,
      `${esc(LEAVE_TYPE_LABELS[app.leave_type] ?? app.leave_type)} · ${fmtRange(app.start_date, app.end_date, app.is_half_day ? app.half_day_period : null)} (${fmtDays(app.total_days)})`,
      link ? `\nReview: ${link}` : '',
    ].join('\n'),
    me.id
  )

  return NextResponse.json({ ok: true, notified: true })
}
