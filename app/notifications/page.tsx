'use client'

import { useRouter } from 'next/navigation'
import TelegramConnect from '@/components/TelegramConnect'

export default function NotificationsPage() {
  const router = useRouter()
  // 登录检查由 middleware.ts 负责(/notifications 在 LOGIN_ONLY_PATHS 里)。

  return (
    <div className="mx-auto max-w-md px-4 py-8 space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">Telegram Notifications</h1>
        <button onClick={() => router.back()} className="btn-ghost">Back</button>
      </div>
      <TelegramConnect />
    </div>
  )
}
