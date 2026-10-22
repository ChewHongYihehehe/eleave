'use client'

import { useEffect, useMemo, useState } from 'react'
import { toLocalDateStr, parseLocalDate } from '@/lib/dateUtils'
import { EI, Icon } from '@/components/employee/EmployeeShell'

const WEEKDAYS_ZH = ['日', '一', '二', '三', '四', '五', '六']
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export interface DatePickerSheetProps {
  open: boolean
  title?: string
  value?: string // YYYY-MM-DD
  min?: string // YYYY-MM-DD
  max?: string // YYYY-MM-DD
  holidayDates?: string[]
  lang?: 'zh' | 'en'
  onSelect: (date: string) => void
  onClose: () => void
}

/**
 * 底部滑出式月历选择器 (钉钉移动端规范)
 * 支持点击日期格子选择、切换月份、今天快捷定位、公假标记以及根据 min/max 限制禁用。
 */
export default function DatePickerSheet({
  open,
  title,
  value,
  min,
  max,
  holidayDates = [],
  lang = 'zh',
  onSelect,
  onClose,
}: DatePickerSheetProps) {
  const todayStr = useMemo(() => toLocalDateStr(new Date()), [])

  // 当前浏览的年和月 (1-12)
  const [currentYear, setCurrentYear] = useState<number>(() => {
    if (value) return parseLocalDate(value).getFullYear()
    return new Date().getFullYear()
  })

  const [currentMonth, setCurrentMonth] = useState<number>(() => {
    if (value) return parseLocalDate(value).getMonth() + 1
    return new Date().getMonth() + 1
  })

  // 当外部 value 变化或打开时，将月份对准选中的日期或今天
  useEffect(() => {
    if (!open) return
    const target = value ? parseLocalDate(value) : (min ? parseLocalDate(min) : new Date())
    setCurrentYear(target.getFullYear())
    setCurrentMonth(target.getMonth() + 1)
  }, [open, value, min])

  if (!open) return null

  function handlePrevMonth() {
    if (currentMonth === 1) {
      setCurrentYear((y) => y - 1)
      setCurrentMonth(12)
    } else {
      setCurrentMonth((m) => m - 1)
    }
  }

  function handleNextMonth() {
    if (currentMonth === 12) {
      setCurrentYear((y) => y + 1)
      setCurrentMonth(1)
    } else {
      setCurrentMonth((m) => m + 1)
    }
  }

  function handleSelectToday() {
    if ((min && todayStr < min) || (max && todayStr > max)) return
    onSelect(todayStr)
    onClose()
  }

  // 构造当月日历网格
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate()
  const firstDayOfWeek = new Date(currentYear, currentMonth - 1, 1).getDay() // 0 = Sunday

  const displayTitle =
    lang === 'zh'
      ? `${currentYear}年${currentMonth}月`
      : `${MONTHS_EN[currentMonth - 1]} ${currentYear}`

  const weekdays = lang === 'zh' ? WEEKDAYS_ZH : WEEKDAYS_EN

  const isTodayDisabled = Boolean((min && todayStr < min) || (max && todayStr > max))

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 backdrop-blur-xs transition-opacity duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-white px-5 pt-3 shadow-2xl transition-transform duration-200"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部防误触抓手条 */}
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-200" />

        {/* 标题栏与关闭 */}
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900">
              {title || (lang === 'zh' ? '选择日期' : 'Select Date')}
            </h3>
            {value && (
              <span className="text-xs font-medium text-brand">
                {value}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 active:scale-95"
            aria-label="close"
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 年月导航条 */}
        <div className="flex items-center justify-between border-y border-gray-100 py-2.5">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 active:bg-gray-200"
              aria-label="Previous month"
            >
              <Icon d={EI.chevronL} size={16} />
            </button>
            <span className="px-1 text-base font-bold text-gray-900">
              {displayTitle}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 active:bg-gray-200"
              aria-label="Next month"
            >
              <Icon d={EI.chevronR} size={16} />
            </button>
          </div>

          <button
            type="button"
            disabled={isTodayDisabled}
            onClick={handleSelectToday}
            className="rounded-lg bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand transition-colors hover:bg-brand/15 disabled:opacity-30 disabled:pointer-events-none"
          >
            {lang === 'zh' ? '今天' : 'Today'}
          </button>
        </div>

        {/* 星期表头 */}
        <div className="mt-2 grid grid-cols-7 text-center text-xs font-medium text-gray-400">
          {weekdays.map((w, i) => (
            <div key={w} className={`py-1.5 ${i === 0 || i === 6 ? 'text-gray-400' : 'text-gray-500'}`}>
              {w}
            </div>
          ))}
        </div>

        {/* 日期网格 */}
        <div className="mt-1 grid grid-cols-7 gap-y-1">
          {/* 月前空白填充 */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="h-11" />
          ))}

          {/* 当月各天 */}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
            const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`
            const isSelected = dateStr === value
            const isToday = dateStr === todayStr
            const isDisabled = Boolean((min && dateStr < min) || (max && dateStr > max))
            const isHoliday = holidayDates.includes(dateStr)

            return (
              <div key={dateStr} className="flex h-11 items-center justify-center p-0.5">
                <button
                  type="button"
                  disabled={isDisabled}
                  onClick={() => {
                    onSelect(dateStr)
                    onClose()
                  }}
                  className={`relative flex h-10 w-10 flex-col items-center justify-center rounded-2xl text-[15px] font-semibold transition-all ${
                    isSelected
                      ? 'bg-brand text-white shadow-sm ring-2 ring-brand/20 scale-105'
                      : isToday
                      ? 'border border-brand/40 bg-brand-soft text-brand font-bold'
                      : isDisabled
                      ? 'text-gray-300 pointer-events-none opacity-40'
                      : 'text-gray-800 hover:bg-gray-100 active:scale-95'
                  }`}
                >
                  <span>{d}</span>
                  {/* 公假或今天圆点标识 */}
                  {isHoliday && !isSelected && (
                    <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[#C9A227]" />
                  )}
                  {isToday && !isSelected && !isHoliday && (
                    <span className="absolute bottom-1 h-1 w-1 rounded-full bg-brand" />
                  )}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
