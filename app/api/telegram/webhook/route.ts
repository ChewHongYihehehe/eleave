import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { answerCallback, clearTelegramButtons, esc, fmtDays, fmtRange, sendTelegram, sendTelegramMessage } from '@/lib/telegram'
import { applyDecisions, type DecisionAction } from '@/lib/leaveDecision'
import { LEAVE_TYPE_LABELS } from '@/lib/leaveRules'

// Telegram 把 bot 收到的消息 POST 到这里。
//
// 安全:setWebhook 时我们设了 secret_token,Telegram 之后每次呼叫都会带
// X-Telegram-Bot-Api-Secret-Token 标头。对不上就拒绝 —— 否则任何人都能伪造
// "/start <token>" 请求。(Token 本身又是一次性、15 分钟内有效。)
//
// 注意:对于"合法但我们不处理"的消息一律回 200,否则 Telegram 会一直重试。

function secretOk(request: NextRequest): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET
  const got = request.headers.get('x-telegram-bot-api-secret-token')
  if (!expected || !got) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(got)
  return a.length === b.length && timingSafeEqual(a, b)
}

// 按钮上的 callback_data:"<代号>:<申请 id>"(Telegram 限制 64 字节,uuid 36 + 代号 ≤3,够用)
const CALLBACK_ACTIONS: Record<string, DecisionAction> = {
  a: 'approve',
  r: 'reject',
  cc: 'confirm_cancellation',
  cd: 'decline_cancellation',
}
const CALLBACK_RE = /^(a|r|cc|cd):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/

const HELP =
  'This bot sends you E-Leave updates.\n\n' +
  'To connect: open the E-Leave website → account menu → <b>Telegram Notifications</b> → <b>Connect Telegram</b>.\n\n' +
  'Commands:\n/unlink – stop notifications\n/help – show this message'

