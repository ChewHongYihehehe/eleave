'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import AuthStatus from '@/components/AuthStatus'
import { useLang, leaveTypeName } from '@/lib/lang'
import { useLeaveData, TYPE_COLOR, fmtNum } from '@/lib/useLeaveData'
import { fmtRange, monthLabel, statusInfo } from '@/lib/employeeFmt'
import { markNoticesSeen } from '@/lib/employeeActions'
import { EI, EmptyState, Icon, KV, ListSkeleton, NavButton, TabHeader, TabPage, UnderlineTabs, useToast } from '@/components/employee/EmployeeShell'

const TABS = ['all', 'pending', 'approved', 'rejected', 'cancelled'] as const
type Tab = (typeof TABS)[number]
const PAGE = 10

function Records() {
  const { auth, apps, unseenCount, isUnseen, loading } = useLeaveData()
  const { lang, t } = useLang()
  const params = useSearchParams()
  const initial = params.get('tab') as Tab | null
  const [tab, setTab] = useState<Tab>(initial && TABS.includes(initial) ? initial : 'all')
  const [visible, setVisible] = useState(PAGE)
  const toast = useToast()

  // 提交成功后从申请页跳过来,提示一下
  useEffect(() => {
    if (params.get('toast') === 'submitted') toast.show(t('toastSubmitted'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 进了记录页就算"看过"了(红点在本次访问内保留,下次进来才消失)
  useEffect(() => {
    if (auth.status !== 'ready' || loading || unseenCount === 0) return
    const id = setTimeout(markNoticesSeen, 1500)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status, loading])

  const filtered = useMemo(() => {
    const list = apps.filter((a) => {
      if (tab === 'pending') return a.status === 'pending' || a.cancellation_status === 'requested'
      if (tab === 'approved') return a.status === 'approved' && a.cancellation_status !== 'requested'
      if (tab === 'rejected') return a.status === 'rejected'
      if (tab === 'cancelled') return a.status === 'cancelled'
      return true
    })
    return [...list].sort((a, b) => (a.start_date < b.start_date ? 1 : -1))
  }, [apps, tab])

  if (auth.status !== 'ready') return <AuthStatus state={auth} />

  const shown = filtered.slice(0, visible)
  const groups: { ym: string; items: typeof shown }[] = []
  for (const a of shown) {
    const ym = a.start_date.slice(0, 7)
    const g = groups[groups.length - 1]
    if (g && g.ym === ym) g.items.push(a)
    else groups.push({ ym, items: [a] })
  }
  const label = (k: Tab) => (k === 'all' ? t('all') : k === 'pending' ? t('sPending') : k === 'approved' ? t('sApproved') : k === 'rejected' ? t('sRejected') : t('sCancelled'))

  return (
    <TabPage tab="records" badge={unseenCount}>
      <TabHeader
        title={t('myRecords')}
        right={<NavButton href="/dashboard/apply" strong><Icon d={EI.plus} size={18} />{t('applyLeave')}</NavButton>}
      >
        <UnderlineTabs scroll items={TABS.map((k) => ({ key: k, label: label(k) }))} value={tab} onChange={(k) => { setTab(k); setVisible(PAGE) }} />
      </TabHeader>

      {loading ? (
        <ListSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState icon={EI.records} title={t('noRecords')} />
      ) : (
        <>
          {groups.map((g) => (
            <section key={g.ym}>
              <p className="px-5 pb-2 pt-4 text-[13px] text-gray-500">{monthLabel(g.ym, lang)}</p>
              <div className="space-y-2.5">
                {g.items.map((a) => {
                  const st = statusInfo(a, t)
                  return (
                    <Link key={a.id} href={`/dashboard/records/${a.id}`} className="mx-4 block rounded-xl bg-white px-4 py-3.5 active:bg-gray-50">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: TYPE_COLOR[a.leave_type] ?? '#8C8C8C' }} />
                          <span className="truncate text-base font-semibold text-gray-900">
                            {leaveTypeName(a.leave_type, lang)}
                            {a.is_half_day && a.half_day_period && <span className="ml-1 text-xs font-normal text-gray-400">({a.half_day_period === 'am' ? t('am') : t('pm')})</span>}
                          </span>
                          {isUnseen(a) && <span className="h-2 w-2 shrink-0 rounded-full bg-st-rejected" />}
                        </div>
                        <span className="flex shrink-0 items-center gap-0.5 text-sm font-medium" style={{ color: st.color }}>
                          {st.label}<Icon d={EI.chevronR} size={14} className="text-gray-300" />
                        </span>
                      </div>
                      <div className="mt-2.5 space-y-0.5">
                        <KV k={t('dates')} v={fmtRange(a, lang, t('imported'))} />
                        <KV k={t('duration')} v={`${fmtNum(Number(a.total_days))} ${t('daysUnit')}`} />
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>
          ))}
          {filtered.length > visible && (
            <button onClick={() => setVisible((v) => v + PAGE)} className="mx-auto mt-4 block rounded-full bg-white px-6 py-2 text-sm text-brand">{t('loadMore')}</button>
          )}
        </>
      )}
      {toast.node}
    </TabPage>
  )
}

export default function RecordsPage() {
  return (
    <Suspense fallback={null}>
      <Records />
    </Suspense>
  )
}
