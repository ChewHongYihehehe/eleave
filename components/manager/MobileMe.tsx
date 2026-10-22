'use client'

import { useRouter } from 'next/navigation'
import AuthStatus from '@/components/AuthStatus'
import { Avatar, Card, EI, Hero, Icon, MenuRow } from '@/components/employee/EmployeeShell'
import { supabase } from '@/lib/supabaseClient'
import { useEmployee } from '@/lib/useEmployee'
import { useLang } from '@/lib/lang'
import { useMgrT } from '@/lib/mgrText'
import { ManagerTabPage } from './ManagerTabs'

export default function MobileMe() {
  const auth = useEmployee({ requireManager: true })
  const router = useRouter()
  const { setLang } = useLang()
  const { t, lang } = useMgrT()
  if (auth.status !== 'ready') return <AuthStatus state={auth} />
  const emp = auth.employee

  return (
    <ManagerTabPage tab="me">
      <Hero className="!pb-16">
        <div className="flex items-center gap-4">
          <span className="rounded-full ring-2 ring-white/50"><Avatar name={emp.full_name} size={60} /></span>
          <div className="min-w-0">
            <p className="truncate text-xl font-semibold">{emp.full_name}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-blue-100">
              {emp.employee_no ? <span>#{emp.employee_no}</span> : null}
              <span className="rounded bg-white/20 px-1.5 py-0.5 text-[11px] font-medium text-white">{t('manager')}</span>
            </p>
          </div>
        </div>
      </Hero>

      <div className="relative -mt-10">
        <Card className="px-4 py-3 shadow-sm">
          <p className="mb-2 text-sm text-gray-500">{t('language')}</p>
          <div className="flex rounded-lg bg-gray-100 p-0.5">
            {(['zh', 'en'] as const).map((l) => (
              <button key={l} onClick={() => setLang(l)} className={`flex-1 rounded-md py-2 text-sm ${lang === l ? 'bg-white font-semibold text-brand shadow-sm' : 'text-gray-600'}`}>
                {l === 'zh' ? '中文' : 'English'}
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
    </ManagerTabPage>
  )
}
