import { supabase } from './supabaseClient'
import { calculateWorkingDays, type WorkWeek } from './leaveRules'
import { loadWorkWeek } from './settings'

type Scope =
  | { kind: 'date'; date: string }        // 公假被新增/停用/启用/删除:重算覆盖该日期的年假
  | { kind: 'from'; fromDate: string }    // 工作周改了:重算还没结束的年假

/**
 * 重新计算年假申请的 total_days(只处理 pending / approved 的年假,半天假不受影响)。
 * 用于:
 *  - 公假设定变动后,让已有的申请和新规则一致
 *  - 工作周设定变动后,让还没结束的申请和新规则一致
 * 返回被更新的笔数。
 */
export async function recalcAnnualLeave(
  scope: Scope,
  workWeekOverride?: WorkWeek
): Promise<{ updated: number; error?: string }> {
  let query = supabase
    .from('leave_applications')
    .select('id, start_date, end_date, is_half_day, total_days, remarks')
    .eq('leave_type', 'annual')
    .in('status', ['pending', 'approved'])
    .eq('is_half_day', false)

  if (scope.kind === 'date') {
    query = query.lte('start_date', scope.date).gte('end_date', scope.date)
  } else {
    query = query.gte('end_date', scope.fromDate)
  }

  const { data: apps, error } = await query
  if (error) return { updated: 0, error: error.message }
  if (!apps || apps.length === 0) return { updated: 0 }

  const { data: holidays, error: hErr } = await supabase
    .from('public_holidays')
    .select('holiday_date')
    .eq('is_enabled', true)
  if (hErr) return { updated: 0, error: hErr.message }

  const holidayDates = (holidays || []).map((h) => h.holiday_date)
  const workWeek = workWeekOverride ?? (await loadWorkWeek())

  let updated = 0
  for (const app of apps) {
    if (app.remarks && app.remarks.includes('Historical import')) continue
    const fresh = calculateWorkingDays(app.start_date, app.end_date, false, holidayDates, workWeek)
    if (fresh !== Number(app.total_days)) {
      const { error: uErr } = await supabase
        .from('leave_applications')
        .update({ total_days: fresh })
        .eq('id', app.id)
      if (uErr) return { updated, error: uErr.message }
      updated++
    }
  }
  return { updated }
}
