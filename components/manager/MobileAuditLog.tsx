'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import AuthStatus from '@/components/AuthStatus'
import { Card, EI, EmptyState, Icon, ListSkeleton, SubPage } from '@/components/employee/EmployeeShell'
import { PickerSheet } from '@/components/manager/ManagerTabs'
import { supabase } from '@/lib/supabaseClient'
import { useEmployee } from '@/lib/useEmployee'
import { toLocalDateStr } from '@/lib/dateUtils'
import { fmtNum } from '@/lib/useLeaveData'
import { MONTH_MS, leaveName, localeOf, useMgrT } from '@/lib/mgrText'

// 审计日志 · 手机版(钉钉风格):
//  · 顶部一排可左右滑动的筛选标签(员工 + 审批 / 取消 / 代录入 / 账号)
//  · 按日期分组(今天 / 昨天 / 10月20日 周二),每条记录是一句话:"张三 批准了 李四 的年假"
//  · 左边一个小色块图标区分类型(绿 = 批准、红 = 拒绝、橙 = 取消、蓝 = 申请/代录入、灰 = 账号)
//  · 底部"加载更多"(一次最多取最近 500 条,每次多显示 30 条)
// 读的表和电脑版一样:audit_log。

const PAGE = 30
const LIMIT = 500
const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type Cat = 'approval' | 'cancel' | 'recorded' | 'account'
const CAT_ACTIONS: Record<Cat, string[]> = {
  approval: ['leave.applied', 'leave.approved', 'leave.rejected'],
  cancel: ['leave.cancelled_by_manager', 'leave.cancellation_confirmed', 'leave.cancellation_declined'],
  recorded: ['leave.recorded_by_manager'],
  account: ['employee.password_reset', 'employee.activated', 'employee.deactivated', 'employee.field_updated'],
}
const CAT_ORDER: Cat[] = ['approval', 'cancel', 'recorded', 'account']

type Tone = 'approved' | 'rejected' | 'cancel' | 'info' | 'muted'
const TONE_CLS: Record<Tone, string> = {
  approved: 'bg-st-approved-soft text-st-approved-text',
  rejected: 'bg-st-rejected-soft text-st-rejected-text',
  cancel: 'bg-st-pending-soft text-st-pending-text',
  info: 'bg-brand-soft text-brand',
  muted: 'bg-st-muted-soft text-st-muted-text',
}
const IC = {
  x: 'M6 6l12 12M18 6L6 18',
  minus: 'M5 12h14',
  plus: 'M12 5v14M5 12h14',
  send: 'M5 12h14M13 6l6 6-6 6',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0',
  doc: 'M7 4h7l4 4v12H7zM14 4v4h4M10 13h5M10 16h5',
  caret: 'M6 9l6 6 6-6',
}
const META: Record<string, { tone: Tone; icon: string }> = {
  'leave.applied': { tone: 'info', icon: IC.send },
  'leave.approved': { tone: 'approved', icon: EI.check },
  'leave.rejected': { tone: 'rejected', icon: IC.x },
  'leave.cancelled_by_manager': { tone: 'cancel', icon: IC.minus },
  'leave.cancellation_confirmed': { tone: 'cancel', icon: EI.check },
  'leave.cancellation_declined': { tone: 'rejected', icon: IC.x },
  'leave.recorded_by_manager': { tone: 'info', icon: IC.plus },
  'employee.password_reset': { tone: 'muted', icon: IC.user },
  'employee.activated': { tone: 'muted', icon: IC.user },
  'employee.deactivated': { tone: 'muted', icon: IC.user },
  'employee.field_updated': { tone: 'muted', icon: IC.user },
}

