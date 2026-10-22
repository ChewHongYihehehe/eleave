'use client'

import { useRouter } from 'next/navigation'
import AuthStatus from '@/components/AuthStatus'
import { Card, EI, Icon } from '@/components/employee/EmployeeShell'
import { supabase } from '@/lib/supabaseClient'
import { useEmployee } from '@/lib/useEmployee'
import { useLang } from '@/lib/lang'
import { useMgrT } from '@/lib/mgrText'
import { Avatar, ManagerTabPage } from './ManagerTabs'

export default function MobileMe() {
  const auth = useEmployee({ requireManager: true })
  const router = useRouter()
  const { setLang } = useLang()
  const { t, lang } = useMgrT()
  if (auth.status !== 'ready') return <AuthStatus state={auth} />
  const emp = auth.employee
  const item = 'flex w-full items-center gap-3 px-4 py-3.5 text-[15px] text-gray-900 active:bg-gray-50'

  return (
    <ManagerTabPage tab="me">
      <h1 className="px-4 pb-3 pt-5 text-xl font-semibold text-gray-900">{t('me')}</h1>

      <Card className="flex items-center gap-4 p-4">
        <Avatar name={emp.full_name} size={56} />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-gray-900">{emp.full_name}</p>
          <p className="text-sm text-gray-500">{emp.employee_no ? `#${emp.employee_no} · ` : ''}{t('manager')}</p>
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
        <button onClick={() => router.push('/change-password')} className={item}>
          <Icon d={EI.key} size={20} className="text-gray-500" /><span className="flex-1 text-left">{t('changePassword')}</span><Icon d={EI.chevronR} size={16} className="text-gray-300" />
        </button>
        <button onClick={() => router.push('/notifications')} className={`${item} border-t border-gray-100`}>
          <Icon d={EI.bell} size={20} className="text-gray-500" /><span className="flex-1 text-left">{t('telegram')}</span><Icon d={EI.chevronR} size={16} className="text-gray-300" />
        </button>
      </Card>

      <Card className="mt-3">
        <button onClick={async () => { await supabase.auth.signOut(); router.push('/') }} className="flex w-full items-center justify-center gap-2 py-3.5 text-[15px] font-medium text-st-rejected-text active:bg-red-50">
          <Icon d={EI.logout} size={20} />{t('logout')}
        </button>
      </Card>
    </ManagerTabPage>
  )
}