export async function POST(request: NextRequest) {
  if (!secretOk(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 401 })

  let update: any
  try {
    update = await request.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  // 负责人点了通知上的按钮
  if (update?.callback_query) {
    await handleCallback(update.callback_query)
    return NextResponse.json({ ok: true })
  }

  const msg = update?.message
  const chatId: number | undefined = msg?.chat?.id
  const text: string = typeof msg?.text === 'string' ? msg.text.trim() : ''
  // 只处理一对一私聊;群组里的消息忽略(通知含有隐私内容,不能发到群里)
  if (!chatId || msg?.chat?.type !== 'private' || !text) return NextResponse.json({ ok: true })

  // 负责人回复了"请输入理由"那条提示 → 完成拒绝
  if (msg.reply_to_message?.message_id && !text.startsWith('/')) {
    if (await handleReasonReply(chatId, text, msg.reply_to_message.message_id)) {
      return NextResponse.json({ ok: true })
    }
  }

  const [command, arg] = text.split(/\s+/, 2)
  const cmd = command.toLowerCase().replace(/@.*$/, '') // "/start@MyBot" → "/start"

  if (cmd === '/start' && arg) {
    await handleLink(chatId, arg)
  } else if (cmd === '/unlink' || cmd === '/stop') {
    const { data } = await supabaseAdmin
      .from('employees')
      .update({ telegram_chat_id: null })
      .eq('telegram_chat_id', chatId)
      .select('id')
    await sendTelegram(
      chatId,
      data && data.length > 0 ? 'Notifications turned off. You can reconnect any time from the E-Leave website.' : 'This chat is not connected to any E-Leave account.'
    )
  } else {
    await sendTelegram(chatId, HELP)
  }

  return NextResponse.json({ ok: true })
}

async function handleLink(chatId: number, token: string) {
  // token 只可能是 hex;不符合格式就不用去查数据库
  if (!/^[0-9a-f]{20,64}$/.test(token)) {
    await sendTelegram(chatId, 'That link is not valid. Please generate a new one from the E-Leave website.')
    return
  }

  const { data: row } = await supabaseAdmin
    .from('telegram_link_tokens')
    .select('token, employee_id, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (!row || new Date(row.expires_at).getTime() < Date.now()) {
    await supabaseAdmin.from('telegram_link_tokens').delete().eq('token', token)
    await sendTelegram(chatId, 'That link has expired. Please generate a new one from the E-Leave website.')
    return
  }

  const { data: emp } = await supabaseAdmin
    .from('employees')
    .select('id, full_name, is_active, employment_type')
    .eq('id', row.employee_id)
    .maybeSingle()
  if (!emp || emp.is_active === false || emp.employment_type !== 'full_time') {
    await sendTelegram(chatId, 'This account cannot receive notifications.')
    return
  }

  // 这个 Telegram 已经绑在"别的"员工身上 → 拒绝(避免通知发错人)
  const { data: existing } = await supabaseAdmin
    .from('employees')
    .select('id')
    .eq('telegram_chat_id', chatId)
    .neq('id', emp.id)
    .maybeSingle()
  if (existing) {
    await sendTelegram(chatId, 'This Telegram account is already connected to another E-Leave user. Send /unlink first, then try again.')
    return
  }

  const { error } = await supabaseAdmin.from('employees').update({ telegram_chat_id: chatId }).eq('id', emp.id)
  if (error) {
    await sendTelegram(chatId, 'Something went wrong while connecting. Please try again.')
    return
  }
  await supabaseAdmin.from('telegram_link_tokens').delete().eq('token', token)

  await sendTelegram(
    chatId,
    `✅ Connected, <b>${esc(emp.full_name)}</b>!\nYou will now receive E-Leave updates here.\n\nSend /unlink at any time to stop.`
  )
}


// ─── 按钮 / 理由回复 ─────────────────────────────────────────────────────────

async function getManagerByChat(chatId: number) {
  const { data } = await supabaseAdmin
    .from('employees')
    .select('id, full_name, role, is_active')
    .eq('telegram_chat_id', chatId)
    .maybeSingle()
  if (!data || data.role !== 'manager' || data.is_active === false) return null
  return { id: data.id as string, name: data.full_name as string }
}

async function handleCallback(cq: any) {
  const cqId: string = cq.id
  const chatId: number | undefined = cq.message?.chat?.id
  const messageId: number | undefined = cq.message?.message_id
  const match = typeof cq.data === 'string' ? CALLBACK_RE.exec(cq.data) : null

  if (!chatId || !messageId || cq.message?.chat?.type !== 'private' || !match) {
    await answerCallback(cqId)
    return
  }

  // 只有"已绑定 Telegram 的负责人"点按钮才有效(别人拿到这条消息也没用)
  const manager = await getManagerByChat(chatId)
  if (!manager) {
    await answerCallback(cqId, 'Only managers can do this.', true)
    return
  }

  const action = CALLBACK_ACTIONS[match[1]]
  const applicationId = match[2]

  // 先确认这笔申请现在还能处理(可能已被别的负责人、或在网页上处理掉了)
  const { data: app } = await supabaseAdmin
    .from('leave_applications')
    .select('id, employee_id, status, cancellation_status, leave_type, start_date, end_date, total_days, is_half_day, half_day_period')
    .eq('id', applicationId)
    .maybeSingle()

  const actionable =
    !!app &&
    ((action === 'approve' || action === 'reject') ? app.status === 'pending' : app.cancellation_status === 'requested')
  if (!app || !actionable) {
    await answerCallback(cqId, 'This request has already been handled.', true)
    await clearTelegramButtons(chatId, messageId)
    return
  }

  // 批准 / 确认取消:不需要理由,一键完成
  if (action === 'approve' || action === 'confirm_cancellation') {
    try {
      const result = await applyDecisions({
        managerId: manager.id, managerName: manager.name, action, ids: [applicationId], reason: '', via: 'telegram',
      })
      await answerCallback(cqId, result.updated > 0 ? 'Done ✅' : 'This request has already been handled.', result.updated === 0)
      if (result.updated === 0) await clearTelegramButtons(chatId, messageId)
    } catch {
      await answerCallback(cqId, 'Something went wrong. Please use the website.', true)
    }
    return
  }

  // 拒绝 / 不同意取消:要先问理由(和网页上的规则一样)。
  // 用 force_reply 让 Telegram 自动进入"回复这条消息"的状态,负责人直接打字发送即可。
  const { data: emp } = await supabaseAdmin.from('employees').select('full_name').eq('id', app.employee_id).maybeSingle()
  const verb = action === 'reject' ? 'rejecting' : 'declining the cancellation of'
  const summary = `${esc(LEAVE_TYPE_LABELS[app.leave_type] ?? app.leave_type)} · ${fmtRange(app.start_date, app.end_date, app.is_half_day ? app.half_day_period : null)} (${fmtDays(app.total_days)})`
  const prompt = await sendTelegramMessage(
    chatId,
    `✍️ Reply to this message with the reason for ${verb} <b>${esc(emp?.full_name ?? 'this')}</b>'s leave:\n${summary}`,
    { force_reply: true, input_field_placeholder: 'Reason...' }
  )
  if (prompt.ok && prompt.messageId) {
    await supabaseAdmin.from('telegram_messages').insert({
      leave_application_id: applicationId,
      chat_id: chatId,
      message_id: prompt.messageId,
      kind: 'reason_prompt',
      action,
    })
  }
  await answerCallback(cqId, 'Please type a reason and send it.')
}

/** 负责人回复了"请输入理由"那条提示。是的话处理并回 true,不是就回 false 让上面的流程继续。 */
async function handleReasonReply(chatId: number, text: string, repliedToMessageId: number): Promise<boolean> {
  const { data: prompt } = await supabaseAdmin
    .from('telegram_messages')
    .select('id, leave_application_id, action')
    .eq('chat_id', chatId)
    .eq('message_id', repliedToMessageId)
    .eq('kind', 'reason_prompt')
    .maybeSingle()
  if (!prompt || !prompt.action) return false

  const manager = await getManagerByChat(chatId)
  if (!manager) return false

  const reason = text.trim().slice(0, 300)
  if (!reason) {
    await sendTelegram(chatId, 'Please type a reason as text.')
    return true
  }

  // 先把提示作废,避免同一条提示被重复使用
  await supabaseAdmin.from('telegram_messages').delete().eq('id', prompt.id)

  try {
    const result = await applyDecisions({
      managerId: manager.id,
      managerName: manager.name,
      action: prompt.action as DecisionAction,
      ids: [prompt.leave_application_id],
      reason,
      via: 'telegram',
    })
    await sendTelegram(
      chatId,
      result.updated > 0 ? '✅ Done. The employee has been notified.' : 'This request has already been handled, so nothing was changed.'
    )
  } catch {
    await sendTelegram(chatId, 'Something went wrong. Please use the website.')
  }
  return true
}
