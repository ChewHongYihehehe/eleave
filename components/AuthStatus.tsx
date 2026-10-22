'use client'

import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { LoginBackdrop, LogoMark } from '@/components/LoginBackdrop'

// useEmployee() 还在载入或出错时显示的画面(出错时给一个退出登录的出口)。
export default function AuthStatus({ state }: { state: { status: 'loading' } | { status: 'error'; message: string } }) {
  const router = useRouter()
  if (state.status === 'loading') {
    // 登录后进入各页面前的短暂等待:沿用登录页那一屏(背景 + logo),不再出现一页只有"Loading..."的空白页
    return (
      <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden">
        <LoginBackdrop />
        <div className="relative"><LogoMark /></div>
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
