import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// 员工打开 dashboard、看过"有更新"的横幅之后,呼叫这支接口把时间记下来。
// 走服务器而不是让浏览器直接改 employees 表,是因为 employees 表目前没有开放
// 员工自己改自己资料的权限(安全考量),這支小接口只做这一件窄窄的事。
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  const token = authHeader.replace(/^Bearer\s+/i, '')

  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { data: me } = await supabaseAdmin
    .from('employees')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!me) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  await supabaseAdmin
    .from('employees')
    .update({ last_notifications_seen_at: new Date().toISOString() })
    .eq('id', me.id)

  return NextResponse.json({ ok: true })
}
