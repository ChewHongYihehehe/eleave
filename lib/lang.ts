'use client'

import { useCallback, useEffect, useState } from 'react'

// 中文 / English 切换。
// · 默认中文;选择会记在这台手机/电脑的浏览器里(localStorage)。
// · 所有文字都集中在这个文件,想改哪个词的中文,直接改下面 zh 里的那一行就好。
// · 之后每翻译一个页面,就在这里加新的词条(en 和 zh 各加一行)。

export type Lang = 'zh' | 'en'

const en = {
  // 导航
  workspace: 'Workspace',
  approvals: 'Approvals',
  calendarTab: 'Calendar',
  calendar: 'Team Calendar',
  me: 'Me',
  employees: 'Employees',
  reports: 'Reports',
  holidays: 'Holidays',
  workHours: 'Work Hours',
  auditLog: 'Audit Log',
  changePassword: 'Change Password',
  telegram: 'Telegram Notifications',
  logout: 'Log Out',
  manager: 'Manager',
  back: 'Back',
  // 工作台
  needsAttention: 'Needs attention',
  pendingApprovals: 'Pending approvals',
  onLeaveToday: 'On leave today',
  staffUnit: 'staff',
  allFeatures: 'All features',
  // 我的
  language: 'Language',
  account: 'Account',
  // 员工端
  hello: 'Hi',
  yearsOfService: 'years of service',
  quickActions: 'Quick actions',
  applyLeave: 'Request leave',
  myRecords: 'My records',
  records: 'Records',
  pendingTile: 'Pending',
  leaveBalance: 'Leave balance',
  upcomingHolidays: 'Upcoming holidays',
  today: 'Today',
  daysLeft: 'days left',
  daysUnit: 'days',
  total: 'Total',
  carryForward: 'Carried forward',
  usedDays: 'Used',
  pendingDays: 'Pending approval',
  remainingDays: 'Remaining',
  viewAllRecords: 'View all leave records',
  thisYear: 'this year',
  updatesOn: 'updates on your applications',
  all: 'All',
  sPending: 'Pending',
  sApproved: 'Approved',
  sRejected: 'Rejected',
  sCancelled: 'Cancelled',
  sCancelReq: 'Cancel requested',
  noRecords: 'No leave records',
  loadMore: 'Load more',
  details: 'Details',
  leaveType: 'Leave type',
  dates: 'Dates',
  startDate: 'Start date',
  endDate: 'End date',
  duration: 'Duration',
  halfDay: 'Half day',
  am: 'Morning',
  pm: 'Afternoon',
  note: 'Note',
  notePh: 'Optional note for your manager',
  submittedAt: 'Submitted',
  submit: 'Submit request',
  submitting: 'Submitting...',
  tlSubmitted: 'Submitted',
  tlReviewing: 'Waiting for manager',
  tlApproved: 'Approved',
  tlRejected: 'Rejected',
  tlCancelReq: 'Cancellation requested, waiting for manager',
  tlCancelled: 'Cancelled',
  rejectReason: 'Rejection reason',
  cancelDeclined: 'Cancellation declined',
  cancelReason: 'Cancellation note',
  cancelRequest: 'Cancel request',
  requestCancel: 'Request cancellation',
  withdraw: 'Withdraw cancellation',
  viewMc: 'View MC',
  attachMc: 'Attach MC',
  mcLabel: 'MC (photo or PDF, max 5MB)',
  uploading: 'Uploading...',
  thisRequest: 'This request',
  afterwards: 'Remaining afterwards',
  exceeds: 'Exceeds your balance',
  annualNote: "Weekends and public holidays aren't counted.",
  chooseDates: 'Please choose the leave dates.',
  endBeforeStart: 'End date cannot be before start date.',
  confirm: 'Confirm',
  cancel: 'Cancel',
  confirmCancelReq: 'Cancel this leave request?',
  confirmReqCancel: 'Your manager must confirm before the approved leave is cancelled.',
  toastSubmitted: 'Leave request submitted — pending approval.',
  toastFail: 'Something went wrong. Please try again.',
  toastMcAttached: 'MC attached.',
  loading: 'Loading...',
  notFound: 'Record not found.',
  imported: 'Imported',
  yearRecords: 'records this year',
}

export type DictKey = keyof typeof en

