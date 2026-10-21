'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import AuthStatus from '@/components/AuthStatus'
import { Card, ConfirmSheet, SubPage, useToast } from '@/components/employee/EmployeeShell'
import { Avatar } from '@/components/manager/ManagerTabs'
import { useMgrT } from '@/lib/mgrText'
import { useStaff } from '@/lib/useStaff'
import { resetPassword, setActive, updateField } from '@/lib/employeesApi'

// 员工详情:改完要点"保存"才生效;停用 / 重置密码都有确认,不会误触。

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-h-[52px] items-center justify-between gap-4 border-t border-gray-100 px-4 first:border-t-0">
      <span className="shrink-0 text-[15px] text-gray-900">{label}</span>
      <span className="flex min-w-0 items-center justify-end text-[15px] text-gray-600">{children}</span>
    </label>
  )
}

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>()
  const { auth, me, staff, loading, reload } = useStaff()
  const { t } = useMgrT()
  const toast = useToast()
  const emp = staff.find((s) => s.id === id)

  const [date, setDate] = useState('')
  const [role, setRole] = useState('staff')
  const [override, setOverride] = useState('')
  const [carry, setCarry] = useState('')
  const [saving, setSaving] = useState(false)
  const [sheet, setSheet] = useState<null | 'active' | 'pwd'>(null)
  const [pwd, setPwd] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!emp) return
    setDate(emp.date_of_commencement)
    setRole(emp.role)
    setOverride(emp.annual_leave_entitlement_override == null ? '' : String(emp.annual_leave_entitlement_override))
    setCarry(String(emp.annual_leave_carry_forward ?? 0))
  }, [emp?.id, emp?.date_of_commencement, emp?.role, emp?.annual_leave_entitlement_override, emp?.annual_leave_carry_forward])

  if (auth.status !== 'ready') return <AuthStatus state={auth} />
  if (!emp) {
    return <SubPage title={t('employees')} backHref="/manage"><p className="py-20 text-center text-sm text-gray-400">{loading ? t('loading') : t('notFound')}</p></SubPage>
  }

  const full = emp.employment_type === 'full_time'
  const isSelf = emp.id === me?.id
  const changes: [string, string | number | null][] = []
  if (date && date !== emp.date_of_commencement) changes.push(['date_of_commencement', date])
  if (full) {
    if (role !== emp.role) changes.push(['role', role])
    const ov = override.trim() === '' ? null : Number(override)
    if (ov !== (emp.annual_leave_entitlement_override ?? null)) changes.push(['annual_leave_entitlement_override', ov])
    if (Number(carry) !== Number(emp.annual_leave_carry_forward)) changes.push(['annual_leave_carry_forward', Number(carry)])
  }

  async function save() {
    setSaving(true)
    for (const [f, v] of changes) {
      const err = await updateField(emp!.id, f, v)
      if (err) { setSaving(false); toast.show(err); await reload(); return }
    }
    setSaving(false)
    toast.show(t('saved'))
    reload()
  }

  async function toggleActive() {
    setBusy(true)
    const err = await setActive(emp!.id, !emp!.is_active)
    setBusy(false); setSheet(null)
    if (err) { toast.show(err); return }
    toast.show(t('toastOk')); reload()
  }

  async function doReset() {
    if (pwd.length < 6) { toast.show(t('min6')); return }
    setBusy(true)
    const err = await resetPassword(emp!.id, pwd)
    setBusy(false)
    if (err) { toast.show(err); return }
    setSheet(null); setPwd('')
    toast.show(t('pwdDone'))
  }

  const footer = (
    <button onClick={save} disabled={saving || changes.length === 0} className="w-full rounded-xl bg-brand py-3 text-base font-semibold text-white disabled:opacity-40">
      {saving ? t('loading') : t('save')}
    </button>
  )

  return (
    <SubPage title={emp.full_name} backHref="/manage" footer={footer}>
      <div className="flex flex-col items-center px-5 pb-4 pt-6">
        <Avatar name={emp.full_name} size={64} />
        <p className="mt-2 text-lg font-semibold text-gray-900">{emp.full_name}</p>
        <p className="text-sm text-gray-400">{emp.employee_no ? `#${emp.employee_no} · ` : ''}{full ? t('fullTime') : t('partTime')} · {emp.is_active ? t('active') : t('inactive')}</p>
      </div>

      <Card>
        <Row label={t('commencement')}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-transparent text-right" />
        </Row>
        {full && (
          <>
            <Row label={t('roleLabel')}>
              {isSelf ? (
                <span className="text-gray-400">{role === 'manager' ? t('roleManager') : t('roleStaff')}</span>
              ) : (
                <span className="flex rounded-lg bg-gray-100 p-0.5 text-sm">
                  {(['staff', 'manager'] as const).map((r) => (
                    <button key={r} type="button" onClick={() => setRole(r)} className={`rounded-md px-3 py-1 ${role === r ? 'bg-brand font-medium text-white' : 'text-gray-600'}`}>
                      {r === 'manager' ? t('roleManager') : t('roleStaff')}
                    </button>
                  ))}
                </span>
              )}
            </Row>
            <Row label={t('override')}>
              <input type="number" inputMode="decimal" step="0.5" value={override} onChange={(e) => setOverride(e.target.value)} placeholder="auto" className="w-20 bg-transparent text-right placeholder:text-gray-300" />
            </Row>
            <Row label={t('carryFwd')}>
              <input type="number" inputMode="decimal" step="0.5" value={carry} onChange={(e) => setCarry(e.target.value)} className="w-20 bg-transparent text-right" />
            </Row>
          </>
        )}
      </Card>

      {!full && <p className="mx-5 mt-3 text-xs text-gray-400">{t('noLogin')}</p>}

      <Card className="mt-3">
        {full && (
          <button onClick={() => { setPwd(''); setSheet('pwd') }} className="flex w-full items-center justify-between px-4 py-3.5 text-[15px] text-gray-900 active:bg-gray-50">
            {t('resetPassword')}<span className="text-gray-300">›</span>
          </button>
        )}
        {!isSelf && (
          <button onClick={() => setSheet('active')} className={`flex w-full items-center justify-between px-4 py-3.5 text-[15px] active:bg-gray-50 ${full ? 'border-t border-gray-100' : ''} ${emp.is_active ? 'text-[#F5222D]' : 'text-brand'}`}>
            {emp.is_active ? t('deactivate') : t('activate')}
          </button>
        )}
      </Card>

      <ConfirmSheet open={sheet === 'active'} danger={emp.is_active} busy={busy} title={emp.is_active ? t('confirmDeactivate') : t('confirmActivate')} confirmLabel={t('confirm')} onClose={() => setSheet(null)} onConfirm={toggleActive} />

      {sheet === 'pwd' && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/45" onClick={() => !busy && setSheet(null)}>
          <div className="mx-auto w-full max-w-md rounded-t-2xl bg-white" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }} onClick={(e) => e.stopPropagation()}>
            <div className="grid h-12 grid-cols-[4rem_1fr_4rem] items-center border-b border-gray-100 px-2">
              <button onClick={() => setSheet(null)} className="text-[15px] text-gray-500">{t('cancel')}</button>
              <p className="text-center text-base font-semibold text-gray-900">{t('resetPassword')}</p>
              <button onClick={doReset} disabled={busy} className="text-right text-[15px] font-semibold text-brand disabled:opacity-40">{t('confirm')}</button>
            </div>
            <div className="px-4 pt-3">
              <p className="mb-2 text-sm text-gray-500">{emp.full_name} · {t('min6')}</p>
              <input type="text" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder={t('newPassword')} className="w-full rounded-lg bg-gray-50 p-3 text-[15px] focus:outline-none" />
            </div>
          </div>
        </div>
      )}
      {toast.node}
    </SubPage>
  )
}
