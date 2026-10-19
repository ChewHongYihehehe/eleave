import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { sendManagerReminders } from '@/lib/managerReminder'

// 由 Vercel Cron 每天呼叫一次(vercel.json:UTC 01:00 = 马来西亚 09:00;
// Vercel 免费版只保证"在那个钟点内"触发,所以实际是 9:00~9:59 之间)。
//
// 安全:这个网址在公网上,不能让任何人都能触发。Vercel 会自动带上
//   Authorization: Bearer <CRON_SECRET>
// (前提是你在 Vercel 的 Environment Variables 里设定了 CRON_SECRET)。
// 没设定 CRON_SECRET 时一律拒绝(宁可不发,也不开放)。
export const dynamic = 'force-dynamic'

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  const got = request.headers.get('authorization') || ''
  if (!secret) return false
  const a = Buffer.from(got)
  const b = Buffer.from(`Bearer ${secret}`)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ?force=1:手动测试用,略过"上班日 / 今天已发过"的检查(仍然需要上面的密钥)
  const force = new URL(request.url).searchParams.get('force') === '1'
  const result = await sendManagerReminders({ force })
  return NextResponse.json({ ok: true, ...result })
}
