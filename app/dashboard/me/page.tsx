'use client'

import { useRouter } from 'next/navigation'
import AuthStatus from '@/components/AuthStatus'
import { supabase } from '@/lib/supabaseClient'
import { useLang } from '@/lib/lang'
import { useLeaveData } from '@/lib/useLeaveData'
import { getYearsOfService } from '@/lib/leaveRules'
import { Card, EI, Icon, TabPage } from '@/components/employee/EmployeeShell'

// 员工手机版 · 我的(负责人用的是 /me,员工用这个)

export default function EmployeeMe() {
  const router = useRouter()
  const { auth, employee, unseenCount } = useLeaveData()
  const { lang, setLang, t } = useLang()
  if (auth.status !== 'ready') return <AuthStatus state={auth} />
  if (!employee) return null

  const initials = employee.full_name.trim().split(/\s+/).map((p, i, a) => (i === 0 || i === a.length - 1 ? p[0] : '')).join('').toUpperCase()
  const item = 'flex items-center gap-3 px-4 py-3.5 text-[15px] text-gray-900 active:bg-gray-50'

  return (
    <TabPage tab="me" badge={unseenCount}>
      <h1 className="px-4 pb-3 pt-5 text-xl font-semibold text-gray-900">{t('me')}</h1>

      <Card className="flex items-center gap-4 p-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-bold text-white">{initials}</div>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-gray-900">{employee.full_name}</p>
          <p className="text-sm text-gray-400">
            {employee.employee_no ? `#${employee.employee_no} · ` : ''}{getYearsOfService(employee.date_of_commencement).toFixed(1)} {t('yearsOfService')}
          </p>
        </div>
      </Card>

      <Card className="mt-3 px-4 py-3">
        <p className="mb-2 text-sm text-gray-500">{t('language')}</p>
        <div className="flex rounded-lg bg-gray-100 p-0.5">
          {(['zh', 'en'] as const).map((l) => (
            <button key={l} onClick={() => setLang(l)} className={`flex-1 rounded-md py-2 text-sm ${lang === l ? 'bg-brand font-medium text-white' : 'text-gray-600'}`}>
              {l === 'zh' ? '中文' : 'English'}
            </button>
          ))}
        </div>
      </Card>

      <Card className="mt-3">
        <button onClick={() => router.push('/change-password')} className={`${item} w-full`}>
          <Icon d={EI.key} size={20} className="text-gray-500" /><span className="flex-1 text-left">{t('changePassword')}</span><Icon d={EI.chevronR} size={16} className="text-gray-300" />
        </button>
        <button onClick={() => router.push('/notifications')} className={`${item} w-full border-t border-gray-100`}>
          <Icon d={EI.bell} size={20} className="text-gray-500" /><span className="flex-1 text-left">{t('telegram')}</span><Icon d={EI.chevronR} size={16} className="text-gray-300" />
        </button>
      </Card>

      <Card className="mt-3">
        <button onClick={async () => { await supabase.auth.signOut(); router.push('/') }} className="flex w-full items-center justify-center gap-2 py-3.5 text-[15px] font-medium text-[#F5222D] active:bg-red-50">
          <Icon d={EI.logout} size={20} />{t('logout')}
        </button>
      </Card>
    </TabPage>
  )
}
