'use client'

import { useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AuthStatus from '@/components/AuthStatus'
import { useLang, leaveTypeName } from '@/lib/lang'
import { useLeaveData, fmtNum, TYPE_COLOR } from '@/lib/useLeaveData'
import { fmtDateTime, fmtRange, statusInfo } from '@/lib/employeeFmt'
import { attachMc, cancelPending, openMc, requestCancellation, withdrawCancellation } from '@/lib/employeeActions'
import { Avatar, Card, ConfirmSheet, FlowTimeline, type FlowStep, Stamp, SubPage, useToast } from '@/components/employee/EmployeeShell'
import { toLocalDateStr } from '@/lib/dateUtils'

// 记录详情(钉钉审批详情的样式):申请人 + 右上角印章、信息、带头像的审批进度、可用的操作。

export default function RecordDetail() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { auth, employee, apps, loading, reload } = useLeaveData()
  const { lang, t } = useLang()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [sheet, setSheet] = useState<null | 'cancel' | 'request'>(null)
  const [busy, setBusy] = useState(false)

  if (auth.status !== 'ready') return <AuthStatus state={auth} />
  const app = apps.find((a) => a.id === id)

  if (!app) {
    return (
      <SubPage title={t('details')} backHref="/dashboard/records">
        <p className="py-20 text-center text-sm text-gray-400">{loading ? t('loading') : t('notFound')}</p>
      </SubPage>
    )
  }

  const st = statusInfo(app, t)
  const today = toLocalDateStr(new Date())
  const canCancel = app.status === 'pending'
  const canRequest = app.status === 'approved' && app.cancellation_status === 'none' && app.start_date > today
  const canWithdraw = app.status === 'approved' && app.cancellation_status === 'requested'
  const isImport = !!app.remarks?.includes('Historical import')

  // 审批进度(申请人用自己的名字,负责人用通用头像)
  const me = employee?.full_name ?? ''
  const mgr = t('manager')
  const ft = (iso?: string | null) => (iso ? fmtDateTime(iso, lang) : null)
  const steps: FlowStep[] = [{ title: t('tlSubmitted'), name: me, time: ft(app.created_at), tone: 'done' }]
  if (app.status === 'pending') steps.push({ title: t('tlReviewing'), name: mgr, generic: true, tone: 'active' })
  if (app.status === 'rejected') steps.push({ title: t('tlRejected'), name: mgr, generic: true, time: ft(app.last_decision_at), sub: app.remarks, tone: 'bad' })
  if (app.status === 'approved') {
    steps.push({ title: t('tlApproved'), name: mgr, generic: true, time: ft(app.last_decision_at), tone: 'done' })
    if (app.cancellation_status === 'requested') steps.push({ title: t('tlCancelReq'), name: me, tone: 'active' })
    if (app.cancellation_status === 'none' && app.cancellation_decision_reason)
      steps.push({ title: t('cancelDeclined'), name: mgr, generic: true, sub: app.cancellation_decision_reason, tone: 'bad' })
  }
  if (app.status === 'cancelled') steps.push({ title: t('tlCancelled'), time: ft(app.last_decision_at), sub: app.cancellation_decision_reason, tone: 'muted' })
  // 已经有结果了就盖章;还在审批中(或取消申请处理中)只显示彩色文字
  const stamped = app.status !== 'pending' && app.cancellation_status !== 'requested'

  async function run(fn: () => Promise<string | null>) {
    setBusy(true)
    const err = await fn()
    setBusy(false)
    setSheet(null)
    if (err) { toast.show(t('toastFail')); return }
    await reload()
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f || !employee || !app) return
    setBusy(true)
    const err = await attachMc(employee.id, app.id, f)
    setBusy(false)
    if (err) { toast.show(err); return }
    toast.show(t('toastMcAttached'))
    reload()
  }

  const rows: [string, string][] = [
    [t('leaveType'), leaveTypeName(app.leave_type, lang) + (app.is_half_day && app.half_day_period ? ` (${app.half_day_period === 'am' ? t('am') : t('pm')})` : '')],
    [t('dates'), fmtRange(app, lang, t('imported'))],
    [t('duration'), `${fmtNum(Number(app.total_days))} ${t('daysUnit')}`],
    [t('submittedAt'), fmtDateTime(app.created_at, lang)],
  ]
  if (app.reason) rows.push([t('note'), app.reason])

  const footer = (canCancel || canRequest || canWithdraw) ? (
    <>
      {canCancel && <button onClick={() => setSheet('cancel')} className="w-full rounded-xl border border-[#F5222D]/40 py-3 text-base font-medium text-[#F5222D]">{t('cancelRequest')}</button>}
      {canRequest && <button onClick={() => setSheet('request')} className="w-full rounded-xl border border-[#FA8C16]/50 py-3 text-base font-medium text-[#FA8C16]">{t('requestCancel')}</button>}
      {canWithdraw && <button onClick={() => run(() => withdrawCancellation(app.id))} disabled={busy} className="w-full rounded-xl border border-gray-300 py-3 text-base font-medium text-gray-600 disabled:opacity-50">{t('withdraw')}</button>}
    </>
  ) : undefined

  return (
    <SubPage title={t('details')} backHref="/dashboard/records" footer={footer}>
      <div className="relative mx-4 mb-3 mt-3 overflow-hidden rounded-xl bg-white px-4 py-4">
        <div className="flex items-center gap-3">
          <Avatar name={me} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-gray-900">{me}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-500">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: TYPE_COLOR[app.leave_type] ?? '#8C8C8C' }} />
              {leaveTypeName(app.leave_type, lang)} · {fmtNum(Number(app.total_days))} {t('daysUnit')}
            </p>
          </div>
          {!stamped && <span className="shrink-0 text-base font-semibold" style={{ color: st.color }}>{st.label}</span>}
        </div>
        {stamped && <div className="absolute right-4 top-3"><Stamp label={st.label} color={st.color} /></div>}
      </div>

      <Card>
        {rows.map(([k, v], i) => (
          <div key={k} className={`flex items-start justify-between gap-6 px-4 py-3.5 ${i ? 'border-t border-gray-100' : ''}`}>
            <span className="shrink-0 text-[15px] text-gray-500">{k}</span>
            <span className="text-right text-[15px] text-gray-900">{v}</span>
          </div>
        ))}
        {app.leave_type === 'medical' && !isImport && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3.5">
            <span className="text-[15px] text-gray-500">MC</span>
            {app.mc_attachment_path ? (
              <button onClick={async () => { if (!(await openMc(app.mc_attachment_path as string))) toast.show(t('toastFail')) }} className="text-[15px] text-brand">{t('viewMc')}</button>
            ) : (app.status === 'pending' || app.status === 'approved') ? (
              <button onClick={() => fileRef.current?.click()} disabled={busy} className="text-[15px] text-brand disabled:opacity-50">{busy ? t('uploading') : t('attachMc')}</button>
            ) : <span className="text-[15px] text-gray-300">—</span>}
          </div>
        )}
      </Card>

      {/* 审批进度 */}
      {!isImport && (
        <>
          <p className="px-5 pb-2 pt-4 text-[13px] text-gray-500">{t('flowTitle')}</p>
          <Card className="px-4 py-4">
            <FlowTimeline steps={steps} />
          </Card>
        </>
      )}

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" onChange={onFile} className="hidden" />

      <ConfirmSheet
        open={sheet === 'cancel'} danger busy={busy}
        title={t('confirmCancelReq')} confirmLabel={t('cancelRequest')}
        onClose={() => setSheet(null)}
        onConfirm={() => run(async () => { const e = await cancelPending(app.id); if (!e) router.replace('/dashboard/records'); return e })}
      />
      <ConfirmSheet
        open={sheet === 'request'} busy={busy}
        title={t('requestCancel')} message={t('confirmReqCancel')} confirmLabel={t('confirm')}
        onClose={() => setSheet(null)}
        onConfirm={() => run(() => requestCancellation(app.id))}
      />
      {toast.node}
    </SubPage>
  )
}
