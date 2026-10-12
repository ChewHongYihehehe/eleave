import { supabaseAdmin } from './supabaseAdmin'

// ─────────────────────────────────────────────────────────────────────────────
// Telegram 通知(只给服务器端的 API route 用)。
//
// 设计原则:通知是"附加功能",发送失败绝对不能让「提交申请」「批准假期」这些
// 主要操作跟着失败 —— 所以这里的函数都不会 throw,出错只 console.error。
// 没设 TELEGRAM_BOT_TOKEN(例如本机开发)时整个模块等于什么都不做。
// ─────────────────────────────────────────────────────────────────────────────

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const SEND_TIMEOUT_MS = 4000

export const telegramEnabled = () => !!BOT_TOKEN

/** parse_mode=HTML 时,用户输入的文字(姓名、理由)必须转义,否则含 < > & 会让整条消息发送失败 */
export function esc(text: unknown): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** 网站网址,用来在通知里放链接。没设就不放链接。 */
export function appLink(path: string): string | null {
  const base = (process.env.APP_URL || '').replace(/\/+$/, '')
  return base ? `${base}${path}` : null
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function fmtDate(iso: string, withYear: boolean) {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ''}`
}

/** "12 Oct – 14 Oct 2026";同一天 "12 Oct 2026";半天会加上 (AM)/(PM) */
export function fmtRange(start: string, end: string, halfDayPeriod?: string | null) {
  const half = halfDayPeriod ? ` (${halfDayPeriod.toUpperCase()})` : ''
  if (start === end) return `${fmtDate(start, true)}${half}`
  const sameYear = start.slice(0, 4) === end.slice(0, 4)
  return `${fmtDate(start, !sameYear)} – ${fmtDate(end, true)}`
}

export function fmtDays(n: number) {
  const v = Number(n)
  const s = Number.isInteger(v) ? String(v) : v.toFixed(1)
  return `${s} day${v === 1 ? '' : 's'}`
}

/** 呼叫 Telegram Bot API。成功回 result,失败回 null(不 throw)。 */
async function tgCall(method: string, body: Record<string, unknown>): Promise<any | null> {
  if (!BOT_TOKEN) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS)
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (res.ok) return (await res.json()).result ?? true

    // 403 = 对方把 bot 屏蔽了 / 删除了聊天 → 清掉绑定,以后不用再试
    if (res.status === 403 && method === 'sendMessage' && body.chat_id != null) {
      await supabaseAdmin.from('employees').update({ telegram_chat_id: null }).eq('telegram_chat_id', body.chat_id as number)
    } else if (res.status !== 400) {
      // 400 多半是"消息没变化 / 太旧 / 已被删除",不值得记
      console.error(`[telegram] ${method} failed`, res.status, await res.text().catch(() => ''))
    }
    return null
  } catch (err) {
    console.error(`[telegram] ${method} error`, err)
    return null
  } finally {
    clearTimeout(timer)
  }
}

export type InlineButton = { text: string; callback_data: string }

/** 发一条消息,可附带按钮(replyMarkup)。回传 message_id 方便以后修改它。 */
export async function sendTelegramMessage(
  chatId: number | string,
  html: string,
  replyMarkup?: Record<string, unknown>
): Promise<{ ok: boolean; messageId?: number }> {
  const result = await tgCall('sendMessage', {
    chat_id: chatId,
    text: html,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  })
  return result ? { ok: true, messageId: result.message_id } : { ok: false }
}

/** 发一条消息给指定 chat。成功 true;失败 false(不 throw)。 */
export async function sendTelegram(chatId: number | string, html: string): Promise<boolean> {
  return (await sendTelegramMessage(chatId, html)).ok
}

/** 修改一条旧消息的文字,并把按钮收掉 */
export async function editTelegramMessage(chatId: number | string, messageId: number, html: string): Promise<void> {
  await tgCall('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: html,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: { inline_keyboard: [] },
  })
}

/** 只把某条消息的按钮收掉,文字不动 */
export async function clearTelegramButtons(chatId: number | string, messageId: number): Promise<void> {
  await tgCall('editMessageReplyMarkup', { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } })
}

/** 回应按钮点击(让按钮上的"转圈"停下来,并可弹出一小段提示) */
export async function answerCallback(callbackQueryId: string, text?: string, showAlert = false): Promise<void> {
  await tgCall('answerCallbackQuery', { callback_query_id: callbackQueryId, ...(text ? { text, show_alert: showAlert } : {}) })
}

/** 通知某一位员工(没绑定 Telegram 就静默跳过) */
export async function notifyEmployee(employeeId: string, html: string): Promise<void> {
  if (!BOT_TOKEN) return
  try {
    const { data } = await supabaseAdmin
      .from('employees')
      .select('telegram_chat_id, is_active')
      .eq('id', employeeId)
      .maybeSingle()
    if (!data || data.is_active === false || !data.telegram_chat_id) return
    await sendTelegram(data.telegram_chat_id, html)
  } catch (err) {
    console.error('[telegram] notifyEmployee error', err)
  }
}

/**
 * 通知所有启用中、且已绑定 Telegram 的负责人(excludeEmployeeId:不通知某人自己)。
 * 带 options.applicationId + options.buttons 时,消息会附上按钮,并记下每条消息的 id,
 * 之后有人做了决定,就能把所有负责人手上那条消息的按钮收掉(见 resolveNotices)。
 */
export async function notifyManagers(
  html: string,
  excludeEmployeeId?: string,
  options?: { applicationId: string; buttons: InlineButton[] }
): Promise<void> {
  if (!BOT_TOKEN) return
  try {
    const { data } = await supabaseAdmin
      .from('employees')
      .select('id, telegram_chat_id')
      .eq('role', 'manager')
      .eq('is_active', true)
      .not('telegram_chat_id', 'is', null)
    const targets = (data || []).filter((m) => m.id !== excludeEmployeeId && m.telegram_chat_id)

    await Promise.allSettled(
      targets.map(async (m) => {
        const markup = options ? { inline_keyboard: [options.buttons] } : undefined
        const sent = await sendTelegramMessage(m.telegram_chat_id as number, html, markup)
        if (sent.ok && sent.messageId && options) {
          await supabaseAdmin.from('telegram_messages').insert({
            leave_application_id: options.applicationId,
            chat_id: m.telegram_chat_id,
            message_id: sent.messageId,
            kind: 'notice',
            original_text: html,
          })
        }
      })
    )
  } catch (err) {
    console.error('[telegram] notifyManagers error', err)
  }
}

/**
 * 某笔申请已有结果:把所有负责人手上的通知(含按钮)改成"结果"并收掉按钮,
 * 顺便清掉相关的"请回复理由"提示。网页和 Telegram 里做的决定都会走这里。
 */
export async function resolveNotices(applicationId: string, resultLine: string): Promise<void> {
  if (!BOT_TOKEN) return
  try {
    const { data } = await supabaseAdmin
      .from('telegram_messages')
      .select('chat_id, message_id, kind, original_text')
      .eq('leave_application_id', applicationId)
    const rows = data || []
    await Promise.allSettled(
      rows.map((r) =>
        r.kind === 'notice' && r.original_text
          ? editTelegramMessage(r.chat_id, r.message_id, `${r.original_text}\n\n${resultLine}`)
          : clearTelegramButtons(r.chat_id, r.message_id)
      )
    )
    await supabaseAdmin.from('telegram_messages').delete().eq('leave_application_id', applicationId)
  } catch (err) {
    console.error('[telegram] resolveNotices error', err)
  }
}
