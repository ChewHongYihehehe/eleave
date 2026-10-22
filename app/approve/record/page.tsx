'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import AuthStatus from '@/components/AuthStatus'
import { Card, EI, Icon, SubPage, useToast } from '@/components/employee/EmployeeShell'
import DatePickerSheet from '@/components/DatePickerSheet'
import { supabase } from '@/lib/supabaseClient'
import { useEmployee } from '@/lib/useEmployee'
import { toLocalDateStr } from '@/lib/dateUtils'
import { fmtNum } from '@/lib/useLeaveData'
import { useMgrT, leaveName } from '@/lib/mgrText'
import { LEAVE_TYPE_LABELS, calculateLeaveDays, calculateWorkingDays, DEFAULT_WORK_WEEK, type WorkWeek } from '@/lib/leaveRules'
import { loadWorkWeek } from '@/lib/settings'
import { uploadMcFile, validateMcFile } from '@/lib/mcAttachments'

type Emp = {
  id: string
  employee_no: number | null
  full_name: string
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-h-[52px] items-center justify-between gap-4 border-t border-gray-100 px-4 first:border-t-0">
      <span className="shrink-0 text-[15px] text-gray-900">{label}</span>
      <span className="flex min-w-0 items-center justify-end gap-1 text-[15px] text-gray-600">{children}</span>
    </label>
  )
}

