'use client'

import { useRouter } from 'next/navigation'
import ChangePasswordForm from '@/components/ChangePasswordForm'
import { useLang } from '@/lib/lang'

export default function ChangePasswordPage() {
  const router = useRouter()
  const { t } = useLang()
  // 登录检查由 middleware.ts 负责(没登录会直接被转到登录页),这里不需要再查一次。

  return (
    <div className="mx-auto max-w-md px-4 py-8 space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">{t('changePassword')}</h1>
        <button onClick={() => router.back()} className="btn-ghost">{t('back')}</button>
      </div>

      <ChangePasswordForm open onOpenChange={() => router.back()} />
    </div>
  )
}
