// Malaysia Employment Act - leave entitlement helper logic

import { eachDay, malaysiaToday, parseLocalDate, toLocalDateStr } from './dateUtils'

// ─── 年资 ────────────────────────────────────────────────────────────────────

/**
 * 到 asOf 为止的年资(小数,仅用于显示)。
 * 按"周年日"计算:满 N 个周年 + 当前这一年已过的比例。
 * 不再用 365.25 天估算,所以周年当天就会准确跳档,不会提前或延后。
 */
export function getYearsOfService(dateOfCommencement: string, asOf: Date = malaysiaToday()): number {
  const start = parseLocalDate(dateOfCommencement)
  if (asOf < start) return 0

  let full = asOf.getFullYear() - start.getFullYear()
  let lastAnniversary = new Date(start.getFullYear() + full, start.getMonth(), start.getDate())
  if (lastAnniversary > asOf) {
    full -= 1
    lastAnniversary = new Date(start.getFullYear() + full, start.getMonth(), start.getDate())
  }
  const nextAnniversary = new Date(start.getFullYear() + full + 1, start.getMonth(), start.getDate())
  const fraction =
    (asOf.getTime() - lastAnniversary.getTime()) /
    (nextAnniversary.getTime() - lastAnniversary.getTime())
  return full + fraction
}

/**
 * 计算某个"请假年度"的额度时,用哪一天来算年资:
 *  - 过去的年度 → 该年 12 月 31 日(那一年结束时的年资)
 *  - 今年       → 今天
 *  - 未来的年度 → 该年 1 月 1 日
 * 这样看去年的报表不会被"今天的年资"影响,今年的额度也保持和以前一致。
 */
export function getEntitlementReferenceDate(year: number, today: Date = malaysiaToday()): Date {
  const thisYear = today.getFullYear()
  if (year < thisYear) return new Date(year, 11, 31)
  if (year > thisYear) return new Date(year, 0, 1)
  return today
}

export function getYearsOfServiceForYear(dateOfCommencement: string, year: number): number {
  return getYearsOfService(dateOfCommencement, getEntitlementReferenceDate(year))
}

export function getAnnualLeaveEntitlement(yearsOfService: number): number {
  if (yearsOfService < 2) return 8
  if (yearsOfService < 5) return 12
  return 16
}

export function getMedicalLeaveEntitlement(yearsOfService: number): number {
  if (yearsOfService < 2) return 14
  if (yearsOfService < 5) return 18
  return 22
}

// NOTE: maternity/paternity leave under Malaysian law is granted per
// confinement/child, not per calendar year. This system enforces the
// entitlement as a per-calendar-year cap for simplicity — if an employee
// has two confinements in one year (rare), the manager may need to
// manually approve beyond the cap via Supabase directly.
export const FIXED_LEAVE_ENTITLEMENTS = {
  maternity: 98,
  paternity: 7,
  public_holiday: 11,
}

export const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: 'Annual Leave (AL)',
  medical: 'Medical Leave (MC)',
  unpaid: 'Unpaid Leave',
  maternity: 'Maternity Leave',
  paternity: 'Paternity Leave',
}

/**
 * 某员工在 year 年度的某假种的「基础额度」(不含进位 carry-forward)。
 * · 若员工有设 annual_leave_entitlement_override,annual 假种优先用那个值。
 * · carry-forward 由调用方自行加上,避免双重计算。
 */
export function getEntitlementForYear(
  emp: { date_of_commencement: string; annual_leave_carry_forward: number; annual_leave_entitlement_override?: number | null },
  leaveType: string,
  year: number
): number | null {
  const years = getYearsOfServiceForYear(emp.date_of_commencement, year)
  if (leaveType === 'annual') {
    // 若负责人手动设置了 override,优先用(适合 prorated 或特殊情况)
    if (emp.annual_leave_entitlement_override != null) return Number(emp.annual_leave_entitlement_override)
    return getAnnualLeaveEntitlement(years)
  }
  if (leaveType === 'medical') return getMedicalLeaveEntitlement(years)
  if (leaveType === 'maternity') return FIXED_LEAVE_ENTITLEMENTS.maternity
  if (leaveType === 'paternity') return FIXED_LEAVE_ENTITLEMENTS.paternity
  return null
}

// ─── 工作周(哪几天算上班) ──────────────────────────────────────────────────

/**
 * 每个星期几算多少个"工作日"。key: 0=周日 … 6=周六。
 * 1 = 全天上班,0.5 = 上半天班,0 = 休息。
 * 预设周一到周五全天、周六日休息;负责人可以在 Holidays 页面修改。
 */
export type WorkWeek = Record<number, number>

export const DEFAULT_WORK_WEEK: WorkWeek = { 0: 0, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 0 }

