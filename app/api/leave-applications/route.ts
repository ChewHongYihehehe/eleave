import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  calculateLeaveDays,
  calculateWorkingDays,
  daysInYear,
  getEntitlementForYear,
  yearsSpanned,
  normalizeWorkWeek,
  LEAVE_TYPE_LABELS,
  type LeaveSpan,
} from '@/lib/leaveRules'
import { malaysiaToday, toLocalDateStr } from '@/lib/dateUtils'
import { logAudit } from '@/lib/auditLog'
import { appLink, esc, fmtDays, fmtRange, notifyEmployee, notifyManagers } from '@/lib/telegram'

// ─────────────────────────────────────────────────────────────────────────────
// 新增请假申请 —— 唯一能写入 leave_applications 的入口。
//
// 为什么要挪到这里(而不是让浏览器直接 supabase.insert):
// 额度够不够、日期有没有重叠,这些检查如果只在浏览器里的 React 代码做,
// 员工打开开发者工具直接呼叫 Supabase API 就能绕过去,想插入多少天都行。
// 这支 API 用 service role key 写入(supabaseAdmin,略过 RLS),
// 而 schema.sql 里 leave_applications 已经不再有任何 INSERT policy ——
// 也就是说浏览器用 anon key 现在插不进任何一笔申请,只能走这里。
//
// 两种模式,由 body 有没有带 employeeId 决定:
//   · 不带 employeeId → "自己申请":actor 就是申请人,状态 pending,不能选过去的日期
//   · 带 employeeId   → "负责人代员工登记"(例如事后补交 MC):actor 必须是启用中的负责人,
//                        状态直接是 approved,可以选过去的日期
// ─────────────────────────────────────────────────────────────────────────────

const LEAVE_TYPES = ['annual', 'medical', 'unpaid', 'maternity', 'paternity']

type ActorEmployee = {
  id: string
  role: string
  is_active: boolean
  employment_type: string
  date_of_commencement: string
  annual_leave_carry_forward: number
  annual_leave_entitlement_override: number | null
  full_name: string
}

async function getActor(request: NextRequest): Promise<ActorEmployee | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null
  const token = authHeader.replace(/^Bearer\s+/i, '')

  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return null

  const { data: emp } = await supabaseAdmin
    .from('employees')
    .select('id, role, is_active, employment_type, date_of_commencement, annual_leave_carry_forward, annual_leave_entitlement_override, full_name')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!emp || emp.is_active === false) return null
  return emp as ActorEmployee
}

