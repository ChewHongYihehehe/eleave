'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { LEAVE_TYPE_LABELS } from '@/lib/leaveRules'
import { uploadMcFile, validateMcFile } from '@/lib/mcAttachments'

// 负责人替员工登记请假(例如病假事后补交 MC)。
// 登记后直接是"已批准",可以是过去的日期。
//
// 重叠检查和额度检查都交给服务器端的 /api/leave-applications 做
// (和员工自己申请时用的是同一支 API,同一套规则,只是多带一个 employeeId
// 表示"这是替别人登记",不会各自维护一份逻辑、也不怕被绕过校验)。

type Emp = {
  id: string
  employee_no: number | null
  full_name: string
}

export default function RecordLeaveModal({
  approverId,
  onClose,
  onSaved,
}: {
  approverId: string
  onClose: () => void
  onSaved: (employeeName: string) => void
}) {
  const [employees, setEmployees] = useState<Emp[]>([])
  const [ready, setReady] = useState(false)

  const [employeeId, setEmployeeId] = useState('')
  const [leaveType, setLeaveType] = useState('medical')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isHalfDay, setIsHalfDay] = useState(false)
  const [halfDayPeriod, setHalfDayPeriod] = useState<'am' | 'pm'>('am')
  const [reason, setReason] = useState('')
  const [mcFile, setMcFile] = useState<File | null>(null)
  const [mcFileError, setMcFileError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data, error: loadError } = await supabase
        .from('employees')
        .select('id, employee_no, full_name')
        .eq('is_active', true)
        .eq('is_owner', false)
        .eq('employment_type', 'full_time')
        .order('employee_no', { ascending: true })
      if (loadError) {
        setError('Could not load employee list. Please close and try again.')
        return
      }
      setEmployees((data || []) as Emp[])
      setReady(true)
    }
    load()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const emp = employees.find((x) => x.id === employeeId)
    if (!emp) { setError('Please choose an employee.'); return }
    if (!startDate) { setError('Please choose a start date.'); return }
    const actualEndDate = isHalfDay ? startDate : endDate
    if (!actualEndDate) { setError('Please choose an end date.'); return }
    if (actualEndDate < startDate) { setError('End date cannot be before start date.'); return }

    setSubmitting(true)

    // 病假如果选了 MC 文件,先传去 Storage(路径用目标员工的 id,不是经理自己的)
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
        end_date: actualEndDate,
        is_half_day: isHalfDay,
        half_day_period: isHalfDay ? halfDayPeriod : null,
        reason: reason.trim(),
        mcAttachmentPath,
      }),
    })
    const result = await res.json().catch(() => ({}))
    setSubmitting(false)

    if (!res.ok) {
      setError(result.error || 'Could not save. Please try again.')
      return
    }
    onSaved(emp.full_name)
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => !submitting && onClose()}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg font-semibold text-ink">Record leave for an employee</h2>
        <p className="mt-0.5 text-sm text-ink-soft">
          Saved as <strong>approved</strong> straight away. Past dates are allowed (e.g. an MC handed in afterwards).
        </p>

        {!ready && !error && <p className="mt-6 text-center text-sm text-ink-faint">Loading...</p>}

        {ready && (
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
            <div>
              <label className="field-label">Employee</label>
              <select required value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="field-input">
                <option value="">Choose...</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.employee_no ? `#${emp.employee_no} ` : ''}{emp.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label">Leave Type</label>
              <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} className="field-input">
                {Object.entries(LEAVE_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm text-ink-soft">
              <input
                type="checkbox"
                checked={isHalfDay}
                onChange={(e) => setIsHalfDay(e.target.checked)}
                className="h-4 w-4 rounded border-line text-pine focus:ring-pine"
              />
              Half day
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">{isHalfDay ? 'Date' : 'From'}</label>
                <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className="field-input" />
              </div>
              {isHalfDay ? (
                <div>
                  <label className="field-label">Period</label>
                  <select value={halfDayPeriod} onChange={(e) => setHalfDayPeriod(e.target.value as 'am' | 'pm')} className="field-input">
                    <option value="am">Morning (AM)</option>
                    <option value="pm">Afternoon (PM)</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="field-label">To</label>
                  <input type="date" required value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className="field-input" />
                </div>
              )}
            </div>

            <div>
              <label className="field-label">Reason / note (optional)</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. MC handed in on return"
                className="field-input"
              />
            </div>

            {leaveType === 'medical' && (
              <div>
                <label className="field-label">
                  MC <span className="font-normal text-ink-faint">(optional — photo or PDF, max 5MB)</span>
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null
                    if (f) {
                      const err = validateMcFile(f)
                      if (err) { setMcFileError(err); setMcFile(null); e.target.value = ''; return }
                    }
                    setMcFileError('')
                    setMcFile(f)
                  }}
                  className="field-input file:mr-3 file:rounded-md file:border-0 file:bg-paper file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-ink-soft"
                />
                {mcFileError && <p className="mt-1 text-xs text-rust">{mcFileError}</p>}
                {mcFile && !mcFileError && <p className="mt-1 text-xs text-ink-faint">Selected: {mcFile.name}</p>}
              </div>
            )}

            {error && <p className="rounded-md bg-rust-soft p-3 text-sm text-rust">{error}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={onClose}
                className="rounded-md bg-paper px-3 py-1.5 text-sm font-medium text-ink-soft ring-1 ring-line disabled:opacity-40"
              >
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? 'Saving...' : 'Save as approved'}
              </button>
            </div>
          </form>
        )}

        {!ready && error && (
          <>
            <p className="mt-4 rounded-md bg-rust-soft p-3 text-sm text-rust">{error}</p>
            <div className="mt-4 flex justify-end">
              <button onClick={onClose} className="rounded-md bg-paper px-3 py-1.5 text-sm font-medium text-ink-soft ring-1 ring-line">Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