export function normalizeWorkWeek(raw: unknown): WorkWeek {
  const out: WorkWeek = { ...DEFAULT_WORK_WEEK }
  if (raw && typeof raw === 'object') {
    for (let i = 0; i <= 6; i++) {
      const v = Number((raw as Record<string, unknown>)[String(i)])
      if (v === 0 || v === 0.5 || v === 1) out[i] = v
    }
  }
  return out
}

// ─── 天数计算 ────────────────────────────────────────────────────────────────

// 病假 / 无薪假 / 产假 / 陪产假:算日历天(含周末和公假)
export function calculateLeaveDays(startDate: string, endDate: string, isHalfDay: boolean): number {
  if (isHalfDay) return 0.5
  let count = 0
  eachDay(startDate, endDate, () => { count++ })
  return count
}

// 年假:按工作周计算,排除休息日和公假
export function calculateWorkingDays(
  startDate: string,
  endDate: string,
  isHalfDay: boolean,
  publicHolidayDates: string[],
  workWeek: WorkWeek = DEFAULT_WORK_WEEK
): number {
  const holidaySet = new Set(publicHolidayDates)
  if (isHalfDay) {
    // 半天假也要落在"上班日"才算:周六日(休息日)或公假请半天,不扣年假,
    // 回传 0 会让申请被挡下("没有工作日")。
    const day = parseLocalDate(startDate)
    if (holidaySet.has(startDate) || (workWeek[day.getDay()] ?? 0) === 0) return 0
    return 0.5
  }
  let count = 0
  eachDay(startDate, endDate, (d, iso) => {
    if (!holidaySet.has(iso)) count += workWeek[d.getDay()] ?? 0
  })
  return count
}

export type LeaveSpan = {
  leave_type: string
  start_date: string
  end_date: string
  is_half_day: boolean
  total_days: number
}

/**
 * 把一笔申请的天数拆到各个月份,返回 { 'YYYY-MM': 天数 }。
 * 跨月、跨年的假会正确分摊,报表和额度检查都用它。
 * 规则和申请时一致:年假按工作周+公假;其他假种按日历天;半天假记 0.5 在开始那天。
 */
export function splitDaysByMonth(
  app: LeaveSpan,
  publicHolidayDates: string[],
  workWeek: WorkWeek = DEFAULT_WORK_WEEK
): Record<string, number> {
  const out: Record<string, number> = {}
  if (!app || !app.start_date || !app.end_date) return out
  const totalDays = Number(app.total_days || 0)
  const startYm = app.start_date.slice(0, 7)
  const endYm = app.end_date.slice(0, 7)

  // 半天假,或整笔假都在同一个月份里:直接以记录的 total_days 为准
  // (避免历史导入的占位日期、或公假/工作周规则变动导致已批准的天数被错误重算)
  if (app.is_half_day || startYm === endYm) {
    out[startYm] = totalDays
    return out
  }

  // 跨月的假:按每个月包含的工作日/日历天数比例分摊已记录的 total_days
  const holidaySet = new Set(publicHolidayDates)
  const isAnnual = app.leave_type === 'annual'
  const raw: Record<string, number> = {}
  let rawTotal = 0

  eachDay(app.start_date, app.end_date, (d, iso) => {
    const w = isAnnual ? (holidaySet.has(iso) ? 0 : workWeek[d.getDay()] ?? 0) : 1
    if (w > 0) {
      const ym = iso.slice(0, 7)
      raw[ym] = (raw[ym] || 0) + w
      rawTotal += w
    }
  })

  if (rawTotal > 0 && totalDays > 0) {
    for (const [ym, cnt] of Object.entries(raw)) {
      out[ym] = (cnt / rawTotal) * totalDays
    }
  } else if (rawTotal > 0) {
    Object.assign(out, raw)
  } else {
    out[startYm] = totalDays
  }

  return out
}

/** 一笔申请落在 year 年内的天数 */
export function daysInYear(
  app: LeaveSpan,
  year: number,
  publicHolidayDates: string[],
  workWeek: WorkWeek = DEFAULT_WORK_WEEK
): number {
  if (!app || !app.start_date || !app.end_date) return 0
  const startYear = Number(app.start_date.slice(0, 4))
  const endYear = Number(app.end_date.slice(0, 4))

  // 整笔假都在同一年内:直接以记录的 total_days 为准
  if (startYear === year && endYear === year) {
    return Number(app.total_days || 0)
  }

  // 跨年度的假:通过 splitDaysByMonth 汇总结算落入该年份的天数
  const prefix = `${year}-`
  return Object.entries(splitDaysByMonth(app, publicHolidayDates, workWeek))
    .filter(([ym]) => ym.startsWith(prefix))
    .reduce((s, [, v]) => s + v, 0)
}

/** 申请跨越了哪几个年度 */
export function yearsSpanned(startDate: string, endDate: string): number[] {
  const a = Number(startDate.slice(0, 4))
  const b = Number(endDate.slice(0, 4))
  const out: number[] = []
  for (let y = a; y <= b; y++) out.push(y)
  return out
}

export { toLocalDateStr }
