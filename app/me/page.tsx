'use client'

import MobileMe from '@/components/manager/MobileMe'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import ManagerShell, { IC, SvgIcon } from '@/components/ManagerShell'
import { useEmployee } from '@/lib/useEmployee'
import AuthStatus from '@/components/AuthStatus'
import { useLang } from '@/lib/lang'

// 我的(手机版底部栏第 4 个):账号、语言、更改密码、Telegram 通知、退出登录。

function DesktopMe() {
  const auth = useEmployee({ requireManager: true })
  const router = useRouter()
  const { lang, setLang, t } = useLang()
  const [user, setUser] = useState<{ name: string; initials: string } | null>(null)

  useEffect(() => {
    if (auth.status !== 'ready') return
    supabase.auth.getUser().then(async ({ data: { user: u } }) => {
      if (!u) return
      const { data } = await supabase
        .from('employees')
        .select('full_name')
        .eq('auth_user_id', u.id)
        .maybeSingle()
      if (data) {
        const parts = data.full_name.trim().split(' ')
        const initials = (parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')
        setUser({ name: data.full_name, initials: initials.toUpperCase() })
      }
    })
  }, [auth.status])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (auth.status !== 'ready') return <AuthStatus state={auth} />

  const row = 'flex items-center gap-3 px-4 py-3.5 text-sm text-ink'
  const iconBox = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500'

  return (
    <ManagerShell>
      <div className="space-y-5 pb-4">
        <h1 className="font-display text-2xl font-semibold text-ink">{t('me')}</h1>

        {/* 账号 */}
        <div className="flex items-center gap-4 rounded-xl border border-line bg-surface p-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-pine/20 text-lg font-bold text-pine">
            {user?.initials ?? ''}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-ink">{user?.name ?? ''}</p>
            <p className="text-sm text-ink-soft">{t('manager')}</p>
          </div>
        </div>

        {/* 语言 */}
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="mb-2 text-sm text-ink-soft">{t('language')}</p>
          <div className="flex rounded-lg border border-line p-0.5">
            {(['zh', 'en'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${lang === l ? 'bg-pine text-white' : 'text-ink-soft'}`}
              >
                {l === 'zh' ? '中文' : 'English'}
              </button>
            ))}
          </div>
        </div>

        {/* 设置 */}
        <div className="divide-y divide-line rounded-xl border border-line bg-surface">
          <Link href="/change-password" className={row}>
            <span className={iconBox}><SvgIcon d={IC.key} size={18} /></span>
            <span className="flex-1">{t('changePassword')}</span>
            <span className="text-ink-faint"><SvgIcon d={IC.chevronR} size={16} /></span>
          </Link>
          <Link href="/notifications" className={row}>
            <span className={iconBox}><SvgIcon d={IC.bell} size={18} /></span>
            <span className="flex-1">{t('telegram')}</span>
            <span className="text-ink-faint"><SvgIcon d={IC.chevronR} size={16} /></span>
          </Link>
        </div>

        {/* 退出登录 */}
        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface py-3.5 text-sm font-medium text-rust"
        >
          <SvgIcon d={IC.logout} size={18} />
          {t('logout')}
        </button>
      </div>
    </ManagerShell>
  )
}

// 手机(< md)用钉钉风格的新版页面;电脑(≥ md)保持原来的版面。
export default function MePage() {
  return (
    <>
      <div className="md:hidden">
        <MobileMe />
      </div>
      <div className="hidden md:block">
        <DesktopMe />
      </div>
    </>
  )
}