export default function RecordLeavePage() {
  const router = useRouter()
  const auth = useEmployee({ requireManager: true })
  const { t, lang } = useMgrT()
  const toast = useToast()
  const today = toLocalDateStr(new Date())

  const [employees, setEmployees] = useState<Emp[]>([])
  const [holidayDates, setHolidayDates] = useState<string[]>([])
  const [workWeek, setWorkWeek] = useState<WorkWeek>(DEFAULT_WORK_WEEK)
  const [ready, setReady] = useState(false)

  const [employeeId, setEmployeeId] = useState('')
  const [leaveType, setLeaveType] = useState('medical')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [isHalfDay, setIsHalfDay] = useState(false)
  const [halfDayPeriod, setHalfDayPeriod] = useState<'am' | 'pm'>('am')
  const [reason, setReason] = useState('')
  const [mcFile, setMcFile] = useState<File | null>(null)
  const [mcFileError, setMcFileError] = useState('')
  const [pickerTarget, setPickerTarget] = useState<'start' | 'end' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const [empRes, holRes, ww] = await Promise.all([
        supabase
          .from('employees')
          .select('id, employee_no, full_name')
          .eq('is_active', true)
          .eq('is_owner', false)
          .eq('employment_type', 'full_time')
          .order('employee_no', { ascending: true }),
        supabase.from('public_holidays').select('holiday_date').eq('is_enabled', true),
        loadWorkWeek(),
      ])

      if (empRes.error) {
        setError(lang === 'zh' ? '无法加载员工列表，请重试' : 'Could not load employee list. Please refresh.')
        return
      }

      const list = (empRes.data || []) as Emp[]
      setEmployees(list)
      if (list.length > 0) setEmployeeId(list[0].id)
      setHolidayDates((holRes.data || []).map((h) => h.holiday_date))
      setWorkWeek(ww)
      setReady(true)
    }
    load()
  }, [lang])

  const realEndDate = isHalfDay ? startDate : endDate

  const days = useMemo(() => {
    if (!startDate || !realEndDate || realEndDate < startDate) return null
    return leaveType === 'annual'
      ? calculateWorkingDays(startDate, realEndDate, isHalfDay, holidayDates, workWeek)
      : calculateLeaveDays(startDate, realEndDate, isHalfDay)
  }, [leaveType, startDate, realEndDate, isHalfDay, holidayDates, workWeek])

  if (auth.status !== 'ready') return <AuthStatus state={auth} />

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault()
    setError('')

    const emp = employees.find((x) => x.id === employeeId)
    if (!emp) {
      setError(lang === 'zh' ? '请选择员工' : 'Please choose an employee.')
      return
    }
    if (!startDate) {
      setError(lang === 'zh' ? '请选择开始日期' : 'Please choose a start date.')
      return
    }
    if (!realEndDate) {
      setError(lang === 'zh' ? '请选择结束日期' : 'Please choose an end date.')
      return
    }
    if (realEndDate < startDate) {
      setError(lang === 'zh' ? '结束日期不能早于开始日期' : 'End date cannot be before start date.')
      return
    }
    if (days !== null && days <= 0) {
      setError(lang === 'zh' ? '所选日期没有有效工作日' : 'Selected dates contain no working days.')
      return
    }

    setSubmitting(true)

    // 上传 MC 文件
    let mcAttachmentPath: string | undefined
    if (leaveType === 'medical' && mcFile) {
      const { path, error: uploadError } = await uploadMcFile(emp.id, mcFile)
      if (uploadError) {
        setError(uploadError)
        setSubmitting(false)
        return
      }
      mcAttachmentPath = path || undefined
    }

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/leave-applications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        employeeId: emp.id,
        leave_type: leaveType,
        start_date: startDate,
        end_date: realEndDate,
        is_half_day: isHalfDay,
        half_day_period: isHalfDay ? halfDayPeriod : null,
        reason: reason.trim(),
        mcAttachmentPath,
      }),
    })
    const result = await res.json().catch(() => ({}))
    setSubmitting(false)

    if (!res.ok) {
      setError(result.error || (lang === 'zh' ? '保存失败，请重试' : 'Could not save. Please try again.'))
      return
    }

    toast.show(lang === 'zh' ? `已为 ${emp.full_name} 代录请假并自动通过` : `Leave recorded for ${emp.full_name}.`)
    setTimeout(() => {
      router.replace('/approve')
    }, 600)
  }

  const footer = (
    <button
      onClick={() => handleSubmit()}
      disabled={submitting || !ready}
      className="w-full rounded-xl bg-brand py-3 text-base font-semibold text-white shadow-sm transition-all hover:bg-brand-deep active:scale-98 disabled:opacity-50"
    >
      {submitting
        ? (lang === 'zh' ? '保存中…' : 'Saving...')
        : (lang === 'zh' ? '保存并自动通过' : 'Save as approved')}
    </button>
  )

  return (
    <SubPage
      title={lang === 'zh' ? '代录请假' : 'Record Leave'}
      backHref="/approve"
      footer={footer}
    >
      {/* 顶部说明条 */}
      <div className="mx-4 mt-3 flex items-center justify-between rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800 ring-1 ring-emerald-500/15">
        <span>{lang === 'zh' ? '录入后直接生效为已批准，允许补录过去日期。' : 'Auto-approved upon saving. Past dates allowed.'}</span>
        <span className="shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 font-medium text-white text-[10px]">
          {lang === 'zh' ? '自动批准' : 'Auto-approved'}
        </span>
      </div>

      <div className="mt-3">
        <Card>
          {/* 选择员工 */}
          <Row label={lang === 'zh' ? '选择员工' : 'Employee'}>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="max-w-[13rem] appearance-none truncate bg-transparent text-right font-medium text-gray-900 focus:outline-none"
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.employee_no ? `#${emp.employee_no} ` : ''}{emp.full_name}
                </option>
              ))}
            </select>
            <Icon d={EI.chevronR} size={16} className="shrink-0 text-gray-300" />
          </Row>

          {/* 请假类型 */}
          <Row label={lang === 'zh' ? '请假类型' : 'Leave Type'}>
            <select
              value={leaveType}
              onChange={(e) => {
                setLeaveType(e.target.value)
                setMcFile(null)
                setMcFileError('')
              }}
              className="max-w-[13rem] appearance-none truncate bg-transparent text-right font-medium text-gray-900 focus:outline-none"
            >
              {Object.keys(LEAVE_TYPE_LABELS).map((k) => (
                <option key={k} value={k}>
                  {leaveName(k, lang)}
                </option>
              ))}
            </select>
            <Icon d={EI.chevronR} size={16} className="shrink-0 text-gray-300" />
          </Row>

          {/* 开始日期 */}
          <Row label={lang === 'zh' ? '开始日期' : 'Start Date'}>
            <button
              type="button"
              onClick={() => setPickerTarget('start')}
              className="flex items-center gap-1.5 text-right font-medium text-gray-900 active:opacity-60"
            >
              <span>{startDate || (lang === 'zh' ? '请选择' : 'Select')}</span>
              <Icon d={EI.chevronR} size={16} className="shrink-0 text-gray-300" />
            </button>
          </Row>

          {/* 结束日期 (全天时显示) */}
          {!isHalfDay && (
            <Row label={lang === 'zh' ? '结束日期' : 'End Date'}>
              <button
                type="button"
                onClick={() => setPickerTarget('end')}
                className="flex items-center gap-1.5 text-right font-medium text-gray-900 active:opacity-60"
              >
                <span>{endDate || (lang === 'zh' ? '请选择' : 'Select')}</span>
                <Icon d={EI.chevronR} size={16} className="shrink-0 text-gray-300" />
              </button>
            </Row>
          )}

          {/* 半天请假开关 */}
          <Row label={lang === 'zh' ? '半天请假' : 'Half Day'}>
            <button
              type="button"
              role="switch"
              aria-checked={isHalfDay}
              onClick={() => setIsHalfDay(!isHalfDay)}
              className={`relative h-7 w-12 rounded-full transition-colors duration-200 focus:outline-none ${
                isHalfDay ? 'bg-brand' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-all duration-200 ${
                  isHalfDay ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
          </Row>

          {/* 上下午时段选择按钮组 */}
          {isHalfDay && (
            <div className="flex gap-2 border-t border-gray-100 px-4 py-3">
              {(['am', 'pm'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setHalfDayPeriod(p)}
                  className={`flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
                    halfDayPeriod === p
                      ? 'bg-brand-soft font-semibold text-brand ring-1 ring-brand/20'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200/70'
                  }`}
                >
                  {p === 'am' ? (lang === 'zh' ? '上午 (AM)' : 'Morning (AM)') : (lang === 'zh' ? '下午 (PM)' : 'Afternoon (PM)')}
                </button>
              ))}
            </div>
          )}

          {/* 计算时长 */}
          <Row label={lang === 'zh' ? '请假天数' : 'Duration'}>
            <span className="text-base font-semibold text-gray-900">
              {days == null ? '–' : `${fmtNum(days)} ${t('daysUnit')}`}
            </span>
          </Row>
        </Card>

        {/* 年假工作日扣除说明 */}
        {leaveType === 'annual' && (
          <p className="mx-4 mt-2 px-1 text-xs text-gray-400">
            {lang === 'zh' ? '年假仅扣除工作日，周末与法定公假不计入天数。' : 'Annual leave counts working days only (weekends & holidays excluded).'}
          </p>
        )}

        {/* 病假 MC 凭证上传 */}
        {leaveType === 'medical' && (
          <Card className="mt-3">
            <label className="flex min-h-[52px] cursor-pointer items-center justify-between gap-4 px-4">
              <span className="shrink-0 text-[15px] text-gray-900">
                {lang === 'zh' ? '医生证明 (MC)' : 'Medical Certificate (MC)'}
              </span>
              <span className="flex max-w-[14rem] items-center gap-1.5 truncate text-[15px] font-medium text-brand">
                <Icon d={EI.clip} size={16} />
                <span className="truncate">
                  {mcFile ? mcFile.name : (lang === 'zh' ? '点击上传凭证' : 'Attach MC')}
                </span>
              </span>
              <input
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null
                  if (f) {
                    const bad = validateMcFile(f)
                    if (bad) {
                      setMcFileError(bad)
                      setMcFile(null)
                      e.target.value = ''
                      return
                    }
                  }
                  setMcFileError('')
                  setMcFile(f)
                }}
              />
            </label>
            {mcFile && (
              <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2 text-xs text-gray-500">
                <span className="truncate">{mcFile.name} ({(mcFile.size / 1024).toFixed(0)} KB)</span>
                <button
                  type="button"
                  onClick={() => setMcFile(null)}
                  className="shrink-0 font-medium text-[#F5222D] hover:underline"
                >
                  {lang === 'zh' ? '移除' : 'Remove'}
                </button>
              </div>
            )}
            {mcFileError && (
              <p className="border-t border-red-100 bg-red-50/50 px-4 py-2 text-xs text-[#F5222D]">
                {mcFileError}
              </p>
            )}
            <p className="px-4 pb-3 pt-1 text-xs text-gray-400">
              {lang === 'zh' ? '支持拍照、图片或 PDF，文件大小不超过 5MB' : 'Photo or PDF, max 5MB'}
            </p>
          </Card>
        )}

        {/* 备注卡片 */}
        <Card className="mt-3">
          <div className="px-4 py-3">
            <p className="mb-2 text-[15px] text-gray-900">
              {lang === 'zh' ? '事由 / 备注' : 'Reason / Note'}{' '}
              <span className="text-xs font-normal text-gray-400">({lang === 'zh' ? '选填' : 'optional'})</span>
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder={lang === 'zh' ? '例如: 补交MC、员工口头请假代录...' : 'e.g. MC handed in on return'}
              className="w-full resize-none bg-transparent text-[15px] text-gray-800 placeholder:text-gray-300 focus:outline-none"
            />
          </div>
        </Card>

        {/* 错误提示 */}
        {error && (
          <div className="mx-4 mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-[#F5222D]">
            {error}
          </div>
        )}
      </div>

      {/* 底部滑出的月历网格选择器 */}
      <DatePickerSheet
        open={pickerTarget === 'start'}
        title={lang === 'zh' ? '选择开始日期' : 'Select Start Date'}
        value={startDate}
        holidayDates={holidayDates}
        lang={lang}
        onSelect={(date) => {
          setStartDate(date)
          if (endDate && date > endDate) setEndDate(date)
        }}
        onClose={() => setPickerTarget(null)}
      />

      <DatePickerSheet
        open={pickerTarget === 'end'}
        title={lang === 'zh' ? '选择结束日期' : 'Select End Date'}
        value={endDate}
        min={startDate}
        holidayDates={holidayDates}
        lang={lang}
        onSelect={(date) => setEndDate(date)}
        onClose={() => setPickerTarget(null)}
      />

      {toast.node}
    </SubPage>
  )
}
