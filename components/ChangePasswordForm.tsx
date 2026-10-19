'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { checkPassword, MIN_PASSWORD_LENGTH } from '@/lib/passwordPolicy'

export default function ChangePasswordForm({
  open: controlledOpen,
  onOpenChange,
  forced = false,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  forced?: boolean // 第一次登录的强制改密码:不能关掉这个表单,改好后回到首页
} = {}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = (value: boolean) => {
    if (isControlled) onOpenChange?.(value)
    else setInternalOpen(value)
  }
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)

    const problem = checkPassword(newPassword) // 先在浏览器给即时提示;真正的把关在服务器
    if (problem) {
      setError(problem)
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    // 走服务器:规则由服务器强制执行,而且"必须改密码"的标记只有服务器能关掉
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/account/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ newPassword }),
    })
    const result = await res.json().catch(() => ({}))
    setLoading(false)

    if (!res.ok) {
      setError(result.error || 'Failed to change password. Please try again.')
      return
    }

    setSuccess(true)
    setNewPassword('')
    setConfirmPassword('')
    if (forced) setTimeout(() => { window.location.href = '/' }, 1200)
  }

  if (!open) {
    if (isControlled) return null
    return (
      <button onClick={() => setOpen(true)} className="btn-ghost">
        Change password
      </button>
    )
  }

  return (
    <div className="panel">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-base font-semibold text-ink">Change Password</h2>
        {!forced && (
          <button onClick={() => setOpen(false)} className="btn-ghost">
            Close
          </button>
        )}
      </div>

      <form onSubmit={handleChangePassword} className="space-y-3">
        <div>
          <label className="field-label">New Password</label>
          <input
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="field-input"
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
          />
        </div>
        <div>
          <label className="field-label">Confirm New Password</label>
          <input
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="field-input"
          />
        </div>

        {error && <p className="text-sm text-rust">{error}</p>}
        {success && (
          <p className="text-sm text-pine-deep">
            Password changed successfully!{forced ? ' Taking you to the home page…' : ''}
          </p>
        )}

        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Saving...' : 'Save New Password'}
        </button>
      </form>
    </div>
  )
}
