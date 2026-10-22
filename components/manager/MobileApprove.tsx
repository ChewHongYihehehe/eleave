'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import AuthStatus from '@/components/AuthStatus'
import RecordLeaveModal from '@/components/RecordLeaveModal'
import { ConfirmSheet, EI, EmptyState, Icon, ListSkeleton, useToast } from '@/components/employee/EmployeeShell'
import { TYPE_COLOR, fmtNum } from '@/lib/useLeaveData'
import { fmtRange } from '@/lib/employeeFmt'
import { leaveName, useMgrT } from '@/lib/mgrText'
import { isImported, useApprovals, type Application } from '@/lib/useApprovals'
import { Avatar, ManagerTabPage, PickerSheet, ReasonSheet } from './ManagerTabs'

// 审批 · 列表(参考钉钉:待我审批 / 已处理)。点一条进详情,批量模式可多选同意 / 拒绝。

type Seg = 'todo' | 'done'
type Sub = 'all' | 'approved' | 'rejected' | 'cancelled'
const PAGE = 15

export function statusOf(a: Pick<Application, 'status' | 'cancellation_status'>, t: ReturnType<typeof useMgrT>['t']) {
  if (a.status === 'approved' && a.cancellation_status === 'requested') return { label: t('sCancelReq'), color: '#0958D9' }
  if (a.status === 'approved') return { label: t('sApproved'), color: '#237804' }
  if (a.status === 'pending') return { label: t('sPending'), color: '#AD4E00' }
  if (a.status === 'rejected') return { label: t('sRejected'), color: '#CF1322' }
  if (a.status === 'cancelled') return { label: t('sCancelled'), color: '#595959' }
  return { label: a.status, color: '#8C8C8C' }
}

