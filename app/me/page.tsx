'use client'

import { useRouter } from 'next/navigation'
import AuthStatus from '@/components/AuthStatus'
import { supabase } from '@/lib/supabaseClient'
import { useLang, LANG_OPTIONS } from '@/lib/lang'
import { useLeaveData } from '@/lib/useLeaveData'
import { getYearsOfService } from '@/lib/leaveRules'
import { Avatar, Card, EI, Hero, Icon, MenuRow, TabPage } from '@/components/employee/EmployeeShell'

// 员工手机版 · 我的(负责人用的是 /me,员工用这个)

export default function EmployeeMe() {
  const router = useRouter()
  const { auth, employee, unseenCount } = useLeaveData()
  const { lang, setLang, t } = useLang()
  if (auth.status !== 'ready') return <AuthStatus state={auth} />
  if (!employee) return null

  return (
    <TabPage tab="me" badge={unseenCount}>
      {/* 蓝色头部 + 头像卡(钉钉「我的」) */}
      <Hero className="!pb-16">
        <div className="flex items-center gap-4">
          <span className="rounded-full ring-2 ring-white/50"><Avatar name={employee.full_name} size={60} /></span>
          <div className="min-w-0">
            <p className="truncate text-xl font-semibold">{employee.full_name}</p>
            <p className="mt-1 flex flex-wrap gap-x-2 text-[13px] text-blue-100">
              {employee.employee_no ? <span>#{employee.employee_no}</span> : null}
              <span>{getYearsOfService(employee.date_of_commencement).toFixed(1)} {t('yearsOfService')}</span>
            </p>
          </div>
        </div>
      </Hero>

      <div className="relative -mt-10">
        <Card className="px-4 py-3 shadow-sm">
          <p className="mb-2 text-sm text-gray-500">{t('language')}</p>
          <div className="flex rounded-lg bg-gray-100 p-0.5">
            {LANG_OPTIONS.map(({ key: l, label }) => (
              <button key={l} onClick={() => setLang(l)} className={`flex-1 rounded-md py-2 text-sm ${lang === l ? 'bg-white font-semibold text-brand shadow-sm' : 'text-gray-600'}`}>
                {label}
              </button>
            ))}
          </div>
        </Card>

        <Card className="mt-3">
          <MenuRow icon={EI.key} tint="#1677FF" label={t('changePassword')} onClick={() => router.push('/change-password')} />
          <div className="ml-[3.75rem] border-t border-gray-100" />
          <MenuRow icon={EI.bell} tint="#722ED1" label={t('telegram')} onClick={() => router.push('/notifications')} />
        </Card>

        <Card className="mt-3">
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/') }} className="flex w-full items-center justify-center gap-2 py-3.5 text-[15px] font-medium text-st-rejected-text active:bg-red-50">
            <Icon d={EI.logout} size={20} />{t('logout')}
          </button>
        </Card>
      </div>
    </TabPage>
  )
}
