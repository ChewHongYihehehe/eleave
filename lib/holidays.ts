// 公假分组:每个公假可以标记「适用对象」,每位员工属于一个组别。
//  · applies_to = 'all'     → 全公司都放假
//  · applies_to = 'chinese' → 只有华人组员工放假
//  · applies_to = 'malay'   → 只有马来组员工放假
// 算年假天数、申请预览、重新计算,都要先用这里的函数挑出「这位员工适用的公假」。

export type HolidayGroup = 'chinese' | 'malay'
export type HolidayAppliesTo = 'all' | HolidayGroup

export const HOLIDAY_GROUPS: HolidayGroup[] = ['chinese', 'malay']

export type HolidayLike = {
  holiday_date: string
  applies_to?: string | null
}

/** 把数据库里读到的值整理成合法的组别;空值或乱值当作 chinese(和数据库默认值一致)。 */
export function normalizeHolidayGroup(v: unknown): HolidayGroup {
  return v === 'malay' ? 'malay' : 'chinese'
}

/** 这个公假是否适用于某个组别(没有 applies_to 的旧资料当作全公司)。 */
export function holidayAppliesToGroup(h: HolidayLike, group: unknown): boolean {
  const a = h.applies_to ?? 'all'
  return a === 'all' || a === normalizeHolidayGroup(group)
}

/** 某个组别适用的公假列表。 */
export function holidaysForGroup<T extends HolidayLike>(rows: T[], group: unknown): T[] {
  return rows.filter((h) => holidayAppliesToGroup(h, group))
}

/** 某个组别适用的公假日期(字符串数组,给 calculateWorkingDays 用)。 */
export function holidayDatesForGroup(rows: HolidayLike[], group: unknown): string[] {
  return holidaysForGroup(rows, group).map((h) => h.holiday_date)
}
