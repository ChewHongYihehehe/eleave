'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function ChangePasswordForm({
  open: controlledOpen,
  onOpenChange,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
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

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    setLoading(false)

    if (updateError) {
      setError('Failed to change password. Please try again.')
      return
    }

    setSuccess(true)
    setNewPassword('')
    setConfirmPassword('')
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
        <button onClick={() => setOpen(false)} className="btn-ghost">
          Close
        </button>
      </div>

      <form onSubmit={handleChangePassword} className="space-y-3">
        <div>
          <label className="field-label">New Password</label>
          <input
            type="password"
            required
            minLength={6}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="field-input"
            placeholder="At least 6 characters"
          />
        </div>
        <div>
          <label className="field-label">Confirm New Password</label>
          <input
            type="password"
            required
            minLength={6}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="field-input"
          />
        </div>

        {error && <p className="text-sm text-rust">{error}</p>}
        {success && <p className="text-sm text-pine-deep">Password changed successfully!</p>}

        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Saving...' : 'Save New Password'}
        </button>
      </form>
    </div>
  )
}
