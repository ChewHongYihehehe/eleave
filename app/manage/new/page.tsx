'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import AuthStatus from '@/components/AuthStatus'
import { Card, SubPage } from '@/components/employee/EmployeeShell'
import { useMgrT } from '@/lib/mgrText'
import { useStaff } from '@/lib/useStaff'
import { addEmployee } from '@/lib/employeesApi'

// 新增员工(全屏表单)。兼职员工没有登录账号,不需要密码。
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-h-[52px] items-center justify-between gap-4 border-t border-gray-100 px-4 first:border-t-0">
      <span className="shrink-0 text-[15px] text-gray-900">{label}</span>
      <span className="flex min-w-0 items-center justify-end text-[15px] text-gray-600">{children}</span>
    </label>
  )
}

export default function NewEmployee() {
  const router = useRouter()
  const { auth } = useStaff()
  const { t } = useMgrT()
  const [type, setType] = useState<'full_time' | 'part_time'>('full_time')
  const [role, setRole] = useState<'staff' | 'manager'>('staff')
  const [staffId, setStaffId] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  if (auth.status !== 'ready') return <AuthStatus state={auth} />

  const part = type === 'part_time'
  async function submit() {
    setError('')
    if (!name.trim() || !date) return setError(t('required'))
    if (!part && (!/^[0-9]{1,9}$/.test(staffId) || password.length < 6)) return setError(`${t('staffId')}: ${t('digitsOnly')} · ${t('min6')}`)
    setBusy(true)
    const err = await addEmployee({
      staffId: part ? staffId || undefined : staffId,
      password: part ? undefined : password,
      full_name: name,
      date_of_commencement: date,
      employment_type: type,
      role: part ? 'staff' : role,
    })
    setBusy(false)
    if (err) return setError(err)
    router.replace('/manage')
  }

  const seg = (on: boolean) => `rounded-md px-3 py-1 ${on ? 'bg-brand font-medium text-white' : 'text-gray-600'}`
  const footer = (
    <button onClick={submit} disabled={busy} className="w-full rounded-xl bg-brand py-3 text-base font-semibold text-white disabled:opacity-50">{busy ? t('adding') : t('add')}</button>
  )

  return (
    <SubPage title={t('addEmployee')} backHref="/manage" footer={footer}>
      <div className="h-3" />
      <Card>
        <Row label={t('employmentType')}>
          <span className="flex rounded-lg bg-gray-100 p-0.5 text-sm">
            <button type="button" onClick={() => setType('full_time')} className={seg(type === 'full_time')}>{t('fullTime')}</button>
            <button type="button" onClick={() => { setType('part_time'); setRole('staff') }} className={seg(type === 'part_time')}>{t('partTime')}</button>
          </span>
        </Row>
        {!part && (
          <Row label={t('roleLabel')}>
            <span className="flex rounded-lg bg-gray-100 p-0.5 text-sm">
              <button type="button" onClick={() => setRole('staff')} className={seg(role === 'staff')}>{t('roleStaff')}</button>
              <button type="button" onClick={() => setRole('manager')} className={seg(role === 'manager')}>{t('roleManager')}</button>
            </span>
          </Row>
        )}
        <Row label={t('fullName')}><input value={name} onChange={(e) => setName(e.target.value)} className="w-44 bg-transparent text-right" /></Row>
        <Row label={part ? `${t('staffId')} (${t('optional')})` : t('staffId')}>
          <input inputMode="numeric" value={staffId} onChange={(e) => setStaffId(e.target.value)} placeholder="003" className="w-28 bg-transparent text-right placeholder:text-gray-300" />
        </Row>
        {!part && <Row label={t('initialPassword')}><input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="≥ 6" className="w-32 bg-transparent text-right placeholder:text-gray-300" /></Row>}
        <Row label={t('commencement')}><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-transparent text-right" /></Row>
      </Card>
      {part && <p className="mx-5 mt-3 text-xs text-gray-400">{t('noLogin')}</p>}
      {error && <p className="mx-4 mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-[#F5222D]">{error}</p>}
    </SubPage>
  )
}
