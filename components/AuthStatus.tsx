'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useLang } from '@/lib/lang'

// useEmployee() 还在载入或出错时显示的画面(出错时给一个退出登录的出口)。
export default function AuthStatus({ state }: { state: { status: 'loading' } | { status: 'error'; message: string } }) {
  const router = useRouter()
  const { t } = useLang()
  if (state.status === 'loading') {
    return <div className="p-8 text-center text-ink-soft">{t('loading')}</div>
  }
  return (
    <div className="mx-auto max-w-sm p-8 text-center">
      <p className="text-sm text-rust">{state.message}</p>
      <button
        onClick={async () => { await supabase.auth.signOut(); router.replace('/') }}
        className="btn-ghost mt-4"
      >
        {t('logout')}
      </button>
    </div>
  )
}
