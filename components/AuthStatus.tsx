'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { LoginBackdrop } from '@/components/LoginBackdrop'

// useEmployee() 还在载入或出错时显示的画面(出错时给一个退出登录的出口)。
export default function AuthStatus({ state }: { state: { status: 'loading' } | { status: 'error'; message: string } }) {
  const router = useRouter()
  if (state.status === 'loading') {
    // 进入各页面前的短暂等待:只显示同一个背景,不再出一页"Loading..."文字,也不再重复出 logo
    return (
      <div className="relative min-h-[100dvh] overflow-hidden">
        <LoginBackdrop />
      </div>
    )
  }
  return (
    <div className="mx-auto max-w-sm p-8 text-center">
      <p className="text-sm text-rust">{state.message}</p>
      <button
        onClick={async () => { await supabase.auth.signOut(); router.replace('/') }}
        className="btn-ghost mt-4"
      >
        Log out
      </button>
    </div>
  )
}
