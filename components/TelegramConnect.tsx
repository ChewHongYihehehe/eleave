'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useTr } from '@/lib/tr'

// "连接 Telegram"面板:员工 / 负责人共用。
// 浏览器永远看不到、也不需要知道 chat id,只知道"有没有绑定"。

type LinkState = 'loading' | 'connected' | 'disconnected'

export default function TelegramConnect() {
  const { tr } = useTr()
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
    if (!res.ok) { setError(result.error || tr('无法开始连接,请重试。', 'Could not start the connection. Please try again.', 'Tidak dapat memulakan sambungan. Sila cuba lagi.')); return }

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
    if (!window.confirm(tr('不再通过 Telegram 接收 E-Leave 通知?', 'Stop receiving E-Leave notifications on Telegram?', 'Berhenti menerima notifikasi E-Leave melalui Telegram?'))) return
    setBusy(true)
    setError('')
    const res = await fetch('/api/telegram/link', { method: 'DELETE', headers: await authHeader() })
    setBusy(false)
    if (!res.ok) { setError(tr('无法断开连接,请重试。', 'Could not disconnect. Please try again.', 'Tidak dapat memutuskan sambungan. Sila cuba lagi.')); return }
    setState('disconnected')
  }

  if (state === 'loading') return <div className="panel text-sm text-ink-soft">{tr('加载中…', 'Loading...', 'Sedang memuatkan...')}</div>

  const connectLabel = tr('连接 Telegram', 'Connect Telegram', 'Sambung Telegram')

  return (
    <div className="panel space-y-4">
      {state === 'connected' ? (
        <>
          <div className="flex items-center gap-2">
            <span className="badge badge-approved">{tr('已连接', 'Connected', 'Disambungkan')}</span>
            <span className="text-sm text-ink-soft">{tr('你会在 Telegram 收到 E-Leave 的最新通知。', 'You will receive E-Leave updates on Telegram.', 'Anda akan menerima kemas kini E-Leave melalui Telegram.')}</span>
          </div>
          <button onClick={handleDisconnect} disabled={busy} className="btn-danger-ghost">
            {tr('断开 Telegram', 'Disconnect Telegram', 'Putuskan Sambungan Telegram')}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-soft">
            {tr('请假被批准或拒绝时,你会收到 Telegram 消息(负责人则是有人提交请假申请时)。', 'Get a Telegram message when your leave is approved or rejected (and, for managers, when someone requests leave).', 'Terima mesej Telegram apabila cuti anda diluluskan atau ditolak (dan, bagi pengurus, apabila ada yang memohon cuti).')}
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-soft">
            <li>{tr('点下面的', 'Tap ', 'Tekan ')}<b>{connectLabel}</b>{tr('。', ' below.', ' di bawah.')}</li>
            <li>{tr('在 Telegram 里点 ', 'In Telegram, press ', 'Dalam Telegram, tekan ')}<b>Start</b>.</li>
            <li>{tr('回到这里 —— 页面会自动更新。', 'Come back here — this page updates by itself.', 'Kembali ke sini — halaman ini akan dikemas kini secara automatik.')}</li>
          </ol>
          <button onClick={handleConnect} disabled={busy} className="btn-primary">
            {busy ? tr('请稍候…', 'Please wait...', 'Sila tunggu...') : linkUrl ? tr('重新生成链接', 'Generate a new link', 'Jana pautan baharu') : connectLabel}
          </button>
          {linkUrl && (
            <p className="text-sm text-ink-soft">
              {tr('正在等你在 Telegram 里点 Start…', 'Waiting for you to press Start in Telegram…', 'Menunggu anda menekan Start dalam Telegram…')}{' '}
              <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="btn-link">
                {tr('再次打开 Telegram', 'Open Telegram again', 'Buka Telegram semula')}
              </a>
              <span className="block text-xs text-ink-faint">{tr('链接 15 分钟内有效。', 'The link works for 15 minutes.', 'Pautan ini sah selama 15 minit.')}</span>
            </p>
          )}
        </>
      )}
      {error && <p className="text-sm text-rust">{error}</p>}
    </div>
  )
}
