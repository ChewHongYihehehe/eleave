'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import AuthStatus from '@/components/AuthStatus'
import { useLang, leaveTypeName } from '@/lib/lang'
import { useLeaveData, fmtNum } from '@/lib/useLeaveData'
import { calculateLeaveDays, calculateWorkingDays, LEAVE_TYPE_LABELS } from '@/lib/leaveRules'
import { toLocalDateStr } from '@/lib/dateUtils'
import { validateMcFile } from '@/lib/mcAttachments'
import { submitApplication } from '@/lib/employeeActions'
import { Card, EI, Icon, SubPage } from '@/components/employee/EmployeeShell'
import DatePickerSheet from '@/components/DatePickerSheet'

// 申请请假(全屏表单,钉钉样式):一行一项,时长自动算,底部固定提交按钮。
// 这里的天数/余额只是"预览";真正的检查在服务器 /api/leave-applications。

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-h-[52px] items-center justify-between gap-4 border-t border-gray-100 px-4 first:border-t-0">
      <span className="shrink-0 text-[15px] text-gray-900">{label}</span>
      <span className="flex min-w-0 items-center gap-1 text-[15px] text-gray-600">{children}</span>
    </label>
  )
}

export default function ApplyPage() {
  const router = useRouter()
  const { auth, employee, balances, holidayDates, workWeek } = useLeaveData()
  const { lang, t } = useLang()
  const today = toLocalDateStr(new Date())

  const [type, setType] = useState('annual')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [half, setHalf] = useState(false)
  const [period, setPeriod] = useState<'am' | 'pm'>('am')
  const [reason, setReason] = useState('')
  const [mc, setMc] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pickerTarget, setPickerTarget] = useState<'start' | 'end' | null>(null)

  const realEnd = half ? start : end
  const days = useMemo(() => {
    if (!start || !realEnd || realEnd < start) return null
    return type === 'annual'
      ? calculateWorkingDays(start, realEnd, half, holidayDates, workWeek)
      : calculateLeaveDays(start, realEnd, half)
  }, [type, start, realEnd, half, holidayDates, workWeek])

  if (auth.status !== 'ready') return <AuthStatus state={auth} />

  const bal = balances.find((b) => b.type === type)
  const after = bal && days != null ? bal.remaining - days : null

  async function submit() {
    if (!employee) return
    setError('')
    if (!start || !realEnd) return setError(t('chooseDates'))
    if (realEnd < start) return setError(t('endBeforeStart'))
    setBusy(true)
    const err = await submitApplication({
      employeeId: employee.id, leaveType: type, startDate: start, endDate: realEnd,
      isHalfDay: half, halfDayPeriod: period, reason, mcFile: mc,
    })
    setBusy(false)
    if (err) return setError(err)
    router.replace('/dashboard/records?toast=submitted')
  }

  const footer = (
    <button onClick={submit} disabled={busy} className="w-full rounded-xl bg-brand py-3 text-base font-semibold text-white disabled:opacity-50">
      {busy ? t('submitting') : t('submit')}
    </button>
  )

  return (
    <SubPage title={t('applyLeave')} backHref="/dashboard" footer={footer}>
      <div className="h-3" />
      <Card>
        <Row label={t('leaveType')}>
          <select value={type} onChange={(e) => { setType(e.target.value); setMc(null) }} className="max-w-[12rem] appearance-none truncate bg-transparent text-right">
            {Object.keys(LEAVE_TYPE_LABELS).map((k) => <option key={k} value={k}>{leaveTypeName(k, lang)}</option>)}
          </select>
          <Icon d={EI.chevronR} size={16} className="shrink-0 text-gray-300" />
        </Row>
        <Row label={t('startDate')}>
          <button
            type="button"
            onClick={() => setPickerTarget('start')}
            className="flex items-center gap-1.5 text-right font-medium text-gray-900 active:opacity-60"
          >
            <span>{start || t('chooseDates')}</span>
            <Icon d={EI.chevronR} size={16} className="shrink-0 text-gray-300" />
          </button>
        </Row>
        {!half && (
          <Row label={t('endDate')}>
            <button
              type="button"
              onClick={() => setPickerTarget('end')}
              className="flex items-center gap-1.5 text-right font-medium text-gray-900 active:opacity-60"
            >
              <span>{end || t('chooseDates')}</span>
              <Icon d={EI.chevronR} size={16} className="shrink-0 text-gray-300" />
            </button>
          </Row>
        )}
        <Row label={t('halfDay')}>
          <button
            type="button" role="switch" aria-checked={half} onClick={() => setHalf(!half)}
            className={`relative h-7 w-12 rounded-full transition-colors ${half ? 'bg-brand' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${half ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </Row>
        {half && (
          <div className="flex gap-2 border-t border-gray-100 px-4 py-3">
            {(['am', 'pm'] as const).map((p) => (
              <button key={p} type="button" onClick={() => setPeriod(p)} className={`flex-1 rounded-lg py-2 text-sm ${period === p ? 'bg-brand-soft font-medium text-brand' : 'bg-gray-100 text-gray-600'}`}>
                {p === 'am' ? t('am') : t('pm')}
              </button>
            ))}
          </div>
        )}
        <Row label={t('duration')}>
          <span className="font-semibold text-gray-900">{days == null ? '–' : `${fmtNum(days)} ${t('daysUnit')}`}</span>
        </Row>
      </Card>

      {(type === 'annual' || (bal && days != null)) && (
        <div className="mx-4 mt-2 space-y-0.5 px-1 text-xs">
          {type === 'annual' && <p className="text-gray-400">{t('annualNote')}</p>}
          {bal && after != null && (
            <p className={after < 0 ? 'font-medium text-[#F5222D]' : 'text-gray-500'}>
              {after < 0 ? `${t('exceeds')} · ` : ''}{t('afterwards')}: {fmtNum(after)} {t('daysUnit')}
            </p>
          )}
        </div>
      )}

      {type === 'medical' && (
        <Card className="mt-3">
          <Row label="MC">
            <span className="flex items-center gap-1 text-brand">
              <Icon d={EI.clip} size={16} />
              <span className="max-w-[11rem] truncate">{mc ? mc.name : t('attachMc')}</span>
            </span>
            <input
              type="file" className="hidden"
              accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
              onChange={(e) => {
                const f = e.target.files?.[0] || null
                if (f) { const bad = validateMcFile(f); if (bad) { setError(bad); setMc(null); e.target.value = ''; return } }
                setError(''); setMc(f)
              }}
            />
          </Row>
          <p className="px-4 pb-3 text-xs text-gray-400">{t('mcLabel')}</p>
        </Card>
      )}

      <Card className="mt-3">
        <div className="px-4 py-3">
          <p className="mb-2 text-[15px] text-gray-900">{t('note')}</p>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder={t('notePh')} className="w-full resize-none bg-transparent text-[15px] text-gray-800 placeholder:text-gray-300 focus:outline-none" />
        </div>
      </Card>

      {error && <p className="mx-4 mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-[#F5222D]">{error}</p>}

      {/* 底部滑出的月历网格选择器 */}
      <DatePickerSheet
        open={pickerTarget === 'start'}
        title={t('startDate')}
        value={start}
        min={today}
        holidayDates={holidayDates}
        lang={lang}
        onSelect={(date) => {
          setStart(date)
          if (end && date > end) setEnd(date)
        }}
        onClose={() => setPickerTarget(null)}
      />

      <DatePickerSheet
        open={pickerTarget === 'end'}
        title={t('endDate')}
        value={end}
        min={start || today}
        holidayDates={holidayDates}
        lang={lang}
        onSelect={(date) => setEnd(date)}
        onClose={() => setPickerTarget(null)}
      />
    </SubPage>
  )
}
