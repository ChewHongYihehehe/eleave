// 日期工具。
//
// 为什么不用 new Date('2026-01-01') / toISOString()?
// - new Date('YYYY-MM-DD') 会按 UTC 午夜解析,再用 getDay()/getDate() 读本地时间时,
//   在 UTC 以西的时区会差一天。
// - toISOString() 会换算成 UTC,马来西亚 (UTC+8) 当地 00:00~07:59 会变成"前一天"。
// 所以整个系统统一用下面两个函数:字串 <-> 本地日期,完全不经过 UTC。

/** "YYYY-MM-DD" -> 本地时间当天 00:00 的 Date */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Date -> "YYYY-MM-DD"(本地年月日) */
export function toLocalDateStr(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** 逐日遍历 [start, end](含头尾),回调收到本地 Date */
export function eachDay(startStr: string, endStr: string, fn: (d: Date, iso: string) => void) {
  const end = parseLocalDate(endStr)
  for (let d = parseLocalDate(startStr); d <= end; d.setDate(d.getDate() + 1)) {
    fn(d, toLocalDateStr(d))
  }
}
