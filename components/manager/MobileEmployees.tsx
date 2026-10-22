'use client'

import { useState } from 'react'
import Link from 'next/link'
import AuthStatus from '@/components/AuthStatus'
import { Avatar, Card, EI, Icon, ListSkeleton, SubPage, UnderlineTabs } from '@/components/employee/EmployeeShell'
import { useMgrT } from '@/lib/mgrText'
import { useStaff } from '@/lib/useStaff'

// 员工管理 · 列表:只显示关键信息,点进去才是详情(不再在列表里直接改资料)。
export default function MobileEmployees() {
  const { auth, staff, loading } = useStaff()
  const { t } = useMgrT()
  const [tab, setTab] = useState<'full_time' | 'part_time'>('full_time')
  if (auth.status !== 'ready') return <AuthStatus state={auth} />

  const full = staff.filter((s) => s.employment_type === 'full_time')
  const part = staff.filter((s) => s.employment_type === 'part_time')
  const list = tab === 'full_time' ? full : part

  return (
    <SubPage title={t('employees')} backHref="/workspace">
      <div className="border-b border-gray-100">
        <UnderlineTabs
          items={[{ key: 'full_time' as const, label: `${t('fullTime')} (${full.length})` }, { key: 'part_time' as const, label: `${t('partTime')} (${part.length})` }]}
          value={tab}
          onChange={setTab}
        />
      </div>

      <Card className="mt-3">
        <Link href="/manage/new" className="flex items-center gap-3 px-4 py-3.5 text-[15px] text-brand active:bg-gray-50">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft"><Icon d={EI.plus} size={20} /></span>
          {t('addEmployee')}
        </Link>
        {loading ? (
          <div className="border-t border-gray-100"><ListSkeleton rows={3} bare /></div>
        ) : list.length === 0 ? (
          <p className="border-t border-gray-100 py-10 text-center text-sm text-gray-500">{t('noEmployees')}</p>
        ) : (
          list.map((s) => (
            <Link key={s.id} href={`/manage/${s.id}`} className={`flex items-center gap-3 border-t border-gray-100 px-4 py-3 active:bg-gray-50 ${s.is_active ? '' : 'opacity-60'}`}>
              <Avatar name={s.full_name} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-gray-900">{s.full_name}</p>
                <p className="text-xs text-gray-500">{s.employee_no ? `#${s.employee_no} · ` : ''}{s.role === 'manager' ? t('roleManager') : t('roleStaff')}</p>
              </div>
              {!s.is_active && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{t('inactive')}</span>}
              <Icon d={EI.chevronR} size={16} className="text-gray-300" />
            </Link>
          ))
        )}
      </Card>
    </SubPage>
  )
}