const zh: Record<DictKey, string> = {
  workspace: '工作台',
  approvals: '审批',
  calendarTab: '日历',
  calendar: '团队日历',
  me: '我的',
  employees: '员工',
  reports: '报表',
  holidays: '公假',
  workHours: '兼职工时',
  auditLog: '审计日志',
  changePassword: '更改密码',
  telegram: 'Telegram 通知',
  logout: '退出登录',
  manager: '负责人',
  back: '返回',
  needsAttention: '需要处理',
  pendingApprovals: '待审批',
  onLeaveToday: '今天休假',
  staffUnit: '人',
  allFeatures: '全部功能',
  language: '语言',
  account: '账号',
  hello: '你好',
  yearsOfService: '年工龄',
  quickActions: '快捷功能',
  applyLeave: '申请请假',
  myRecords: '我的记录',
  records: '记录',
  pendingTile: '待审批',
  leaveBalance: '假期余额',
  upcomingHolidays: '即将到来的公假',
  today: '今天',
  daysLeft: '天剩余',
  daysUnit: '天',
  total: '额度',
  carryForward: '去年结转',
  usedDays: '已用',
  pendingDays: '待审批',
  remainingDays: '剩余',
  viewAllRecords: '查看全部请假记录',
  thisYear: '今年',
  updatesOn: '条申请有新动态',
  all: '全部',
  sPending: '审批中',
  sApproved: '已通过',
  sRejected: '已拒绝',
  sCancelled: '已取消',
  sCancelReq: '取消申请中',
  noRecords: '暂无请假记录',
  loadMore: '加载更多',
  details: '详情',
  leaveType: '假期类型',
  dates: '日期',
  startDate: '开始日期',
  endDate: '结束日期',
  duration: '时长',
  halfDay: '半天',
  am: '上午',
  pm: '下午',
  note: '事由',
  notePh: '选填,写给负责人的说明',
  submittedAt: '提交时间',
  submit: '提交申请',
  submitting: '提交中…',
  tlSubmitted: '已提交',
  tlReviewing: '等待负责人审批',
  tlApproved: '审批通过',
  tlRejected: '审批拒绝',
  tlCancelReq: '已申请取消,等待负责人确认',
  tlCancelled: '已取消',
  rejectReason: '拒绝原因',
  cancelDeclined: '取消申请被拒绝',
  cancelReason: '取消说明',
  cancelRequest: '撤销申请',
  requestCancel: '申请取消',
  withdraw: '撤回取消申请',
  viewMc: '查看 MC',
  attachMc: '补传 MC',
  mcLabel: 'MC 凭证(照片或 PDF,最大 5MB)',
  uploading: '上传中…',
  thisRequest: '本次申请',
  afterwards: '申请后剩余',
  exceeds: '超出剩余额度',
  annualNote: '周末和公假不计入。',
  chooseDates: '请选择请假日期。',
  endBeforeStart: '结束日期不能早于开始日期。',
  confirm: '确认',
  cancel: '取消',
  confirmCancelReq: '确定撤销这笔请假申请吗?',
  confirmReqCancel: '负责人确认后,已批准的假才会被取消。',
  toastSubmitted: '申请已提交,等待审批。',
  toastFail: '操作失败,请重试。',
  toastMcAttached: 'MC 已上传。',
  loading: '加载中…',
  notFound: '找不到这条记录。',
  imported: '历史导入',
  yearRecords: '今年的记录',
}

// 假种名称(中/英)
const TYPE_NAMES: Record<string, { zh: string; en: string }> = {
  annual: { zh: '年假', en: 'Annual Leave' },
  medical: { zh: '病假 (MC)', en: 'Medical Leave (MC)' },
  unpaid: { zh: '无薪假', en: 'Unpaid Leave' },
  maternity: { zh: '产假', en: 'Maternity Leave' },
  paternity: { zh: '陪产假', en: 'Paternity Leave' },
}
export function leaveTypeName(type: string, lang: Lang) {
  return TYPE_NAMES[type]?.[lang] ?? type
}

const DICT: Record<Lang, Record<DictKey, string>> = { en, zh }

const KEY = 'eleave-lang'
const EVENT = 'eleave-lang-change'

function readStored(): Lang | null {
  try {
    const s = localStorage.getItem(KEY)
    return s === 'en' || s === 'zh' ? s : null
  } catch {
    return null
  }
}

export function useLang() {
  const [lang, setLangState] = useState<Lang>('zh')

  useEffect(() => {
    const apply = () => {
      const s = readStored()
      if (s) setLangState(s)
    }
    apply()
    // 同一页里有好几个地方用到语言(侧边栏、页面),切换时让它们一起更新
    window.addEventListener(EVENT, apply)
    return () => window.removeEventListener(EVENT, apply)
  }, [])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try { localStorage.setItem(KEY, l) } catch { /* 隐私模式可能不能存,忽略 */ }
    window.dispatchEvent(new Event(EVENT))
  }, [])

  const t = useCallback((key: DictKey) => DICT[lang][key], [lang])

  return { lang, setLang, t }
}