export async function POST(request: NextRequest) {
  const actor = await getActor(request)
  if (!actor) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const requestedEmployeeId = body.employeeId == null ? null : String(body.employeeId)
  const isRecordMode = requestedEmployeeId !== null && requestedEmployeeId !== actor.id

  // 只有负责人能替别人登记;普通员工只能替自己提交(employeeId 留空,或等于自己的 id)
  if (isRecordMode && actor.role !== 'manager') {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  // 目标员工的资料(申请要用哪一份年资 / 结转天数来算额度)
  let target: {
    id: string
    date_of_commencement: string
    annual_leave_carry_forward: number
    annual_leave_entitlement_override: number | null
    employment_type: string
    is_active: boolean
    full_name: string
  }

  if (isRecordMode) {
    const { data: targetEmp } = await supabaseAdmin
      .from('employees')
      .select('id, date_of_commencement, annual_leave_carry_forward, annual_leave_entitlement_override, employment_type, is_active, full_name, is_owner')
      .eq('id', requestedEmployeeId)
      .maybeSingle()
    if (!targetEmp) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }
    if (targetEmp.is_owner) {
      return NextResponse.json({ error: 'This account is protected.' }, { status: 403 })
    }
    if (targetEmp.is_active === false) {
      return NextResponse.json({ error: 'This employee is deactivated.' }, { status: 400 })
    }
    if (targetEmp.employment_type !== 'full_time') {
      return NextResponse.json({
        error: 'This employee is part-time and does not have leave entitlements. Record their hours from the Work Hours page instead.',
      }, { status: 400 })
    }
    target = targetEmp
  } else {
    if (actor.employment_type !== 'full_time') {
      return NextResponse.json({ error: 'Part-time employees do not have system leave access.' }, { status: 403 })
    }
    target = actor
  }

  // ─── Validate input ────────────────────────────────────────────────────
  const leaveType = String(body.leave_type ?? '')
  const startDate = String(body.start_date ?? '')
  const endDate = String(body.end_date ?? '')
  const isHalfDay = body.is_half_day === true
  const halfDayPeriod = body.half_day_period === 'pm' ? 'pm' : body.half_day_period === 'am' ? 'am' : null
  const reason = body.reason == null ? '' : String(body.reason).trim()
  // MC 附件:病假才允许带,而且路径开头必须是这位员工的 id
  // (上传时 storage 的 RLS 已经挡过一次了,这里是双重确认,
  // 避免有人把别人文件夹底下的路径字符串硬塞进来)。
  const mcAttachmentPathRaw = body.mcAttachmentPath == null ? '' : String(body.mcAttachmentPath).trim()

  if (!LEAVE_TYPES.includes(leaveType)) {
    return NextResponse.json({ error: 'Invalid leave type' }, { status: 400 })
  }
  const dateRe = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRe.test(startDate) || (!isHalfDay && !dateRe.test(endDate))) {
    return NextResponse.json({ error: 'Please choose valid dates.' }, { status: 400 })
  }
  const actualEndDate = isHalfDay ? startDate : endDate
  if (isHalfDay && !halfDayPeriod) {
    return NextResponse.json({ error: 'Please choose AM or PM for a half day.' }, { status: 400 })
  }
  if (actualEndDate < startDate) {
    return NextResponse.json({ error: 'End date cannot be before start date.' }, { status: 400 })
  }
  let mcAttachmentPath: string | null = null
  if (mcAttachmentPathRaw) {
    if (leaveType !== 'medical') {
      return NextResponse.json({ error: 'An MC attachment can only be added to medical leave.' }, { status: 400 })
    }
    if (!mcAttachmentPathRaw.startsWith(`${target.id}/`)) {
      return NextResponse.json({ error: 'That attachment does not belong to this employee.' }, { status: 400 })
    }
    mcAttachmentPath = mcAttachmentPathRaw
  }
  // 自己申请:不能选过去的日期。负责人代员工登记时可以(例如事后补交 MC)。
  if (!isRecordMode) {
    const today = toLocalDateStr(malaysiaToday())
    if (startDate < today) {
      return NextResponse.json({ error: 'You cannot apply for a date in the past.' }, { status: 400 })
    }
  }

  // ─── Load holidays + work week (server-side, service role) ─────────────
  const { data: holidays, error: holidayError } = await supabaseAdmin
    .from('public_holidays')
    .select('holiday_date')
    .eq('is_enabled', true)
  if (holidayError) {
    return NextResponse.json({ error: 'Could not load public holidays. Please try again.' }, { status: 500 })
  }
  const holidayDates = (holidays || []).map((h) => h.holiday_date)

  const { data: wwRow } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', 'work_week')
    .maybeSingle()
  const workWeek = normalizeWorkWeek(wwRow?.value)

  // ─── Overlap + entitlement checks (the part that used to be client-side only) ──
  const spanYears = yearsSpanned(startDate, actualEndDate)
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('leave_applications')
    .select('leave_type, start_date, end_date, is_half_day, total_days')
    .eq('employee_id', target.id)
    .in('status', ['pending', 'approved'])
    .lte('start_date', `${spanYears[spanYears.length - 1]}-12-31`)
    .gte('end_date', `${spanYears[0]}-01-01`)
  if (existingError) {
    return NextResponse.json({ error: 'Could not check existing applications. Please try again.' }, { status: 500 })
  }
  const existingRows = (existing || []) as LeaveSpan[]

  const overlaps = existingRows.some((a) => startDate <= a.end_date && a.start_date <= actualEndDate)
  if (overlaps) {
    return NextResponse.json({
      error: isRecordMode
        ? `${target.full_name} already has a leave application that overlaps these dates.`
        : 'This overlaps with an existing leave application.',
    }, { status: 400 })
  }

  const totalDays =
    leaveType === 'annual'
      ? calculateWorkingDays(startDate, actualEndDate, isHalfDay, holidayDates, workWeek)
      : calculateLeaveDays(startDate, actualEndDate, isHalfDay)

  if (totalDays <= 0) {
    return NextResponse.json({
      error: 'The selected dates contain no working days (weekends / public holidays are not counted for annual leave).',
    }, { status: 400 })
  }

  if (leaveType !== 'unpaid') {
    const newSpan: LeaveSpan = { leave_type: leaveType, start_date: startDate, end_date: actualEndDate, is_half_day: isHalfDay, total_days: totalDays }
    for (const year of spanYears) {
      const baseEntitled = getEntitlementForYear(target, leaveType, year)
      if (baseEntitled === null) continue
      const isCurrentYear = year === malaysiaToday().getFullYear()
      const entitled = leaveType === 'annual' && isCurrentYear
        ? baseEntitled + (Number(target.annual_leave_carry_forward) || 0)
        : baseEntitled
      const used = existingRows
        .filter((a) => a.leave_type === leaveType)
        .reduce((sum, a) => sum + daysInYear(a, year, holidayDates, workWeek), 0)
      const requested = daysInYear(newSpan, year, holidayDates, workWeek)
      if (requested > 0 && used + requested > entitled) {
        const label = LEAVE_TYPE_LABELS[leaveType]
        const remaining = Math.max(entitled - used, 0).toFixed(1)
        return NextResponse.json({
          error: isRecordMode
            ? `Not enough ${label} balance for ${year}: ${target.full_name} has ${remaining} day(s) left but this uses ${requested.toFixed(1)}. If the extra days are beyond the entitlement, record them as Unpaid leave instead.`
            : `Insufficient ${label} balance for ${year}. You have ${remaining} day(s) left, but this request uses ${requested.toFixed(1)} day(s) in ${year}.`,
        }, { status: 400 })
      }
    }
  }

  // ─── Insert ──────────────────────────────────────────────────────────────
  type InsertRow = {
    employee_id: string
    leave_type: string
    start_date: string
    end_date: string
    is_half_day: boolean
    half_day_period: string | null
    total_days: number
    reason: string
    status: string
    approved_by?: string
    approved_at?: string
    remarks?: string
    mc_attachment_path?: string | null
    last_decision_at?: string | null
  }

  const insertRow: InsertRow = {
    employee_id: target.id,
    leave_type: leaveType,
    start_date: startDate,
    end_date: actualEndDate,
    is_half_day: isHalfDay,
    half_day_period: isHalfDay ? halfDayPeriod : null,
    total_days: totalDays,
    reason,
    status: isRecordMode ? 'approved' : 'pending',
    mc_attachment_path: mcAttachmentPath,
    last_decision_at: isRecordMode ? new Date().toISOString() : null,
  }
  if (isRecordMode) {
    insertRow.approved_by = actor.id
    insertRow.approved_at = new Date().toISOString()
    insertRow.remarks = 'Recorded by manager'
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('leave_applications')
    .insert(insertRow)
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: `Could not save: ${insertError.message}` }, { status: 400 })
  }

  if (isRecordMode) {
    await logAudit({
      actorId: actor.id,
      action: 'leave.recorded_by_manager',
      targetEmployeeId: target.id,
      leaveApplicationId: inserted.id,
      details: {
        leave_type: leaveType,
        start_date: startDate,
        end_date: actualEndDate,
        total_days: totalDays,
        mc_attached: !!mcAttachmentPath,
      },
    })
  } else {
    await logAudit({
      actorId: actor.id,
      action: 'leave.applied',
      targetEmployeeId: target.id,
      leaveApplicationId: inserted.id,
    })
  }

  // ─── Telegram 通知(失败不影响申请本身;见 lib/telegram.ts)───────────────
  const typeLabel = esc(LEAVE_TYPE_LABELS[leaveType] ?? leaveType)
  const when = `${fmtRange(startDate, actualEndDate, isHalfDay ? halfDayPeriod : null)} (${fmtDays(totalDays)})`
  if (isRecordMode) {
    await notifyEmployee(
      target.id,
      `📝 <b>Leave recorded for you</b>\nYour manager recorded ${typeLabel} leave:\n${when}\nStatus: approved`
    )
  } else {
    const link = appLink('/approve')
    await notifyManagers(
      [
        '🆕 <b>New leave request</b>',
        esc(target.full_name),
        `${typeLabel} · ${when}`,
        reason ? `Reason: ${esc(reason.slice(0, 200))}` : '',
        link ? `\nReview: ${link}` : '',
      ].filter(Boolean).join('\n'),
      actor.id,
      {
        applicationId: inserted.id,
        buttons: [
          { text: '✅ Approve', callback_data: `a:${inserted.id}` },
          { text: '❌ Reject', callback_data: `r:${inserted.id}` },
        ],
      }
    )
  }

  return NextResponse.json({ application: inserted })
}
