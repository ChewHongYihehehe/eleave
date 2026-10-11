'use client'

import { useRouter } from 'next/navigation'
import ChangePasswordForm from '@/components/ChangePasswordForm'

export default function ChangePasswordPage() {
  const router = useRouter()
  // 登录检查由 middleware.ts 负责(没登录会直接被转到登录页),这里不需要再查一次。

  return (
    <div className="mx-auto max-w-md px-4 py-8 space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">Change Password</h1>
        <button onClick={() => router.back()} className="btn-ghost">Back</button>
      </div>

      <ChangePasswordForm open onOpenChange={() => router.back()} />
    </div>
  )
}
