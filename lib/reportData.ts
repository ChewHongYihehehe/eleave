import {
  splitDaysByMonth,
  daysInYear,
  getEntitlementForYear,
  type WorkWeek,
} from './leaveRules'

// 报表页的计算逻辑(纯函数,不碰数据库/React),这样可以单独测试。
//
// 两条规则,刻意分开:
//  · 月报表(给算薪水的人看):只算"已批准"的假。待审批的还不确定,不能拿去扣钱/算薪水,
//    只会在页面上提醒"有 N 笔还没批"。
//  · 年度余额:待审批 + 已批准都算(跟员工自己 dashboard 上的"剩余天数"一致,
//    因为提交申请时系统检查额度也是把待审批的算进去的)。

export type ReportEmployee = {
  id: string
  employee_no: number | null
  full_name: string
  date_of_commencement: string
  employment_type: string
  is_active: boolean
  annual_leave_carry_forward: number
  annual_leave_entitlement_override?: number | null // 手动设定的年假额度(例如按比例计算),有的话优先于年资算出来的
  role?: string
}

export type ReportApp = {
  id: string
  employee_id: string
  leave_type: string
  start_date: string
  end_date: string
  is_half_day: boolean
  half_day_period: string | null
  total_days: number
  status: string
  cancellation_status: string
  remarks?: string | null
}

export type HoursRow = { employee_id: string; month: number; total_hours: number }

const pad = (n: number) => String(n).padStart(2, '0')

export function monthBounds(year: number, month: number) {
  const last = new Date(year, month, 0).getDate() // month 是 1-12,这样刚好是该月最后一天
  return { start: `${year}-${pad(month)}-01`, end: `${year}-${pad(month)}-${pad(last)}`, ym: `${year}-${pad(month)}` }
}

// ─── 月报表 ───────────────────────────────────────────────────────────────────

export type LeaveLine = { app: ReportApp; days: number } // days = 这一笔落在"这个月"里的天数

export type FullTimeMonthRow = {
  emp: ReportEmployee
  annual: number
  medical: number
  unpaid: number
  other: number // 产假 + 陪产假
  lines: LeaveLine[]
  cancellationRequested: boolean
}

export type PartTimeMonthRow = { emp: ReportEmployee; hours: number | null } // null = 这个月还没登记

export type MonthReport = {
  fullTime: FullTimeMonthRow[]
  partTime: PartTimeMonthRow[]
  pendingCount: number // 这个月里还没批准的申请笔数(没有算进上面的数字)
  cancellationCount: number // 已批准但员工申请取消、还没决定的笔数
  missingHoursCount: number
  totals: { annual: number; medical: number; unpaid: number; other: number; unpaidStaff: number; hours: number }
}

export function buildMonthReport(input: {
  year: number
  month: number
  employees: ReportEmployee[]
  apps: ReportApp[]
  hours: HoursRow[]
  holidayDates: string[]
  workWeek: WorkWeek
}): MonthReport {
  const { year, month, employees, apps, hours, holidayDates, workWeek } = input
  const { start, end, ym } = monthBounds(year, month)

  // 这个月里,每一笔申请各占几天(跨月的假只算落在这个月的那一段)
  const daysByApp = new Map<string, number>()
  const inMonth = apps.filter((a) => a.start_date <= end && a.end_date >= start)
  for (const a of inMonth) {
    daysByApp.set(a.id, splitDaysByMonth(a, holidayDates, workWeek)[ym] || 0)
  }

  const approvedByEmp = new Map<string, ReportApp[]>()
  let pendingCount = 0
  for (const a of inMonth) {
    if ((daysByApp.get(a.id) || 0) <= 0) continue
    if (a.status === 'pending') pendingCount++
    if (a.status === 'approved') {
      const list = approvedByEmp.get(a.employee_id) || []
      list.push(a)
      approvedByEmp.set(a.employee_id, list)
    }
  }

  const fullTime: FullTimeMonthRow[] = employees
    .filter((e) => e.employment_type === 'full_time' && e.date_of_commencement <= end)
    .map((emp) => {
      const lines: LeaveLine[] = (approvedByEmp.get(emp.id) || [])
        .sort((a, b) => a.start_date.localeCompare(b.start_date))
        .map((app) => ({ app, days: daysByApp.get(app.id) || 0 }))
      const sum = (types: string[]) =>
        lines.filter((l) => types.includes(l.app.leave_type)).reduce((s, l) => s + l.days, 0)
      return {
        emp,
        annual: sum(['annual']),
        medical: sum(['medical']),
        unpaid: sum(['unpaid']),
        other: sum(['maternity', 'paternity']),
        lines,
        cancellationRequested: lines.some((l) => l.app.cancellation_status === 'requested'),
      }
    })
    // 已停用的员工:当月如果还有假/工时记录就要显示(例如算上个月薪水时,人已经离职了)
    .filter((r) => r.emp.is_active || r.lines.length > 0)

  const hoursMap = new Map<string, number>()
  for (const h of hours) if (h.month === month) hoursMap.set(h.employee_id, Number(h.total_hours))

  const partTime: PartTimeMonthRow[] = employees
    .filter((e) => e.employment_type === 'part_time' && e.date_of_commencement <= end)
    .map((emp) => ({ emp, hours: hoursMap.has(emp.id) ? hoursMap.get(emp.id)! : null }))
    .filter((r) => r.emp.is_active || r.hours !== null)

  const totals = {
    annual: fullTime.reduce((s, r) => s + r.annual, 0),
    medical: fullTime.reduce((s, r) => s + r.medical, 0),
    unpaid: fullTime.reduce((s, r) => s + r.unpaid, 0),
    other: fullTime.reduce((s, r) => s + r.other, 0),
    unpaidStaff: fullTime.filter((r) => r.unpaid > 0).length,
    hours: partTime.reduce((s, r) => s + (r.hours ?? 0), 0),
  }

  return {
    fullTime,
    partTime,
    pendingCount,
    cancellationCount: fullTime.reduce((s, r) => s + r.lines.filter((l) => l.app.cancellation_status === 'requested').length, 0),
    missingHoursCount: partTime.filter((r) => r.emp.is_active && r.hours === null).length,
    totals,
  }
}

