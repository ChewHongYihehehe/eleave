'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { LoginBackdrop, LogoMark } from '@/components/LoginBackdrop'

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
      setError('Login failed. Please check your Staff ID / password.')
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
      if (profileError) setError('Could not load your profile. Please try again.')
      else if (!profile) setError('No employee profile is linked to this account. Please contact your manager.')
      else if (profile.is_active === false) setError('This account has been deactivated. Please contact your manager.')
      else setError("Part-time employees don't have system access. Please contact your manager.")
      return
    }

    setLoading(false)

    if (profile.role === 'manager') {
      router.push('/calendar')
    } else {
      router.push('/dashboard')
    }
  }

  // 检查登录状态的那一小会儿只显示背景:不再重复出一次 logo(手机系统的启动画面已经出过了),
  // 已经登录的人会直接跳走,没登录的人才看到 logo 和表单
  if (checking) {
    return (
      <div className="relative min-h-[100dvh] overflow-hidden">
        <LoginBackdrop />
      </div>
    )
  }

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-4 py-10">
      <LoginBackdrop />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 text-center">
          <LogoMark />
          <div className="mt-6">
            <h1 className="font-display text-3xl font-semibold text-ink">E-Leave</h1>
            <p className="mt-1 text-sm text-ink-soft">Sign in with your Staff ID</p>
          </div>
        </div>

        <div>
          {notice === 'part-time' && (
            <div className="mb-4 rounded-md border border-line bg-paper px-4 py-3 text-sm text-ink-soft">
              Part-time employees don&apos;t have system access. Please contact your manager.
            </div>
          )}
          {notice === 'inactive' && (
            <div className="mb-4 rounded-md border border-line bg-paper px-4 py-3 text-sm text-ink-soft">
              This account has been deactivated. Please contact your manager.
            </div>
          )}
          <form onSubmit={handleLogin} className="panel space-y-4 bg-white/90 shadow-[0_10px_30px_rgba(20,70,110,0.08)] backdrop-blur-sm">
            <div>
              <label className="field-label">Staff ID</label>
              <input
                type="text"
                required
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="field-input focus:border-brand focus:ring-brand"
                placeholder="e.g. 001"
              />
            </div>
            <div>
              <label className="field-label">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field-input focus:border-brand focus:ring-brand"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-sm text-rust">{error}</p>}

            <button type="submit" disabled={loading} className="btn-primary bg-brand py-3 text-[15px] hover:bg-brand-deep">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-ink-faint">
            First time? Your admin needs to set up your Staff ID and password in Supabase.
          </p>
        </div>
      </div>
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