// 一句话的写法。{A} = 操作的人,{T} = 被操作的员工,{X} = 假期种类 / 修改的栏位
const TPL = {
  zh: {
    'leave.applied': '{A} 提交了{X}申请',
    'leave.approved': '{A} 批准了 {T} 的{X}',
    'leave.rejected': '{A} 拒绝了 {T} 的{X}',
    'leave.cancelled_by_manager': '{A} 取消了 {T} 的{X}',
    'leave.cancellation_confirmed': '{A} 同意了 {T} 的{X}取消申请',
    'leave.cancellation_declined': '{A} 拒绝了 {T} 的{X}取消申请',
    'leave.recorded_by_manager': '{A} 为 {T} 代录入了{X}',
    'employee.password_reset': '{A} 重置了 {T} 的密码',
    'employee.activated': '{A} 启用了 {T} 的账号',
    'employee.deactivated': '{A} 停用了 {T} 的账号',
    'employee.field_updated': '{A} 修改了 {T} 的{X}',
  },
  ms: {
    'leave.applied': '{A} memohon {X}',
    'leave.approved': '{A} meluluskan {X} {T}',
    'leave.rejected': '{A} menolak {X} {T}',
    'leave.cancelled_by_manager': '{A} membatalkan {X} {T}',
    'leave.cancellation_confirmed': '{A} mengesahkan pembatalan {X} {T}',
    'leave.cancellation_declined': '{A} menolak pembatalan {X} {T}',
    'leave.recorded_by_manager': '{A} merekodkan {X} untuk {T}',
    'employee.password_reset': '{A} menetapkan semula kata laluan {T}',
    'employee.activated': '{A} mengaktifkan akaun {T}',
    'employee.deactivated': '{A} menyahaktifkan akaun {T}',
    'employee.field_updated': '{A} mengubah {X} {T}',
  },
  en: {
    'leave.applied': '{A} applied for {X}',
    'leave.approved': '{A} approved {T}’s {X}',
    'leave.rejected': '{A} rejected {T}’s {X}',
    'leave.cancelled_by_manager': '{A} cancelled {T}’s {X}',
    'leave.cancellation_confirmed': '{A} confirmed {T}’s {X} cancellation',
    'leave.cancellation_declined': '{A} declined {T}’s {X} cancellation',
    'leave.recorded_by_manager': '{A} recorded {X} for {T}',
    'employee.password_reset': '{A} reset {T}’s password',
    'employee.activated': '{A} activated {T}’s account',
    'employee.deactivated': '{A} deactivated {T}’s account',
    'employee.field_updated': '{A} changed {T}’s {X}',
  },
} as const

const TXT = {
  zh: {
    cat: { approval: '审批', cancel: '取消', recorded: '代录入', account: '账号' } as Record<Cat, string>,
    yesterday: '昨天', reason: '原因', mc: 'MC 已附', limit: `仅显示最近 ${LIMIT} 条记录`, leave: '假期',
    fields: { date_of_commencement: '入职日期', annual_leave_carry_forward: '年假结转', role: '角色' } as Record<string, string>,
    days: '天',
  },
  ms: {
    cat: { approval: 'Kelulusan', cancel: 'Pembatalan', recorded: 'Direkodkan', account: 'Akaun' } as Record<Cat, string>,
    yesterday: 'Semalam', reason: 'Sebab', mc: 'MC Disertakan', limit: `Hanya memaparkan ${LIMIT} rekod terkini`, leave: 'cuti',
    fields: { date_of_commencement: 'tarikh mula kerja', annual_leave_carry_forward: 'bawa ke hadapan cuti tahunan', role: 'peranan' } as Record<string, string>,
    days: 'hari',
  },
  en: {
    cat: { approval: 'Approvals', cancel: 'Cancellations', recorded: 'Recorded', account: 'Accounts' } as Record<Cat, string>,
    yesterday: 'Yesterday', reason: 'Reason', mc: 'MC attached', limit: `Showing the latest ${LIMIT} entries`, leave: 'leave',
    fields: { date_of_commencement: 'commencement date', annual_leave_carry_forward: 'annual leave carry-forward', role: 'role' } as Record<string, string>,
    days: 'day(s)',
  },
}

type Leave = { leave_type: string; start_date: string; end_date: string; total_days: number }
type NameRef = { full_name: string }
type LogRow = {
  id: string
  action: string
  created_at: string
  details: Record<string, unknown> | null
  actor: NameRef | NameRef[] | null
  target: NameRef | NameRef[] | null
  leave?: Leave | Leave[] | null
}

// 关联查询在某些版本会回传数组,两种都接受
function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
}

function fmtD(iso: string, lang: string) {
  const [, m, d] = iso.split('-').map(Number)
  return lang === 'zh' ? `${m}月${d}日` : `${d} ${(lang === 'ms' ? MONTH_MS : MONTH_EN)[m - 1]}`
}

