'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import AuthStatus from '@/components/AuthStatus'
import { useLang, leaveTypeName } from '@/lib/lang'
import { useLeaveData, fmtNum, TYPE_COLOR } from '@/lib/useLeaveData'
import { fmtRange, statusInfo } from '@/lib/employeeFmt'
import { Card, EI, Icon, SubPage } from '@/components/employee/EmployeeShell'

// 假期余额详情(钉钉:点进某个假种看明细):额度拆解 + 该假种今年的记录。

export default function BalanceDetail() {
  const { type } = useParams<{ type: string }>()
  const { auth, balances, apps, loading } = useLeaveData()
  const { lang, t } = useLang()
  if (auth.status !== 'ready') return <AuthStatus state={auth} />

  const b = balances.find((x) => x.type === type)
  const list = apps.filter((a) => a.leave_type === type).sort((a, z) => (a.start_date < z.start_date ? 1 : -1))
  const rows: [string, number][] = [[t('total'), b?.base ?? 0]]
  if (b && b.carry > 0) rows.push([t('carryForward'), b.carry])
  rows.push([t('usedDays'), b?.used ?? 0], [t('pendingDays'), b?.pending ?? 0])

  return (
    <SubPage title={leaveTypeName(type, lang)} backHref="/dashboard">
      <div className="px-5 pb-5 pt-6 text-center">
        <p className="flex items-center justify-center gap-1.5 text-sm text-gray-500">
          <span className="h-2 w-2 rounded-full" style={{ background: TYPE_COLOR[type] ?? '#8C8C8C' }} />{t('remainingDays')} · {new Date().getFullYear()}
        </p>
        <p className="mt-2 text-5xl font-bold text-gray-900">
          {b ? fmtNum(b.remaining) : '–'}<span className="ml-1.5 text-base font-normal text-gray-400">{t('daysUnit')}</span>
        </p>
      </div>

      <Card>
        {rows.map(([k, v], i) => (
          <div key={k} className={`flex items-center justify-between px-4 py-3.5 ${i ? 'border-t border-gray-100' : ''}`}>
            <span className="text-[15px] text-gray-500">{k}</span>
            <span className="text-[15px] text-gray-900">{fmtNum(v)} {t('daysUnit')}</span>
          </div>
        ))}
      </Card>

      <p className="px-5 pb-2 pt-4 text-sm text-gray-500">{t('yearRecords')}</p>
      {loading ? (
        <p className="py-10 text-center text-sm text-gray-400">{t('loading')}</p>
      ) : list.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400">{t('noRecords')}</p>
      ) : (
        <Card>
          {list.map((a, i) => {
            const st = statusInfo(a, t)
            return (
              <Link key={a.id} href={`/dashboard/records/${a.id}`} className={`flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 ${i ? 'border-t border-gray-100' : ''}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] text-gray-900">{fmtRange(a, lang, t('imported'))}</p>
                  <p className="mt-0.5 text-xs text-gray-400">{fmtNum(Number(a.total_days))} {t('daysUnit')}</p>
                </div>
                <span className="text-sm font-medium" style={{ color: st.color }}>{st.label}</span>
                <Icon d={EI.chevronR} size={16} className="text-gray-300" />
              </Link>
            )
          })}
        </Card>
      )}
    </SubPage>
  )
}
