'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { checkPassword, MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from '@/lib/passwordPolicy'
import { useLang } from '@/lib/lang'
import { useTr } from '@/lib/tr'

export default function ChangePasswordForm({
  open: controlledOpen,
  onOpenChange,
  forced = false,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  forced?: boolean // 第一次登录的强制改密码:不能关掉这个表单,改好后退出登录并回到登录页,用新密码重新登录
} = {}) {
  const { t } = useLang()
  const { tr } = useTr()
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

  // 密码规则的提示文字来自 passwordPolicy / 服务器(英文),这里按当前语言换成对应的句子
  function localize(msg: string): string {
    if (msg.startsWith('Password must be at least')) return tr(`密码至少 ${MIN_PASSWORD_LENGTH} 位。`, msg, `Kata laluan mestilah sekurang-kurangnya ${MIN_PASSWORD_LENGTH} aksara.`)
    if (msg.startsWith('Password must be at most')) return tr(`密码最多 ${MAX_PASSWORD_LENGTH} 位。`, msg, `Kata laluan tidak boleh melebihi ${MAX_PASSWORD_LENGTH} aksara.`)
    if (msg.startsWith('That password is too easy')) return tr('这个密码太容易被猜到,请换一个。', msg, 'Kata laluan ini terlalu mudah diteka. Sila pilih yang lain.')
    if (msg.startsWith('Your password cannot be the same as your Staff ID')) return tr('密码不能和工号一样。', msg, 'Kata laluan tidak boleh sama dengan No. Pekerja anda.')
    if (msg.startsWith('Your new password must be different')) return tr('新密码不能和当前密码相同。', msg, 'Kata laluan baharu mesti berbeza daripada kata laluan semasa anda.')
    if (msg.startsWith('Could not change the password')) return tr('无法修改密码,请重试。', msg, 'Tidak dapat menukar kata laluan. Sila cuba lagi.')
    return msg
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)

    const problem = checkPassword(newPassword) // 先在浏览器给即时提示;真正的把关在服务器
    if (problem) {
      setError(localize(problem))
      return
    }
    if (newPassword !== confirmPassword) {
      setError(tr('两次输入的密码不一致。', 'Passwords do not match.', 'Kata laluan tidak sepadan.'))
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
      setError(result.error ? localize(result.error) : tr('修改密码失败,请重试。', 'Failed to change password. Please try again.', 'Gagal menukar kata laluan. Sila cuba lagi.'))
      return
    }

    setSuccess(true)
    setNewPassword('')
    setConfirmPassword('')
    if (forced) {
      // 设好自己的密码后:先退出登录,再回登录页(不然登录页会看到已登录,直接又跳进系统)
      setTimeout(async () => {
        try { await supabase.auth.signOut() } catch { /* 退出失败也照样回登录页 */ }
        window.location.href = '/'
      }, 1500)
    }
  }

  if (!open) {
    if (isControlled) return null
    return (
      <button onClick={() => setOpen(true)} className="btn-ghost">
        {t('changePassword')}
      </button>
    )
  }

  return (
    <div className="panel">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-base font-semibold text-ink">{t('changePassword')}</h2>
        {!forced && (
          <button onClick={() => setOpen(false)} className="btn-ghost">
            {tr('关闭', 'Close', 'Tutup')}
          </button>
        )}
      </div>

      <form onSubmit={handleChangePassword} className="space-y-3">
        <div>
          <label className="field-label">{tr('新密码', 'New Password', 'Kata Laluan Baharu')}</label>
          <input
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="field-input"
            placeholder={tr(`至少 ${MIN_PASSWORD_LENGTH} 位`, `At least ${MIN_PASSWORD_LENGTH} characters`, `Sekurang-kurangnya ${MIN_PASSWORD_LENGTH} aksara`)}
          />
        </div>
        <div>
          <label className="field-label">{tr('确认新密码', 'Confirm New Password', 'Sahkan Kata Laluan Baharu')}</label>
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
            {tr('密码已修改!', 'Password changed successfully!', 'Kata laluan berjaya ditukar!')}{forced ? ' ' + tr('请用新密码重新登录,正在带你回登录页…', 'Please sign in again with your new password. Taking you to the login page…', 'Sila log masuk semula dengan kata laluan baharu anda. Membawa anda ke halaman log masuk…') : ''}
          </p>
        )}

        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? tr('保存中…', 'Saving...', 'Menyimpan...') : tr('保存新密码', 'Save New Password', 'Simpan Kata Laluan Baharu')}
        </button>
      </form>
    </div>
  )
}