export default function MobileApprove() {
  const { auth, me, apps, attention, loading, error, send, reload } = useApprovals()
  const { t, lang } = useMgrT()
  const toast = useToast()
  const [seg, setSeg] = useState<Seg>('todo')
  const [sub, setSub] = useState<Sub>('all')
  const [staff, setStaff] = useState('')
  const [picker, setPicker] = useState(false)
  const [visible, setVisible] = useState(PAGE)
  const [selecting, setSelecting] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [confirm, setConfirm] = useState(false)
  const [reject, setReject] = useState(false)
  const [busy, setBusy] = useState(false)
  const [recordOpen, setRecordOpen] = useState(false)

  const list = useMemo(() => {
    const base = apps.filter((a) => {
      if (staff && a.employee_id !== staff) return false
      if (seg === 'todo') return a.status === 'pending' || (a.status === 'approved' && a.cancellation_status === 'requested')
      if (a.status === 'pending' || (a.status === 'approved' && a.cancellation_status === 'requested')) return false
      if (sub === 'approved') return a.status === 'approved'
      if (sub === 'rejected') return a.status === 'rejected'
      if (sub === 'cancelled') return a.status === 'cancelled'
      return true
    })
    return base
  }, [apps, seg, sub, staff])

  const staffOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const a of apps) seen.set(a.employee_id, a.person.full_name)
    return [{ value: '', label: t('allStaff') }, ...Array.from(seen, ([value, label]) => ({ value, label })).sort((x, y) => x.label.localeCompare(y.label))]
  }, [apps, t])

  if (auth.status !== 'ready') return <AuthStatus state={auth} />

  const shown = list.slice(0, visible)
  const staffLabel = staffOptions.find((o) => o.value === staff)?.label ?? t('allStaff')
  // 批量只对"待审批"(不含取消申请)
  const canPick = (a: Application) => a.status === 'pending'

  function exitSelect() { setSelecting(false); setPicked(new Set()) }
  function toggle(id: string) {
    setPicked((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  async function run(action: 'approve' | 'reject', reason?: string) {
    setBusy(true)
    const err = await send(action, Array.from(picked), reason)
    setBusy(false)
    setConfirm(false); setReject(false)
    if (err) { toast.show(err); return }
    toast.show(t('toastOk'))
    exitSelect()
  }

  return (
    <ManagerTabPage tab="approve" badge={attention.length}>
      <div className="sticky top-0 z-10 bg-app px-4 pb-2 pt-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">{t('approvals')}</h1>
          <div className="flex items-center gap-2">
            {seg === 'todo' && list.some(canPick) && (
              <button onClick={() => (selecting ? exitSelect() : setSelecting(true))} className="rounded-full bg-white px-3.5 py-1.5 text-sm text-gray-700">
                {selecting ? t('done') : t('batch')}
              </button>
            )}
            <button onClick={() => setRecordOpen(true)} className="flex items-center gap-1 rounded-full bg-brand px-3.5 py-1.5 text-sm font-medium text-white">
              <Icon d={EI.plus} size={16} />{t('recordLeave')}
            </button>
          </div>
        </div>

        {/* 分段:待我审批 / 已处理 */}
        <div className="mt-3 flex rounded-lg bg-gray-200/70 p-0.5">
          {(['todo', 'done'] as const).map((k) => (
            <button key={k} onClick={() => { setSeg(k); setVisible(PAGE); exitSelect() }} className={`flex-1 rounded-md py-1.5 text-sm ${seg === k ? 'bg-white font-semibold text-gray-900 shadow-sm' : 'text-gray-500'}`}>
              {k === 'todo' ? `${t('toApprove')}${attention.length ? ` (${attention.length})` : ''}` : t('processed')}
            </button>
          ))}
        </div>

        {/* 筛选:员工 + (已处理时)状态 */}
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
          <button onClick={() => setPicker(true)} className={`flex shrink-0 items-center gap-1 rounded-full px-3.5 py-1.5 text-sm ${staff ? 'bg-brand-soft font-medium text-brand' : 'bg-white text-gray-600'}`}>
            {staffLabel}<Icon d="M6 9l6 6 6-6" size={14} />
          </button>
          {seg === 'done' && (['all', 'approved', 'rejected', 'cancelled'] as const).map((k) => (
            <button key={k} onClick={() => { setSub(k); setVisible(PAGE) }} className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm ${sub === k ? 'bg-brand font-medium text-white' : 'bg-white text-gray-600'}`}>
              {t(k)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <ListSkeleton />
      ) : error && apps.length === 0 ? (
        <EmptyState tone="warn" icon={EI.alert} title={t('loadFail')}>
          <button onClick={reload} className="mt-5 rounded-full bg-brand px-6 py-2.5 text-sm font-medium text-white active:bg-brand-deep">{t('retry')}</button>
        </EmptyState>
      ) : list.length === 0 ? (
        <EmptyState icon={EI.check} title={seg === 'todo' ? t('emptyTodo') : t('noItems')} hint={seg === 'todo' ? t('emptyTodoHint') : undefined} />
      ) : (
        <div className="mx-4 mt-2 overflow-hidden rounded-xl bg-white">
          {shown.map((a, i) => {
            const st = statusOf(a, t)
            const isCancelReq = a.status === 'approved' && a.cancellation_status === 'requested'
            const pick = selecting && canPick(a)
            const row = (
              <>
                {selecting && (
                  <span className={`mr-3 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${picked.has(a.id) ? 'border-brand bg-brand' : canPick(a) ? 'border-gray-300' : 'border-gray-100 bg-gray-100'}`}>
                    {picked.has(a.id) && <Icon d="M5 12.5l4.5 4.5L19 7.5" size={13} className="text-white" />}
                  </span>
                )}
                <Avatar name={a.person.full_name} size={40} />
                <div className="ml-3 min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-[15px] font-medium text-gray-900">{a.person.full_name}</p>
                    {seg === 'todo' && !isCancelReq ? (
                      // 待我审批里每一行都是"待审批",写出来没有信息量;右边改放天数(决策最需要的数字)
                      <span className="shrink-0 text-[15px] font-semibold tabular-nums text-gray-900">
                        {fmtNum(Number(a.total_days))}<span className="ml-0.5 text-xs font-normal text-gray-500">{t('daysUnit')}</span>
                      </span>
                    ) : (
                      <span className="shrink-0 text-sm font-medium" style={{ color: st.color }}>{isCancelReq ? t('cancelReq') : st.label}</span>
                    )}
                  </div>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-gray-700">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: TYPE_COLOR[a.leave_type] ?? '#8C8C8C' }} />
                    <span className="truncate">
                      {leaveName(a.leave_type, lang)}
                      {a.is_half_day && a.half_day_period ? ` · ${a.half_day_period === 'am' ? t('halfAm') : t('halfPm')}` : ''}
                      {' · '}{fmtRange(a, lang, t('imported'))}
                      {seg === 'done' || isCancelReq ? ` · ${fmtNum(Number(a.total_days))} ${t('daysUnit')}` : ''}
                    </span>
                  </p>
                  {a.reason && !isImported(a) && <p className="mt-0.5 truncate text-xs text-gray-500">{a.reason}</p>}
                </div>
              </>
            )
            const cls = `flex items-center px-4 py-3.5 ${i ? 'border-t border-gray-100' : ''}`
            return selecting ? (
              <button key={a.id} type="button" onClick={() => pick && toggle(a.id)} className={`${cls} w-full text-left ${canPick(a) ? '' : 'opacity-40'}`}>{row}</button>
            ) : (
              <Link key={a.id} href={`/approve/${a.id}`} className={`${cls} active:bg-gray-50`}>{row}</Link>
            )
          })}
        </div>
      )}
      {list.length > visible && (
        <button onClick={() => setVisible((v) => v + PAGE)} className="mx-auto mt-4 block rounded-full bg-white px-6 py-2 text-sm text-brand">{t('loadMore')}</button>
      )}

      {/* 批量模式的底部操作条(盖在底部栏上面) */}
      {selecting && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white px-4 pt-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
          <div className="mx-auto flex max-w-md items-center gap-3">
            <button
              onClick={() => {
                const all = list.filter(canPick).map((a) => a.id)
                setPicked((p) => (p.size === all.length ? new Set() : new Set(all)))
              }}
              className="shrink-0 text-sm text-gray-600"
            >
              {t('all')}
            </button>
            <span className="flex-1 text-sm text-gray-500">{t('selected')} {picked.size}</span>
            <button disabled={picked.size === 0} onClick={() => setReject(true)} className="rounded-lg border border-st-rejected/40 px-5 py-2.5 text-[15px] font-medium text-st-rejected-text disabled:opacity-40">{t('reject')}</button>
            <button disabled={picked.size === 0} onClick={() => setConfirm(true)} className="rounded-lg bg-brand px-5 py-2.5 text-[15px] font-semibold text-white disabled:opacity-40">{t('approve')}</button>
          </div>
        </div>
      )}

      <PickerSheet open={picker} title={t('selectStaff')} options={staffOptions} value={staff} onPick={(v) => { setStaff(v); setVisible(PAGE) }} onClose={() => setPicker(false)} />
      <ConfirmSheet open={confirm} busy={busy} title={t('confirmApproveBatch')} confirmLabel={`${t('approve')} (${picked.size})`} onClose={() => setConfirm(false)} onConfirm={() => run('approve')} />
      <ReasonSheet
        key={reject ? 'r1' : 'r0'}
        open={reject} required danger busy={busy} title={t('rejectTitle')} hint={t('rejectHint')}
        chips={[t('q1'), t('q2'), t('q3')]} confirmLabel={t('reject')}
        onClose={() => setReject(false)} onConfirm={(r) => run('reject', r)}
      />
      {recordOpen && me && (
        <RecordLeaveModal approverId={me.id} onClose={() => setRecordOpen(false)} onSaved={() => { setRecordOpen(false); toast.show(t('toastOk')); reload() }} />
      )}
      {toast.node}
    </ManagerTabPage>
  )
}