function renderTpl(tpl: string, vars: { A: string; T: string; X: string }) {
  return tpl.split(/(\{[ATX]\})/).map((part, i) => {
    const m = part.match(/^\{([ATX])\}$/)
    if (!m) return <span key={i}>{part}</span>
    const k = m[1] as 'A' | 'T' | 'X'
    return k === 'X' ? <span key={i}>{vars.X}</span> : <b key={i} className="font-semibold text-gray-900">{vars[k]}</b>
  })
}

const str = (v: unknown) => (typeof v === 'string' && v ? v : null)

export default function MobileAuditLog() {
  const auth = useEmployee({ requireManager: true })
  const { t, lang } = useMgrT()
  const L = TXT[lang as 'zh'|'en'|'ms'] ?? TXT.en

  const [logs, setLogs] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [visible, setVisible] = useState(PAGE)
  const [cat, setCat] = useState<Cat | ''>('')
  const [empId, setEmpId] = useState('')
  const [staff, setStaff] = useState<{ id: string; full_name: string }[]>([])
  const [pickOpen, setPickOpen] = useState(false)
  const reqId = useRef(0)

  useEffect(() => {
    if (auth.status !== 'ready') return
    supabase.from('employees').select('id, full_name').order('full_name', { ascending: true }).then(({ data }) => {
      if (data) setStaff(data)
    })
  }, [auth.status])

  useEffect(() => {
    if (auth.status === 'ready') load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status, cat, empId])

  async function load() {
    const my = ++reqId.current
    setLoading(true)
    setFailed(false)

    const run = (withLeave: boolean) => {
      let q = supabase
        .from('audit_log')
        .select(
          `id, action, created_at, details,
           actor:employees!audit_log_actor_id_fkey(full_name),
           target:employees!audit_log_target_employee_id_fkey(full_name)` +
            (withLeave ? ', leave:leave_applications(leave_type, start_date, end_date, total_days)' : ''),
        )
        .order('created_at', { ascending: false })
        .limit(LIMIT)
      if (empId) q = q.or(`actor_id.eq.${empId},target_employee_id.eq.${empId}`)
      if (cat) q = q.in('action', CAT_ACTIONS[cat])
      return q
    }

    let res = await run(true)
    // 万一关联假期资料这一步查不到,退回去只查日志本身,页面照样能用(只是少了假期种类和日期)
    if (res.error) res = await run(false)
    if (my !== reqId.current) return
    setLoading(false)
    if (res.error) { setFailed(true); return }
    setLogs((res.data || []) as unknown as LogRow[])
    setVisible(PAGE)
  }

  const groups = useMemo(() => {
    const today = toLocalDateStr(new Date())
    const yest = toLocalDateStr(new Date(Date.now() - 86400000))
    const thisYear = new Date().getFullYear()
    const label = (key: string) => {
      if (key === today) return t('today')
      if (key === yest) return L.yesterday
      const [y, m, d] = key.split('-').map(Number)
      const dt = new Date(y, m - 1, d)
      return lang === 'zh'
        ? dt.toLocaleDateString('zh-CN', { year: y === thisYear ? undefined : 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
        : dt.toLocaleDateString(localeOf(lang), { year: y === thisYear ? undefined : 'numeric', weekday: 'short', day: 'numeric', month: 'short' })
    }
    const out: { key: string; label: string; rows: LogRow[] }[] = []
    for (const r of logs.slice(0, visible)) {
      const key = toLocalDateStr(new Date(r.created_at))
      const last = out[out.length - 1]
      if (last && last.key === key) last.rows.push(r)
      else out.push({ key, label: label(key), rows: [r] })
    }
    return out
  }, [logs, visible, lang, t, L.yesterday])

  if (auth.status !== 'ready') return <AuthStatus state={auth} />

  const empName = staff.find((s) => s.id === empId)?.full_name

  function row(log: LogRow) {
    const meta = META[log.action] ?? { tone: 'muted' as Tone, icon: IC.doc }
    const d = log.details || {}
    const lv = one(log.leave)
    const leaveType = lv?.leave_type ?? str(d.leave_type)
    const start = lv?.start_date ?? str(d.start_date)
    const end = lv?.end_date ?? str(d.end_date)
    const total = lv?.total_days ?? (typeof d.total_days === 'number' ? d.total_days : null)

    const actor = one(log.actor)?.full_name || '—'
    const target = one(log.target)?.full_name || '—'
    const isField = log.action === 'employee.field_updated'
    const X = isField ? (L.fields[String(d.field)] ?? String(d.field ?? '')) : leaveType ? leaveName(leaveType, lang) : L.leave
    const tpl = ((TPL[lang as 'zh'|'en'|'ms'] ?? TPL.en) as Record<string, string>)[log.action]

    // 第二行:日期 · 天数(或字段修改前后)
    let line: string | null = null
    if (isField) line = `${String(d.from ?? '—')} → ${String(d.to ?? '—')}`
    else if (start) {
      line = end && end !== start ? `${fmtD(start, lang)} – ${fmtD(end, lang)}` : fmtD(start, lang)
      if (total != null) line += ` · ${fmtNum(Number(total))} ${L.days}`
    }
    const reason = str(d.reason)
    const tags = [d.mc_attached ? L.mc : null, d.via === 'telegram' ? 'Telegram' : null].filter(Boolean) as string[]
    const time = new Date(log.created_at).toLocaleTimeString(localeOf(lang), { hour: '2-digit', minute: '2-digit', hour12: false })

    return (
      <div key={log.id} className="flex gap-3 border-t border-gray-100 px-4 py-3.5 first:border-t-0">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${TONE_CLS[meta.tone]}`}>
          <Icon d={meta.icon} size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="break-words text-[15px] leading-snug text-gray-700">
            {tpl ? renderTpl(tpl, { A: actor, T: target, X }) : <span>{log.action}</span>}
          </p>
          {(line || tags.length > 0) && (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-gray-600">
              {line && <span>{line}</span>}
              {tags.map((g) => (
                <span key={g} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{g}</span>
              ))}
            </p>
          )}
          {reason && (
            <p className="mt-2 break-words rounded-lg bg-gray-50 px-3 py-2 text-[13px] leading-snug text-gray-700">
              {L.reason}：{reason}
            </p>
          )}
        </div>
        <span className="shrink-0 pt-0.5 text-xs tabular-nums text-gray-500">{time}</span>
      </div>
    )
  }

  const chip = (active: boolean, soft = false) =>
    `inline-flex h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium ${
      active ? (soft ? 'bg-brand-soft text-brand' : 'bg-brand text-white') : 'bg-white text-gray-700'
    }`

  return (
    <SubPage title={t('auditLog')} backHref="/workspace">
      {/* 筛选标签:贴在顶栏下面,往下滚动时也一直在 */}
      <div className="sticky top-12 z-10 bg-app py-3">
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4">
          <button onClick={() => setPickOpen(true)} className={chip(!!empId, true)}>
            <span className="max-w-[9rem] truncate">{empName || t('allStaff')}</span>
            <Icon d={IC.caret} size={14} />
          </button>
          <span className="my-2.5 w-px shrink-0 bg-gray-300" aria-hidden />
          <button onClick={() => setCat('')} className={chip(cat === '')}>{t('all')}</button>
          {CAT_ORDER.map((c) => (
            <button key={c} onClick={() => setCat(cat === c ? '' : c)} className={chip(cat === c)}>{L.cat[c]}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <ListSkeleton />
      ) : failed ? (
        <EmptyState tone="warn" icon={EI.alert} title={t('loadFail')}>
          <button onClick={load} className="mt-5 rounded-full bg-brand px-6 py-2.5 text-sm font-medium text-white active:bg-brand-deep">{t('retry')}</button>
        </EmptyState>
      ) : groups.length === 0 ? (
        <EmptyState icon={IC.doc} title={t('noItems')} />
      ) : (
        <>
          {groups.map((g) => (
            <section key={g.key}>
              <p className="px-4 pb-2 pt-3 text-[13px] font-medium text-gray-500">{g.label}</p>
              <Card>{g.rows.map(row)}</Card>
            </section>
          ))}
          {visible < logs.length ? (
            <button onClick={() => setVisible((v) => v + PAGE)} className="mx-auto mt-4 flex h-11 items-center px-6 text-[15px] font-medium text-brand active:opacity-60">
              {t('loadMore')}
            </button>
          ) : (
            logs.length >= LIMIT && <p className="mt-4 text-center text-xs text-gray-500">{L.limit}</p>
          )}
        </>
      )}

      <PickerSheet
        open={pickOpen}
        title={t('selectStaff')}
        options={[{ value: '', label: t('allStaff') }, ...staff.map((s) => ({ value: s.id, label: s.full_name }))]}
        value={empId}
        onPick={setEmpId}
        onClose={() => setPickOpen(false)}
      />
    </SubPage>
  )
}
