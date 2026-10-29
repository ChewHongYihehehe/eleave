'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ChangePasswordForm from '@/components/ChangePasswordForm'
import { supabase } from '@/lib/supabaseClient'
import { useLang } from '@/lib/lang'

export default function ChangePasswordPage() {
  const router = useRouter()
  const { t } = useLang()
  // 登录检查由 middleware.ts 负责(没登录会直接被转到登录页),这里不需要再查一次。

  // 是不是"第一次登录、必须先设自己的密码"(负责人设的初始密码):
  // 是 → 不能返回、改好后退出登录并回到登录页;不是(平时自己想改密码)→ 照旧,改好后留在原地。
  const [forced, setForced] = useState<boolean | null>(null)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { if (!cancelled) setForced(false); return }
      const { data: emp } = await supabase
        .from('employees')
        .select('must_change_password')
        .eq('auth_user_id', user.id)
        .maybeSingle()
      if (!cancelled) setForced(!!emp?.must_change_password)
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="mx-auto max-w-md px-4 py-8 space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">{t('changePassword')}</h1>
        {forced === false && <button onClick={() => router.back()} className="btn-ghost">{t('back')}</button>}
      </div>

      {forced !== null && <ChangePasswordForm open forced={forced} onOpenChange={() => router.back()} />}
    </div>
  )
}
