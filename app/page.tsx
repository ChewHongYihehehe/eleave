'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useLang, LANG_OPTIONS } from '@/lib/lang'
import { useTr } from '@/lib/tr'

// Employees log in with a Staff ID + password. Under the hood, Supabase Auth
// only understands email + password, so we convert the Staff ID into an
// internal fake email like "000@purewaternature.local" that the employee
// never needs to see or know about. This must match how the account was
// created in Supabase (see README).
const INTERNAL_EMAIL_DOMAIN = 'purewaternature.local'

function staffIdToEmail(staffId: string) {
  return `${staffId.trim().toLowerCase()}@${INTERNAL_EMAIL_DOMAIN}`
}

function LoginForm() {
  const [staffId, setStaffId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { lang, setLang, t } = useLang()
  const { tr } = useTr()
  const searchParams = useSearchParams()
  const notice = searchParams.get('notice')
  // 一进来先看是不是已经登录:是的话直接跳到该去的页面(装成桌面图标后,每次点开不用再登录一遍)
  const [checking, setChecking] = useState(!notice)

  useEffect(() => {
    if (notice) return // 被挡下来的账号(停用 / 兼职)不要自动跳转,让他看到提示
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { if (!cancelled) setChecking(false); return }
      const { data: profile } = await supabase
        .from('employees')
        .select('role, is_active, employment_type')
        .eq('auth_user_id', user.id)
        .maybeSingle()
      if (cancelled) return
      if (!profile || profile.is_active === false || profile.employment_type === 'part_time') {
        setChecking(false)
        return
      }
      router.replace(profile.role === 'manager' ? '/calendar' : '/dashboard')
    })()
    return () => { cancelled = true }
  }, [notice, router])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: staffIdToEmail(staffId),
      password,
    })

    if (signInError) {
      setError(tr('登录失败,请检查工号和密码。', 'Login failed. Please check your Staff ID / password.', 'Log masuk gagal. Sila semak No. Pekerja / kata laluan anda.'))
      setLoading(false)
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('employees')
      .select('role, is_active, employment_type')
      .eq('auth_user_id', data.user.id)
      .maybeSingle()

    // 密码对了,但资料有问题:停用 / 兼职 / 找不到资料 → 一律不放行,并清掉刚建立的登录状态
    if (profileError || !profile || profile.is_active === false || profile.employment_type === 'part_time') {
      await supabase.auth.signOut()
      setLoading(false)
      if (profileError) setError(tr('无法读取你的资料,请重试。', 'Could not load your profile. Please try again.', 'Tidak dapat memuatkan profil anda. Sila cuba lagi.'))
      else if (!profile) setError(tr('这个账号没有关联员工资料,请联系负责人。', 'No employee profile is linked to this account. Please contact your manager.', 'Tiada profil pekerja dikaitkan dengan akaun ini. Sila hubungi pengurus anda.'))
      else if (profile.is_active === false) setError(tr('这个账号已被停用,请联系负责人。', 'This account has been deactivated. Please contact your manager.', 'Akaun ini telah dinyahaktifkan. Sila hubungi pengurus anda.'))
      else setError(tr('兼职员工没有系统登录权限,请联系负责人。', "Part-time employees don't have system access. Please contact your manager.", 'Pekerja sambilan tidak mempunyai akses sistem. Sila hubungi pengurus anda.'))
      return
    }

    setLoading(false)

    if (profile.role === 'manager') {
      router.push('/calendar')
    } else {
      router.push('/dashboard')
    }
  }

  if (checking) return <div className="min-h-screen" />

  const noticeText =
    notice === 'part-time'
      ? tr('兼职员工没有系统登录权限,请联系负责人。', "Part-time employees don't have system access. Please contact your manager.", 'Pekerja sambilan tidak mempunyai akses sistem. Sila hubungi pengurus anda.')
      : notice === 'inactive'
        ? tr('这个账号已被停用,请联系负责人。', 'This account has been deactivated. Please contact your manager.', 'Akaun ini telah dinyahaktifkan. Sila hubungi pengurus anda.')
        : ''

  return (
    <div className="flex min-h-screen bg-white">
      {/* ── 左侧品牌区:只在电脑上显示 ── */}
      <aside
        className="relative hidden w-[46%] max-w-[720px] flex-col justify-between overflow-hidden p-12 text-white lg:flex"
        style={{ background: 'linear-gradient(150deg, #0958D9 0%, #1677FF 55%, #4096FF 100%)' }}
      >
        {/* 装饰:两个半透明的大圆 */}
        <span className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10" />
        <span className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-white/[0.07]" />

        <div className="relative flex items-center gap-3">
          <img src="/logo.png" alt="Puro" width={40} height={40} className="h-10 w-10 rounded-lg bg-white p-1" />
          <span className="text-lg font-semibold tracking-tight">eLeave</span>
        </div>

        <div className="relative">
          <h2 className="max-w-md text-[32px] font-semibold leading-tight">{t('loginSlogan')}</h2>
          <ul className="mt-8 space-y-4 text-[15px] text-white/90">
            {(['loginPoint1', 'loginPoint2', 'loginPoint3'] as const).map((k) => (
              <li key={k} className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                </span>
                {t(k)}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/60">© Puro</p>
      </aside>

      {/* ── 右侧登录表单 ── */}
      <main className="relative flex flex-1 flex-col items-center justify-center bg-paper px-4 lg:bg-white">
        {/* 语言切换 */}
        <div className="absolute right-5 top-5 flex rounded-md bg-white p-0.5 text-xs shadow-xs ring-1 ring-line lg:bg-paper lg:ring-0">
          {LANG_OPTIONS.map(({ key: l, label }) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`rounded px-2.5 py-1 font-medium transition-colors ${lang === l ? 'bg-pine text-white' : 'text-ink-soft hover:text-ink'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="w-full max-w-[360px]">
          {/* 手机/平板:左侧品牌区看不到,在这里放 logo */}
          <img src="/logo.png" alt="Puro" width={56} height={56} className="mb-5 h-14 w-14 lg:hidden" />
          <h1 className="text-2xl font-semibold text-ink">{t('loginTitle')}</h1>
          <p className="mt-1.5 text-sm text-ink-soft">{t('loginSub')}</p>

          {noticeText && (
            <div className="mt-5 rounded-md border border-st-pending/30 bg-st-pending-soft px-4 py-3 text-[13px] text-st-pending-text">
              {noticeText}
            </div>
          )}

          <form onSubmit={handleLogin} className="mt-7 space-y-5">
            <div>
              <label className="field-label">{t('staffId')}</label>
              <input
                type="text"
                required
                autoFocus
                autoComplete="username"
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="field-input h-10"
                placeholder={tr('例如 001', 'e.g. 001', 'cth. 001')}
              />
            </div>
            <div>
              <label className="field-label">{t('password')}</label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field-input h-10"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="rounded-md bg-rust-soft px-3 py-2 text-[13px] text-rust" role="alert">{error}</p>
            )}

            <button type="submit" disabled={loading} className="btn-primary h-10">
              {loading ? t('signingIn') : t('signIn')}
            </button>
          </form>

          <p className="mt-6 text-xs leading-5 text-ink-faint">{t('loginHint')}</p>
        </div>
      </main>
    </div>
  )
}

// useSearchParams 在生产构建(next build / Vercel)里必须包在 Suspense 里,否则构建会报错。
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
