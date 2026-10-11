import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getActiveEmployee } from '@/lib/serverAuth'
import { telegramEnabled } from '@/lib/telegram'

// 员工自己绑定 / 解除绑定 Telegram。
//
// 绑定流程(员工不需要知道任何 chat id):
//   1. 员工在 /notifications 按"Connect Telegram" → 呼叫这里的 POST
//   2. 这里产生一个 15 分钟有效的一次性 token,回传 https://t.me/<bot>?start=<token>
//   3. 员工点链接 → Telegram 打开 bot → 按 Start → Telegram 把 "/start <token>"
//      送到 /api/telegram/webhook → 那边验证 token 后把 chat id 存进 employees

const TOKEN_TTL_MS = 15 * 60 * 1000

export async function POST(request: NextRequest) {
  const me = await getActiveEmployee(request)
  if (!me) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const botUsername = (process.env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, '')
  if (!telegramEnabled() || !botUsername) {
    return NextResponse.json({ error: 'Telegram notifications are not set up yet. Please contact your manager.' }, { status: 503 })
  }

  // 每人同一时间只留一个有效 token;顺便清掉所有过期的
  await supabaseAdmin.from('telegram_link_tokens').delete().eq('employee_id', me.id)
  await supabaseAdmin.from('telegram_link_tokens').delete().lt('expires_at', new Date().toISOString())

  const token = randomBytes(18).toString('hex') // 36 字元,只含 0-9a-f,符合 Telegram start 参数的限制
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString()
  const { error } = await supabaseAdmin
    .from('telegram_link_tokens')
    .insert({ token, employee_id: me.id, expires_at: expiresAt })
  if (error) {
    return NextResponse.json({ error: 'Could not create a link. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ url: `https://t.me/${botUsername}?start=${token}`, expiresAt })
}

export async function DELETE(request: NextRequest) {
  const me = await getActiveEmployee(request)
  if (!me) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  await supabaseAdmin.from('employees').update({ telegram_chat_id: null }).eq('id', me.id)
  await supabaseAdmin.from('telegram_link_tokens').delete().eq('employee_id', me.id)
  return NextResponse.json({ ok: true })
}