// ─── 年度余额 ─────────────────────────────────────────────────────────────────

export type YearFullTimeRow = {
  emp: ReportEmployee
  alEntitled: number // 年假额度(年资算出来的,或手动设定的 override),不含结转
  bf: number // 结转(只有"今年"才有)
  alTaken: number
  alApproved: number
  alPending: number
  alBalance: number
  mcEntitled: number
  mcTaken: number
  unpaid: number
  other: number
}

export type YearPartTimeRow = { emp: ReportEmployee; totalHours: number; monthsEntered: number }

export function buildYearReport(input: {
  year: number
  employees: ReportEmployee[]
  apps: ReportApp[] // 待审批 + 已批准
  hours: HoursRow[]
  holidayDates: string[]
  workWeek: WorkWeek
}): { fullTime: YearFullTimeRow[]; partTime: YearPartTimeRow[] } {
  const { year, employees, apps, hours, holidayDates, workWeek } = input
  const yearEnd = `${year}-12-31`

  const appsByEmp = new Map<string, ReportApp[]>()
  for (const a of apps) {
    if (a.status !== 'approved' && a.status !== 'pending') continue
    const list = appsByEmp.get(a.employee_id) || []
    list.push(a)
    appsByEmp.set(a.employee_id, list)
  }

  const thisYear = new Date().getFullYear()

  const fullTime: YearFullTimeRow[] = employees
    .filter((e) => e.employment_type === 'full_time' && e.date_of_commencement <= yearEnd)
    .map((emp) => {
      const mine = appsByEmp.get(emp.id) || []
      const taken = (type: string, status?: 'approved' | 'pending') =>
        mine
          .filter((a) => a.leave_type === type && (!status || a.status === status))
          .reduce((s, a) => s + daysInYear(a, year, holidayDates, workWeek), 0)
      // getEntitlementForYear 只回传"基础额度"(已包含 override),结转由这里自己加。
      // 结转只有一个栏位、代表"今年"从去年带过来的,所以只在看今年时才计入。
      const alEntitled = getEntitlementForYear(emp, 'annual', year) ?? 0
      const bf = year === thisYear ? Number(emp.annual_leave_carry_forward) || 0 : 0
      const alTaken = taken('annual')
      const alApproved = taken('annual', 'approved')
      const alPending = taken('annual', 'pending')
      return {
        emp,
        alEntitled,
        bf,
        alTaken,
        alApproved,
        alPending,
        alBalance: alEntitled + bf - alTaken,
        mcEntitled: getEntitlementForYear(emp, 'medical', year) ?? 0,
        mcTaken: taken('medical'),
        unpaid: taken('unpaid'),
        other: taken('maternity') + taken('paternity'),
      }
    })
    .filter((r) => r.emp.is_active || r.alTaken + r.mcTaken + r.unpaid + r.other > 0)

  const partTime: YearPartTimeRow[] = employees
    .filter((e) => e.employment_type === 'part_time' && e.date_of_commencement <= yearEnd)
    .map((emp) => {
      const mine = hours.filter((h) => h.employee_id === emp.id)
      return { emp, totalHours: mine.reduce((s, h) => s + Number(h.total_hours), 0), monthsEntered: mine.length }
    })
    .filter((r) => r.emp.is_active || r.monthsEntered > 0)

  return { fullTime, partTime }
}
