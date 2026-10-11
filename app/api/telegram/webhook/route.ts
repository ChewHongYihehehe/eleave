import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { esc, sendTelegram } from '@/lib/telegram'

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

  const msg = update?.message
  const chatId: number | undefined = msg?.chat?.id
  const text: string = typeof msg?.text === 'string' ? msg.text.trim() : ''
  // 只处理一对一私聊;群组里的消息忽略(通知含有隐私内容,不能发到群里)
  if (!chatId || msg?.chat?.type !== 'private' || !text) return NextResponse.json({ ok: true })

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
