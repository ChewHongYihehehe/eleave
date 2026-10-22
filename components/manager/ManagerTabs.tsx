'use client'

import { useState } from 'react'
import Link from 'next/link'
import { IC } from '@/components/ManagerShell'
import { BottomSheet, EI, Icon } from '@/components/employee/EmployeeShell'
import { useMgrT, type MgrKey } from '@/lib/mgrText'
import { useAttentionCount } from '@/lib/useApprovals'

// 负责人手机版的外壳:四个主页面(工作台 / 审批 / 日历 / 我的)+ 底部栏。
// 内页(详情、表单)直接用 EmployeeShell 里的 SubPage。
// 颜色用 tailwind.config.ts 的 brand / app token。

const TABS: { key: 'workspace' | 'approve' | 'calendar' | 'me'; href: string; label: MgrKey; icon: string }[] = [
  { key: 'workspace', href: '/workspace', label: 'workspace', icon: IC.grid },
  { key: 'approve', href: '/approve', label: 'approvals', icon: IC.approve },
  { key: 'calendar', href: '/calendar', label: 'calendar', icon: IC.calendar },
  { key: 'me', href: '/me', label: 'me', icon: IC.user },
]

const safeBottom = 'env(safe-area-inset-bottom, 0px)'

export function ManagerTabPage({ tab, badge, children }: { tab: (typeof TABS)[number]['key']; badge?: number; children: React.ReactNode }) {
  const { t, lang } = useMgrT()
  const fetched = useAttentionCount()
  const count = badge ?? fetched
  return (
    <div translate="no" lang={lang === 'zh' ? 'zh-Hans' : 'en'} className="min-h-[100dvh] bg-app">
      <div className="mx-auto max-w-md" style={{ paddingBottom: `calc(4.25rem + ${safeBottom})` }}>{children}</div>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white" style={{ paddingBottom: safeBottom }}>
        <div className="mx-auto flex max-w-md">
          {TABS.map((x) => {
            const active = x.key === tab
            return (
              <Link key={x.key} href={x.href} replace={!active} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${active ? 'font-semibold text-brand' : 'text-gray-500'}`}>
                <span className="relative">
                  <Icon d={x.icon} size={24} />
                  {x.key === 'approve' && !!count && (
                    <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-st-rejected px-1 text-[10px] font-bold leading-none text-white">
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </span>
                {t(x.label)}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

// ── 头像:按名字取固定颜色 ──
const PALETTE = ['#1677FF', '#13C2C2', '#FA8C16', '#722ED1', '#EB2F96', '#52C41A', '#2F54EB', '#FA541C']
export function Avatar({ name, size = 40 }: { name?: string | null; size?: number }) {
  const safe = (name || '').trim()
  const parts = safe ? safe.split(/\s+/) : []
  let initials = '?'
  if (parts.length === 1 && parts[0]) {
    initials = parts[0].slice(0, 2).toUpperCase()
  } else if (parts.length > 1) {
    initials = ((parts[0][0] || '') + (parts[parts.length - 1][0] || '')).toUpperCase() || '?'
  }
  let h = 0
  for (let i = 0; i < safe.length; i++) h = (h * 31 + safe.charCodeAt(i)) >>> 0
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-2xs" style={{ width: size, height: size, background: PALETTE[h % PALETTE.length], fontSize: Math.max(10, Math.round(size * 0.36)) }}>
      {initials}
    </span>
  )
}

// ── 填写原因的底部面板:取消 | 标题 | 确认 放在顶部一行,键盘弹出来也不会挡住 ──
// 快捷理由放在输入框上方(键盘弹出后仍然看得到),输入框自动聚焦。
export function ReasonSheet({
  open, title, hint, required, chips, confirmLabel, danger, busy, onConfirm, onClose,
}: {
  open: boolean; title: string; hint?: string; required?: boolean; chips?: string[]; confirmLabel: string
  danger?: boolean; busy?: boolean; onConfirm: (reason: string) => void; onClose: () => void
}) {
  const { t } = useMgrT()
  const [text, setText] = useState('')
  if (!open) return null
  const disabled = busy || (required && !text.trim())
  return (
    <BottomSheet onClose={() => !busy && onClose()}>
      <div className="grid h-12 grid-cols-[6rem_1fr_6rem] items-center border-b border-gray-100 px-2">
        <button onClick={onClose} disabled={busy} className="h-12 whitespace-nowrap px-2 text-left text-[15px] text-gray-600">{t('cancel')}</button>
        <p className="truncate text-center text-base font-semibold text-gray-900">{title}</p>
        <button onClick={() => onConfirm(text.trim())} disabled={disabled} className={`h-12 whitespace-nowrap px-2 text-right text-[15px] font-semibold disabled:opacity-40 ${danger ? 'text-st-rejected-text' : 'text-brand'}`}>
          {confirmLabel}
        </button>
      </div>
      <div className="px-4 pt-3">
        {hint && <p className="mb-2 text-sm text-gray-600">{hint}</p>}
        {chips && chips.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {chips.map((c) => (
              <button key={c} type="button" onClick={() => setText(c)} className="rounded-full bg-brand-soft px-3 py-2 text-[13px] text-brand-deep active:opacity-70">{c}</button>
            ))}
          </div>
        )}
        <textarea
          autoFocus
          value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={300}
          placeholder={required ? `${t('reasonPh')} (${t('required')})` : t('reasonPh')}
          className="w-full resize-none rounded-lg bg-gray-50 p-3 text-[15px] text-gray-800 placeholder:text-gray-400 focus:outline-none"
        />
      </div>
    </BottomSheet>
  )
}

// ── 单选底部面板(选员工等)──
export function PickerSheet({
  open, title, options, value, onPick, onClose,
}: { open: boolean; title: string; options: { value: string; label: string }[]; value: string; onPick: (v: string) => void; onClose: () => void }) {
  if (!open) return null
  return (
    <BottomSheet onClose={onClose} className="flex max-h-[70dvh] flex-col" pb="0px">
      <p className="border-b border-gray-100 py-3.5 text-center text-base font-semibold text-gray-900">{title}</p>
      <div className="overflow-y-auto">
        {options.map((o) => (
          <button key={o.value} onClick={() => { onPick(o.value); onClose() }} className="flex w-full items-center justify-between border-b border-gray-50 px-5 py-3.5 text-left text-[15px] text-gray-900 active:bg-gray-50">
            <span className={o.value === value ? 'font-semibold text-brand' : ''}>{o.label}</span>
            {o.value === value && <Icon d="M5 12.5l4.5 4.5L19 7.5" size={18} className="text-brand" />}
          </button>
        ))}
      </div>
    </BottomSheet>
  )
}

export { EI }
