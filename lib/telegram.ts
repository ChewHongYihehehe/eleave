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

/** 发一条消息给指定 chat。成功 true;失败 false(不 throw)。 */
export async function sendTelegram(chatId: number | string, html: string): Promise<boolean> {
  if (!BOT_TOKEN) return false
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS)
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: html,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    })
    if (res.ok) return true

    // 403 = 对方把 bot 屏蔽了 / 删除了聊天 → 清掉绑定,以后不用再试
    if (res.status === 403) {
      await supabaseAdmin.from('employees').update({ telegram_chat_id: null }).eq('telegram_chat_id', chatId)
    } else {
      console.error('[telegram] sendMessage failed', res.status, await res.text().catch(() => ''))
    }
    return false
  } catch (err) {
    console.error('[telegram] sendMessage error', err)
    return false
  } finally {
    clearTimeout(timer)
  }
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

/** 通知所有启用中、且已绑定 Telegram 的负责人(excludeEmployeeId:不通知某人自己) */
export async function notifyManagers(html: string, excludeEmployeeId?: string): Promise<void> {
  if (!BOT_TOKEN) return
  try {
    const { data } = await supabaseAdmin
      .from('employees')
      .select('id, telegram_chat_id')
      .eq('role', 'manager')
      .eq('is_active', true)
      .not('telegram_chat_id', 'is', null)
    const targets = (data || []).filter((m) => m.id !== excludeEmployeeId && m.telegram_chat_id)
    await Promise.allSettled(targets.map((m) => sendTelegram(m.telegram_chat_id as number, html)))
  } catch (err) {
    console.error('[telegram] notifyManagers error', err)
  }
}
