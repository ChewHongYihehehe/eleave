import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logAudit } from '@/lib/auditLog'

const INTERNAL_EMAIL_DOMAIN = 'purewaternature.local'
// 停用 = 把登录账号封禁约 100 年;启用 = 解除封禁
const BAN_FOREVER = '876000h'

// Confirms the request came from a logged-in, ACTIVE manager.
// Uses supabaseAdmin for both the JWT check and the role lookup so that RLS
// on the employees table doesn't interfere (the admin client bypasses RLS).
async function requireManager(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null

  const token = authHeader.replace(/^Bearer\s+/i, '')

  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return null

  const { data: me } = await supabaseAdmin
    .from('employees')
    .select('id, role, is_active')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!me || me.role !== 'manager' || me.is_active === false) return null
  return { user, employeeId: me.id as string }
}

function friendlyDbError(message: string): string {
  if (message.includes('employees_employee_no_unique')) {
    return 'This Staff ID number is already used by another employee.'
  }
  return message
}

export async function POST(request: NextRequest) {
  const manager = await requireManager(request)
  if (!manager) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const full_name = String(body.full_name ?? '').trim()
  const date_of_commencement = String(body.date_of_commencement ?? '')
  const employment_type = body.employment_type === 'part_time' ? 'part_time' : 'full_time'
  const staffIdRaw = body.staffId == null ? '' : String(body.staffId).trim()
  const password = body.password == null ? '' : String(body.password)

  if (!full_name || !/^\d{4}-\d{2}-\d{2}$/.test(date_of_commencement)) {
    return NextResponse.json({ error: 'Full name and a valid commencement date are required' }, { status: 400 })
  }

  // Staff ID 会存进 employees.employee_no(整数栏位),所以必须是纯数字。
  // (以前允许填 "PT001" 之类的字母,会变成 NaN 写入失败。)
  let employeeNo: number | null = null
  if (staffIdRaw) {
    if (!/^\d{1,9}$/.test(staffIdRaw)) {
      return NextResponse.json({ error: 'Staff ID must be a number (digits only), e.g. 003' }, { status: 400 })
    }
    employeeNo = Number(staffIdRaw)
  }

  // 同一个数字不能重复(001 和 1 会算成同一个)。数据库有唯一索引兜底,这里先给出友善提示。
  if (employeeNo !== null) {
    const { data: dup } = await supabaseAdmin
      .from('employees').select('id').eq('employee_no', employeeNo).maybeSingle()
    if (dup) {
      return NextResponse.json({ error: 'This Staff ID number is already used by another employee.' }, { status: 400 })
    }
  }

  // ─── Part-time: no login account needed ─────────────────────────────────
  if (employment_type === 'part_time') {
    const { data: employee, error: empError } = await supabaseAdmin
      .from('employees')
      .insert({
        // auth_user_id intentionally omitted (NULL) — no Supabase login account
        employee_no: employeeNo,
        full_name,
        date_of_commencement,
        employment_type: 'part_time',
        role: 'staff', // 兼职一律是 staff,不管前端传什么
      })
      .select()
      .single()

    if (empError) {
      return NextResponse.json({ error: friendlyDbError(empError.message) }, { status: 400 })
    }
    return NextResponse.json({ employee, partTime: true })
  }

  // ─── Full-time: create a Supabase auth login account ────────────────────
  if (employeeNo === null || !password) {
    return NextResponse.json({ error: 'Staff ID and password are required for full-time employees' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
  }
  const role = body.role === 'manager' ? 'manager' : 'staff'

  // 登录邮箱用管理员输入的原样数字(如 "003");上面已经保证 003 和 3 不能同时存在。
  const email = `${staffIdRaw.toLowerCase()}@${INTERNAL_EMAIL_DOMAIN}`

  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !authUser.user) {
    return NextResponse.json({ error: authError?.message || 'Could not create login' }, { status: 400 })
  }

  const { data: employee, error: empError } = await supabaseAdmin
    .from('employees')
    .insert({
      auth_user_id: authUser.user.id,
      employee_no: employeeNo,
      full_name,
      date_of_commencement,
      employment_type: 'full_time',
      role,
    })
    .select()
    .single()

  if (empError) {
    // Roll back the login account so we don't leave an orphaned auth user.
    const { error: delError } = await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
    const orphanNote = delError
      ? ` (Warning: the login account ${email} could not be removed automatically — delete it in Supabase → Authentication → Users.)`
      : ''
    return NextResponse.json({ error: friendlyDbError(empError.message) + orphanNote }, { status: 400 })
  }

  return NextResponse.json({ employee, staffId: staffIdRaw, email })
}

// 启用 / 停用员工:同时更新 employees.is_active 和登录账号的封禁状态,
// 这样停用的人真的登录不了(以前只是改了一个栏位,账号照常能登录)。
export async function PATCH(request: NextRequest) {
  const manager = await requireManager(request)
  if (!manager) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  let body: { id?: string; is_active?: boolean; field?: string; value?: string | number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  if (!body.id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  // ── 模式一:改单一栏位(日期/结转天数/职级,从 /manage 的表格 onBlur 过来)──
  // 挪到服务器处理,是为了能记一笔「谁、把什么从多少改成多少」的审计日志。
  if (typeof body.field === 'string') {
    const EDITABLE_FIELDS = ['date_of_commencement', 'annual_leave_carry_forward', 'annual_leave_entitlement_override', 'role']
    if (!EDITABLE_FIELDS.includes(body.field)) {
      return NextResponse.json({ error: 'That field cannot be edited this way.' }, { status: 400 })
    }
    const { data: before } = await supabaseAdmin
      .from('employees')
      .select('date_of_commencement, annual_leave_carry_forward, annual_leave_entitlement_override, role')
      .eq('id', body.id)
      .maybeSingle()
    if (!before) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }
    const { error: updError } = await supabaseAdmin
      .from('employees')
      .update({ [body.field]: body.value })
      .eq('id', body.id)
    if (updError) {
      return NextResponse.json({ error: friendlyDbError(updError.message) }, { status: 400 })
    }
    const fromValue = (before as unknown as Record<string, unknown>)[body.field]
    if (fromValue !== body.value) {
      await logAudit({
        actorId: manager.employeeId,
        action: 'employee.field_updated',
        targetEmployeeId: body.id,
        details: { field: body.field, from: fromValue, to: body.value },
      })
    }
    return NextResponse.json({ ok: true })
  }

  // ── 模式二:启用 / 停用(要同时处理登录账号封禁,原本就有)──
  if (typeof body.is_active !== 'boolean') {
    return NextResponse.json({ error: 'id and is_active (or id, field and value) are required' }, { status: 400 })
  }
  if (body.id === manager.employeeId && body.is_active === false) {
    return NextResponse.json({ error: 'You cannot deactivate your own account.' }, { status: 400 })
  }

  const { data: target } = await supabaseAdmin
    .from('employees')
    .select('id, auth_user_id, is_active')
    .eq('id', body.id)
    .maybeSingle()
  if (!target) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
  }

  // 先改登录账号,再改资料;资料写入失败就把封禁状态还原,避免两边不一致。
  if (target.auth_user_id) {
    const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(target.auth_user_id, {
      ban_duration: body.is_active ? 'none' : BAN_FOREVER,
    })
    if (banError) {
      return NextResponse.json({ error: `Could not update login account: ${banError.message}` }, { status: 400 })
    }
  }

  const { error: updError } = await supabaseAdmin
    .from('employees')
    .update({ is_active: body.is_active })
    .eq('id', body.id)

  if (updError) {
    if (target.auth_user_id) {
      await supabaseAdmin.auth.admin.updateUserById(target.auth_user_id, {
        ban_duration: target.is_active === false ? BAN_FOREVER : 'none',
      })
    }
    return NextResponse.json({ error: updError.message }, { status: 400 })
  }

  await logAudit({
    actorId: manager.employeeId,
    action: body.is_active ? 'employee.activated' : 'employee.deactivated',
    targetEmployeeId: body.id,
  })

  return NextResponse.json({ ok: true })
}

// 重置员工登录密码:负责人输入新密码,直接覆盖旧密码。
// 兼职员工没有登录账号,所以不能重置。
export async function PUT(request: NextRequest) {
  const manager = await requireManager(request)
  if (!manager) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  let body: { id?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const newPassword = body.password == null ? '' : String(body.password)
  if (!body.id) {
    return NextResponse.json({ error: 'Employee id is required' }, { status: 400 })
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
  }

  const { data: target } = await supabaseAdmin
    .from('employees')
    .select('id, auth_user_id')
    .eq('id', body.id)
    .maybeSingle()
  if (!target) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
  }
  if (!target.auth_user_id) {
    return NextResponse.json({ error: 'This employee has no login account (part-time), so there is no password to reset.' }, { status: 400 })
  }

  const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(target.auth_user_id, {
    password: newPassword,
  })
  if (pwError) {
    return NextResponse.json({ error: `Could not reset password: ${pwError.message}` }, { status: 400 })
  }

  await logAudit({
    actorId: manager.employeeId,
    action: 'employee.password_reset',
    targetEmployeeId: body.id,
  })

  return NextResponse.json({ ok: true })
}
