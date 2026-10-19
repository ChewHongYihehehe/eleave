import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getActiveEmployee } from '@/lib/serverAuth'
import { checkPassword } from '@/lib/passwordPolicy'

// 员工(含负责人)自己改密码。
//
// 为什么放在服务器,而不是让浏览器直接 supabase.auth.updateUser:
//   1. "至少 8 个字符、不能太容易猜"这些规则,只有在服务器检查才真的挡得住;
//      浏览器里的检查,会写程序的人可以直接绕过去。
//   2. 改成功后要把 must_change_password 设回 false,这一步必须由可信的服务器来做,
//      不然员工自己就能把"强制改密码"的标记关掉。
export async function POST(request: NextRequest) {
  const me = await getActiveEmployee(request)
  if (!me || !me.auth_user_id) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  let newPassword = ''
  try {
    const body = await request.json()
    newPassword = body?.newPassword == null ? '' : String(body.newPassword)
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const problem = checkPassword(newPassword, { staffId: me.employee_no })
  if (problem) return NextResponse.json({ error: problem }, { status: 400 })

  // 新密码不能和现在的一样(强制改密码时,最常见的偷懒就是再输入一次初始密码)。
  // 做法:拿新密码试着登录一次 —— 登得进去,代表它就是现在的密码。
  const { data: authUserRes } = await supabaseAdmin.auth.admin.getUserById(me.auth_user_id)
  const email = authUserRes?.user?.email
  if (email) {
    const probe = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: attempt } = await probe.auth.signInWithPassword({ email, password: newPassword })
    if (attempt?.session) {
      return NextResponse.json({ error: 'Your new password must be different from your current one.' }, { status: 400 })
    }
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(me.auth_user_id, { password: newPassword })
  if (error) {
    return NextResponse.json({ error: 'Could not change the password. Please try again.' }, { status: 400 })
  }

  await supabaseAdmin.from('employees').update({ must_change_password: false }).eq('id', me.id)
  return NextResponse.json({ ok: true })
}
