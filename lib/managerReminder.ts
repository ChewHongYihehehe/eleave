import { supabaseAdmin } from './supabaseAdmin'
import { appLink, esc, fmtDays, fmtRange, sendTelegram } from './telegram'
import { LEAVE_TYPE_LABELS, normalizeWorkWeek } from './leaveRules'
import { malaysiaToday, parseLocalDate, toLocalDateStr } from './dateUtils'

// ─────────────────────────────────────────────────────────────────────────────
// 负责人每日提醒:每天早上用 Telegram 告诉每位负责人,还有哪些申请在等他处理。
// 由 Vercel Cron 每天触发一次(见 vercel.json、app/api/cron/manager-reminder/route.ts)。
//
// 设计:
//   · 没有待处理的申请 → 什么都不发(不打扰)
//   · 不是公司的上班日(周末 / 公假)→ 不发
//   · 同一天只发一次(Cron 偶尔会重复触发)
//   · 只发给"启用中、已绑定 Telegram"的负责人;发送失败不影响其他人
// ─────────────────────────────────────────────────────────────────────────────

const MAX_LINES = 8 // 每一类最多列几行,多的写"还有 N 个"

export type ReminderApp = {
  id: string
  employee_id: string
  leave_type: string
  start_date: string
  end_date: string
  total_days: number
  is_half_day: boolean
  half_day_period: string | null
  created_at: string
}

function waitingLabel(createdAt: string, today: string): string {
  const created = new Date(createdAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })
  const days = Math.round((parseLocalDate(today).getTime() - parseLocalDate(created).getTime()) / 86400000)
  if (days <= 0) return 'today'
  return days === 1 ? '1 day' : `${days} days`
}

function section(title: string, apps: ReminderApp[], names: Map<string, string>, today: string): string {
  const lines = apps.slice(0, MAX_LINES).map((a) => {
    const type = LEAVE_TYPE_LABELS[a.leave_type] ?? a.leave_type
    const range = fmtRange(a.start_date, a.end_date, a.is_half_day ? a.half_day_period : null)
    return `• ${esc(names.get(a.employee_id) ?? 'Unknown')} · ${esc(type)} · ${range} (${fmtDays(a.total_days)}) · waiting ${waitingLabel(a.created_at, today)}`
  })
  if (apps.length > MAX_LINES) lines.push(`… and ${apps.length - MAX_LINES} more`)
  return `<b>${title} (${apps.length})</b>\n${lines.join('\n')}`
}

export function buildReminderText(params: {
  pending: ReminderApp[]
  cancellations: ReminderApp[]
  names: Map<string, string>
  today: string
}): string {
  const { pending, cancellations, names, today } = params
  const parts = ['⏰ <b>Leave requests waiting for you</b>']
  if (pending.length > 0) parts.push(section('Waiting for approval', pending, names, today))
  if (cancellations.length > 0) parts.push(section('Cancellation requests', cancellations, names, today))
  const link = appLink('/approve')
  if (link) parts.push(`Review: ${link}`)
  return parts.join('\n\n')
}

export type ReminderResult = { sent: number; skipped?: string; pending?: number; cancellations?: number }

export async function sendManagerReminders(opts: { force?: boolean } = {}): Promise<ReminderResult> {
  const today = toLocalDateStr(malaysiaToday())

  if (!opts.force) {
    const { data: wwRow } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'work_week').maybeSingle()
    const workWeek = normalizeWorkWeek(wwRow?.value)
    if ((workWeek[parseLocalDate(today).getDay()] ?? 0) === 0) return { sent: 0, skipped: 'not a working day' }

    const { data: holiday } = await supabaseAdmin
      .from('public_holidays').select('holiday_date').eq('holiday_date', today).eq('is_enabled', true).maybeSingle()
    if (holiday) return { sent: 0, skipped: 'public holiday' }

    const { data: last } = await supabaseAdmin
      .from('app_settings').select('value').eq('key', 'manager_reminder_last_sent').maybeSingle()
    if ((last?.value as { date?: string } | null)?.date === today) return { sent: 0, skipped: 'already sent today' }
  }

  const cols = 'id, employee_id, leave_type, start_date, end_date, total_days, is_half_day, half_day_period, created_at'
  const [pendingRes, cancelRes] = await Promise.all([
    supabaseAdmin.from('leave_applications').select(cols).eq('status', 'pending').order('start_date', { ascending: true }),
    supabaseAdmin.from('leave_applications').select(cols).eq('status', 'approved').eq('cancellation_status', 'requested').order('start_date', { ascending: true }),
  ])
  const pending = (pendingRes.data || []) as ReminderApp[]
  const cancellations = (cancelRes.data || []) as ReminderApp[]
  if (pending.length + cancellations.length === 0) return { sent: 0, skipped: 'nothing pending' }

  const ids = Array.from(new Set([...pending, ...cancellations].map((a) => a.employee_id)))
  const { data: emps } = await supabaseAdmin.from('employees').select('id, full_name').in('id', ids)
  const names = new Map<string, string>((emps || []).map((e) => [e.id as string, e.full_name as string]))

  const { data: managers } = await supabaseAdmin
    .from('employees')
    .select('id, telegram_chat_id')
    .eq('role', 'manager')
    .eq('is_active', true)
    .not('telegram_chat_id', 'is', null)
  const targets = (managers || []).filter((m) => m.telegram_chat_id)
  if (targets.length === 0) return { sent: 0, skipped: 'no manager has connected Telegram', pending: pending.length, cancellations: cancellations.length }

  const text = buildReminderText({ pending, cancellations, names, today })
  const results = await Promise.allSettled(targets.map((m) => sendTelegram(m.telegram_chat_id as number, text)))
  const sent = results.filter((r) => r.status === 'fulfilled' && r.value === true).length

  if (!opts.force && sent > 0) {
    await supabaseAdmin
      .from('app_settings')
      .upsert({ key: 'manager_reminder_last_sent', value: { date: today }, updated_at: new Date().toISOString() })
  }
  return { sent, pending: pending.length, cancellations: cancellations.length }
}
