'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AuthStatus from '@/components/AuthStatus'
import { Card, ConfirmSheet, ListSkeleton, SubPage, useToast } from '@/components/employee/EmployeeShell'
import { Avatar, ReasonSheet } from '@/components/manager/ManagerTabs'
import { statusOf } from '@/components/manager/MobileApprove'
import { fmtNum, TYPE_COLOR } from '@/lib/useLeaveData'
import { fmtDateTime, fmtRange } from '@/lib/employeeFmt'
import { getMcSignedUrl } from '@/lib/mcAttachments'
import { leaveName, useMgrT } from '@/lib/mgrText'
import { isImported, useApprovals, type Action } from '@/lib/useApprovals'

// 审批详情(钉钉样式):申请人、信息、对决策有帮助的余额和同期休假、进度时间线;
// 底部固定操作按钮。同意要确认,拒绝要填原因(底部面板)。

type Step = { title: string; time?: string | null; sub?: string | null; tone: 'done' | 'active' | 'bad' | 'muted' }
type Sheet = null | 'approve' | 'reject' | 'confirmCancel' | 'keep' | 'managerCancel'

export default function ApprovalDetail() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { auth, apps, loading, error, send, balanceFor } = useApprovals()
  const { t, lang } = useMgrT()
  const toast = useToast()
  const [sheet, setSheet] = useState<Sheet>(null)
  const [busy, setBusy] = useState(false)

  if (auth.status !== 'ready') return <AuthStatus state={auth} />
  const app = apps.find((a) => a.id === id)
  if (!app) {
    return (
      <SubPage title={t('details')} backHref="/approve">
        {loading ? <ListSkeleton rows={3} /> : <p className="py-20 text-center text-sm text-gray-500">{error ? t('loadFail') : t('notFound')}</p>}
      </SubPage>
    )
  }

  const st = statusOf(app, t)
  const imported = isImported(app)
  const isPending = app.status === 'pending'
  const isCancelReq = app.status === 'approved' && app.cancellation_status === 'requested'
  const isApproved = app.status === 'approved' && app.cancellation_status !== 'requested'
  const bal = balanceFor(app.employee_id, app.leave_type, Number(app.start_date.slice(0, 4))) // 按申请所属年份算余额,跨年申请不会拿错

  // 同期休假的同事(已批准、日期有重叠、不含历史导入)
  const overlap = Array.from(new Set(
    apps
      .filter((o) => o.id !== app.id && o.employee_id !== app.employee_id && o.status === 'approved' && !isImported(o) && o.start_date <= app.end_date && o.end_date >= app.start_date)
      .map((o) => o.person.full_name)
  ))

  const steps: Step[] = [{ title: t('tlSubmitted'), time: app.created_at, tone: 'done' }]
  if (app.status === 'pending') steps.push({ title: t('tlReviewing'), tone: 'active' })
  if (app.status === 'rejected') steps.push({ title: t('tlRejected'), time: app.last_decision_at, sub: app.remarks, tone: 'bad' })
  if (app.status === 'approved') {
    steps.push({ title: t('tlApproved'), time: app.last_decision_at, tone: 'done' })
    if (isCancelReq) steps.push({ title: t('tlCancelReq'), time: app.cancellation_requested_at, tone: 'active' })
    if (app.cancellation_status === 'none' && app.cancellation_decision_reason) steps.push({ title: t('cancelDeclined'), sub: app.cancellation_decision_reason, tone: 'bad' })
  }
  if (app.status === 'cancelled') steps.push({ title: t('tlCancelled'), time: app.last_decision_at, sub: app.cancellation_decision_reason, tone: 'muted' })
  const dot = { done: 'bg-st-approved', active: 'bg-st-pending', bad: 'bg-st-rejected', muted: 'bg-gray-300' }

  async function run(action: Action, reason?: string) {
    setBusy(true)
    const err = await send(action, [app!.id], reason)
    setBusy(false)
    setSheet(null)
    if (err) { toast.show(err); return }
    toast.show(t('toastOk'))
    // 处理完回到审批列表(待办里就不会再看到它)
    setTimeout(() => router.replace('/approve'), 600)
  }

  const rows: [string, string][] = [
    [t('leaveType'), leaveName(app.leave_type, lang) + (app.is_half_day && app.half_day_period ? ` (${app.half_day_period === 'am' ? t('halfAm') : t('halfPm')})` : '')],
    [t('dates'), fmtRange(app, lang, t('imported'))],
    [t('duration'), `${fmtNum(Number(app.total_days))} ${t('daysUnit')}`],
    [t('submittedAt'), fmtDateTime(app.created_at, lang)],
  ]
  if (app.reason && !imported) rows.push([t('reason'), app.reason])

  // 确认面板里写清楚"谁 / 什么 / 几天 / 哪天",不再是只有一行标题的形式确认
  const summary = `${app.person.full_name} · ${leaveName(app.leave_type, lang)} ${fmtNum(Number(app.total_days))} ${t('daysUnit')} · ${fmtRange(app, lang, t('imported'))}`
  const big = 'rounded-xl py-3 text-base font-semibold'
  const footer = isPending ? (
    <div className="flex gap-3">
      <button onClick={() => setSheet('reject')} className={`${big} flex-[2] border border-st-rejected/40 text-st-rejected-text`}>{t('reject')}</button>
      <button onClick={() => setSheet('approve')} className={`${big} flex-[3] bg-brand text-white`}>{t('approve')}</button>
    </div>
  ) : isCancelReq ? (
    <div className="flex gap-3">
      <button onClick={() => setSheet('keep')} className={`${big} flex-[2] border border-gray-300 text-gray-700`}>{t('keepLeave')}</button>
      <button onClick={() => setSheet('confirmCancel')} className={`${big} flex-[3] bg-brand text-white`}>{t('confirmCancellation')}</button>
    </div>
  ) : isApproved ? (
    <button onClick={() => setSheet('managerCancel')} className={`${big} w-full border border-st-rejected/40 text-st-rejected-text`}>{t('managerCancel')}</button>
  ) : undefined

  return (
    <SubPage title={t('details')} backHref="/approve" footer={footer}>
      {/* 申请人 + 状态 */}
      <div className="flex items-center gap-3 px-5 pb-4 pt-5">
        <Avatar name={app.person.full_name} size={48} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold text-gray-900">{app.person.full_name}</p>
          <p className="text-sm text-gray-500">{app.person.employee_no ? `#${app.person.employee_no}` : ''}</p>
        </div>
        <span className="text-base font-semibold" style={{ color: st.color }}>{isCancelReq ? t('cancelReq') : st.label}</span>
      </div>

      {/* 决策参考:批准后余额 + 同期休假(待处理时放在最上面:先看,再点底部按钮) */}
      {!imported && (isPending || isCancelReq) && (
        <Card className="mb-3">
          {bal && (
            <div className="px-4 py-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-2 text-[15px] text-gray-600">
                  <span className="h-2 w-2 rounded-full" style={{ background: TYPE_COLOR[app.leave_type] ?? '#8C8C8C' }} />
                  {isPending ? t('afterApprove') : t('remainingDays')}
                </span>
                {/* 待审批时 remaining 已经扣掉了本次申请,所以它就是"批准后剩余" */}
                <span className={`text-xl font-semibold tabular-nums ${bal.remaining < 0 ? 'text-st-rejected-text' : 'text-gray-900'}`}>
                  {fmtNum(bal.remaining)}<span className="ml-1 text-sm font-normal text-gray-500">{t('daysUnit')}</span>
                </span>
              </div>
              {isPending && bal.remaining < 0 && (
                <p className="mt-2 rounded-lg bg-st-rejected-soft px-3 py-2 text-[13px] leading-snug text-st-rejected-text">{t('overdrawWarn')}</p>
              )}
              <p className="mt-1.5 text-xs text-gray-500">
                {t('quota')} {fmtNum(bal.total)} · {t('usedDays')} {fmtNum(bal.used)} · {t('pendingDays')} {fmtNum(bal.pending)}
              </p>
            </div>
          )}
          <div className={`px-4 py-3.5 ${bal ? 'border-t border-gray-100' : ''}`}>
            <div className="flex items-start justify-between gap-6">
              <span className="shrink-0 text-[15px] text-gray-500">{t('sameTime')}</span>
              {overlap.length === 0 && <span className="text-right text-[15px] text-gray-500">{t('noneSame')}</span>}
            </div>
            {overlap.length > 0 && (
              <p className="mt-2 rounded-lg bg-st-pending-soft px-3 py-2 text-[13px] leading-snug text-st-pending-text">
                {overlap.length} {t('peopleUnit')} · {overlap.join(lang === 'zh' ? '、' : ', ')}
              </p>
            )}
          </div>
        </Card>
      )}

      <Card>
        {rows.map(([k, v], i) => (
          <div key={k} className={`flex items-start justify-between gap-6 px-4 py-3.5 ${i ? 'border-t border-gray-100' : ''}`}>
            <span className="shrink-0 text-[15px] text-gray-500">{k}</span>
            <span className="text-right text-[15px] text-gray-900">{v}</span>
          </div>
        ))}
        {app.leave_type === 'medical' && !imported && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3.5">
            <span className="text-[15px] text-gray-500">MC</span>
            {app.mc_attachment_path ? (
              <button
                onClick={async () => { const u = await getMcSignedUrl(app.mc_attachment_path as string); if (u) window.open(u, '_blank', 'noopener,noreferrer'); else toast.show(t('toastFail')) }}
                className="text-[15px] text-brand"
              >{t('viewMc')}</button>
            ) : <span className="text-[15px] font-medium text-st-pending-text">{t('mcMissing')}</span>}
          </div>
        )}
      </Card>

      {/* 进度 */}
      {!imported && (
        <Card className="mt-3 px-4 py-4">
          {steps.map((s, i) => (
            <div key={i} className="relative flex gap-3 pb-5 last:pb-0">
              {i < steps.length - 1 && <span className="absolute left-[5px] top-4 h-full w-px bg-gray-200" />}
              <span className={`relative z-[1] mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full ring-4 ring-white ${dot[s.tone]}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[15px] font-medium text-gray-900">{s.title}</p>
                  {s.time && <span className="shrink-0 text-xs text-gray-500">{fmtDateTime(s.time, lang)}</span>}
                </div>
                {s.sub && <p className="mt-1 text-sm text-gray-500">{s.sub}</p>}
              </div>
            </div>
          ))}
        </Card>
      )}

      <ConfirmSheet open={sheet === 'approve'} busy={busy} message={summary} title={t('confirmApprove')} confirmLabel={t('approve')} onClose={() => setSheet(null)} onConfirm={() => run('approve')} />
      <ConfirmSheet open={sheet === 'confirmCancel'} busy={busy} message={summary} title={t('confirmCancelTitle')} confirmLabel={t('confirmCancellation')} onClose={() => setSheet(null)} onConfirm={() => run('confirm_cancellation')} />
      <ReasonSheet key={`rj${sheet === 'reject'}`} open={sheet === 'reject'} required danger busy={busy} title={t('rejectTitle')} hint={t('rejectHint')} chips={[t('q1'), t('q2'), t('q3')]} confirmLabel={t('reject')} onClose={() => setSheet(null)} onConfirm={(r) => run('reject', r)} />
      <ReasonSheet key={`kp${sheet === 'keep'}`} open={sheet === 'keep'} required busy={busy} title={t('declineTitle')} hint={t('declineHint')} confirmLabel={t('keepLeave')} onClose={() => setSheet(null)} onConfirm={(r) => run('decline_cancellation', r)} />
      <ReasonSheet key={`mc${sheet === 'managerCancel'}`} open={sheet === 'managerCancel'} danger busy={busy} title={t('managerCancelTitle')} hint={t('managerCancelHint')} confirmLabel={t('confirm')} onClose={() => setSheet(null)} onConfirm={(r) => run('cancel', r)} />
      {toast.node}
    </SubPage>
  )
}
