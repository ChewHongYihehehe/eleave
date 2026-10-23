'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

// "连接 Telegram"面板:员工 / 负责人共用。
// 浏览器永远看不到、也不需要知道 chat id,只知道"有没有绑定"。

type LinkState = 'loading' | 'connected' | 'disconnected'

export default function TelegramConnect() {
  const [state, setState] = useState<LinkState>('loading')
  const [linkUrl, setLinkUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }

  // 员工自己的资料可以直接读(RLS: "employees can view own profile")
  const checkConnected = useCallback(async (): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    const { data } = await supabase
      .from('employees')
      .select('telegram_chat_id')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    const connected = !!data?.telegram_chat_id
    setState(connected ? 'connected' : 'disconnected')
    return connected
  }, [])

  useEffect(() => {
    checkConnected()
    return stopPolling
  }, [checkConnected])

  async function authHeader() {
    const { data: { session } } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token}` }
  }

  async function handleConnect() {
    setBusy(true)
    setError('')
    const res = await fetch('/api/telegram/link', { method: 'POST', headers: await authHeader() })
    const result = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(result.error || 'Could not start the connection. Please try again.'); return }

    setLinkUrl(result.url)
    window.open(result.url, '_blank', 'noopener')

    // 等员工在 Telegram 里按 Start —— 每 3 秒看一次有没有绑好,最多等 15 分钟
    stopPolling()
    const startedAt = Date.now()
    pollRef.current = setInterval(async () => {
      if (Date.now() - startedAt > 15 * 60 * 1000) { stopPolling(); setLinkUrl(null); return }
      if (await checkConnected()) { stopPolling(); setLinkUrl(null) }
    }, 3000)
  }

  async function handleDisconnect() {
    if (!window.confirm('Stop receiving E-Leave notifications on Telegram?')) return
    setBusy(true)
    setError('')
    const res = await fetch('/api/telegram/link', { method: 'DELETE', headers: await authHeader() })
    setBusy(false)
    if (!res.ok) { setError('Could not disconnect. Please try again.'); return }
    setState('disconnected')
  }

  if (state === 'loading') return <div className="panel text-sm text-ink-soft">Loading...</div>

  return (
    <div className="panel space-y-4">
      {state === 'connected' ? (
        <>
          <div className="flex items-center gap-2">
            <span className="badge badge-approved">Connected</span>
            <span className="text-sm text-ink-soft">You will receive E-Leave updates on Telegram.</span>
          </div>
          <button onClick={handleDisconnect} disabled={busy} className="btn-danger-ghost">
            Disconnect Telegram
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-soft">
            Get a Telegram message when your leave is approved or rejected (and, for managers, when someone requests leave).
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-soft">
            <li>Tap <b>Connect Telegram</b> below.</li>
            <li>In Telegram, press <b>Start</b>.</li>
            <li>Come back here — this page updates by itself.</li>
          </ol>
          <button onClick={handleConnect} disabled={busy} className="btn-primary">
            {busy ? 'Please wait...' : linkUrl ? 'Generate a new link' : 'Connect Telegram'}
          </button>
          {linkUrl && (
            <p className="text-sm text-ink-soft">
              Waiting for you to press Start in Telegram…{' '}
              <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="btn-link">
                Open Telegram again
              </a>
              <span className="block text-xs text-ink-faint">The link works for 15 minutes.</span>
            </p>
          )}
        </>
      )}
      {error && <p className="text-sm text-rust">{error}</p>}
    </div>
  )
}
