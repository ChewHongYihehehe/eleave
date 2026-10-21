'use client'

import { useCallback } from 'react'
import { useLang } from '@/lib/lang'

// 负责人手机版的文字(中 / 英)。单独放一个文件,不动 lib/lang.ts。
// 想改哪个词,直接改下面 zh / en 里对应那一行。

const zh = {
  workspace: '工作台', approvals: '审批', calendar: '日历', me: '我的', back: '返回',
  toApprove: '待我审批', processed: '已处理', all: '全部', approved: '已通过', rejected: '已拒绝', cancelled: '已取消',
  allStaff: '全部员工', selectStaff: '选择员工', batch: '批量', done: '完成', selected: '已选',
  approve: '同意', reject: '拒绝', recordLeave: '代录入', cancelReq: '取消申请',
  emptyTodo: '没有待审批的申请', noItems: '暂无记录', loadMore: '加载更多', loading: '加载中…',
  details: '申请详情', applicant: '申请人', leaveType: '假期类型', dates: '日期', duration: '时长', reason: '事由',
  submittedAt: '提交时间', sameTime: '同期休假', noneSame: '无', balance: '假期余额', quota: '额度', usedDays: '已用',
  pendingDays: '待审批(含本次)', remainingDays: '剩余', daysUnit: '天', halfAm: '上午', halfPm: '下午',
  confirmApprove: '确认同意这笔申请?', confirmApproveBatch: '确认同意选中的申请?', confirm: '确认', cancel: '取消',
  rejectTitle: '拒绝申请', rejectHint: '请填写原因,员工会看到。', reasonPh: '请输入原因', required: '必填',
  q1: '该时段人手不足', q2: '额度不足', q3: '请调整日期后重新申请',
  confirmCancellation: '同意取消', keepLeave: '保留假期', declineTitle: '保留这笔假', declineHint: '请说明为什么不同意取消。',
  confirmCancelTitle: '同意员工取消这笔假?', managerCancel: '取消这笔假', managerCancelTitle: '取消这笔假', managerCancelHint: '选填:写下取消原因,员工会收到通知。',
  sPending: '待审批', sApproved: '已通过', sRejected: '已拒绝', sCancelled: '已取消', sCancelReq: '申请取消中',
  tlSubmitted: '已提交', tlReviewing: '等待审批', tlApproved: '审批通过', tlRejected: '审批拒绝', tlCancelReq: '员工申请取消,等待确认',
  tlCancelled: '已取消', cancelDeclined: '取消申请被拒绝', rejectReason: '拒绝原因',
  viewMc: '查看 MC', mcMissing: '未上传', toastOk: '操作成功', toastFail: '操作失败,请重试', imported: '历史导入', notFound: '找不到这条记录。',
  hello: '你好', todo: '待办', pendingCount: '待审批', onLeaveToday: '今天休假', staffUnit: '人', viewAll: '查看全部', allFeatures: '全部功能',
  employees: '员工', reports: '报表', holidays: '公假', workHours: '兼职工时', auditLog: '审计日志', today: '今天',
  nOnLeave: '人休假', nobodyOnLeave: '当天无人休假', publicHoliday: '公假', amOnly: '仅上午', pmOnly: '仅下午',
  manager: '负责人', language: '语言', changePassword: '更改密码', telegram: 'Telegram 通知', logout: '退出登录',
  fullTime: '全职', partTime: '兼职', addEmployee: '新增员工', active: '在职', inactive: '已停用',
  roleManager: '负责人', roleStaff: '员工', commencement: '入职日期', override: '年假额度(留空为自动)', carryFwd: '去年结转',
  resetPassword: '重置密码', save: '保存', saved: '已保存', newPassword: '新密码', min6: '密码至少 6 位', status: '状态',
  deactivate: '停用账号', activate: '启用账号', confirmDeactivate: '确认停用这个账号?对方将无法登录。', confirmActivate: '确认重新启用这个账号?',
  employmentType: '雇佣类型', staffId: '员工编号', initialPassword: '初始密码', fullName: '姓名', roleLabel: '角色',
  noLogin: '兼职员工没有登录账号,工时在「兼职工时」页面记录。', add: '添加', adding: '添加中…', noEmployees: '暂无员工',
  pwdDone: '密码已重置,请另外告诉对方。', addedOk: '已添加', digitsOnly: '只能填数字', optional: '选填',
  legendAnnual: '年假', legendMedical: '病假', legendMaternity: '产假', legendPaternity: '陪产假', legendUnpaid: '无薪假',
  weekdays: '日,一,二,三,四,五,六',
}
const en: typeof zh = {
  workspace: 'Workspace', approvals: 'Approvals', calendar: 'Calendar', me: 'Me', back: 'Back',
  toApprove: 'To approve', processed: 'Processed', all: 'All', approved: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled',
  allStaff: 'All staff', selectStaff: 'Select employee', batch: 'Select', done: 'Done', selected: 'Selected',
  approve: 'Approve', reject: 'Reject', recordLeave: 'Record leave', cancelReq: 'Cancel request',
  emptyTodo: 'Nothing to approve', noItems: 'No records', loadMore: 'Load more', loading: 'Loading...',
  details: 'Request details', applicant: 'Employee', leaveType: 'Leave type', dates: 'Dates', duration: 'Duration', reason: 'Reason',
  submittedAt: 'Submitted', sameTime: 'Also on leave', noneSame: 'None', balance: 'Leave balance', quota: 'Entitled', usedDays: 'Used',
  pendingDays: 'Pending (incl. this)', remainingDays: 'Remaining', daysUnit: 'days', halfAm: 'Morning', halfPm: 'Afternoon',
  confirmApprove: 'Approve this request?', confirmApproveBatch: 'Approve the selected requests?', confirm: 'Confirm', cancel: 'Cancel',
  rejectTitle: 'Reject request', rejectHint: 'Please give a reason. The employee will see it.', reasonPh: 'Enter a reason', required: 'Required',
  q1: 'Too many staff on leave', q2: 'Insufficient balance', q3: 'Please change dates and re-apply',
  confirmCancellation: 'Approve cancellation', keepLeave: 'Keep leave', declineTitle: 'Keep this leave', declineHint: 'Please explain why the cancellation is declined.',
  confirmCancelTitle: 'Approve the cancellation of this leave?', managerCancel: 'Cancel this leave', managerCancelTitle: 'Cancel this leave', managerCancelHint: 'Optional: add a reason. The employee will be notified.',
  sPending: 'Pending', sApproved: 'Approved', sRejected: 'Rejected', sCancelled: 'Cancelled', sCancelReq: 'Cancel requested',
  tlSubmitted: 'Submitted', tlReviewing: 'Awaiting approval', tlApproved: 'Approved', tlRejected: 'Rejected', tlCancelReq: 'Employee requested cancellation',
  tlCancelled: 'Cancelled', cancelDeclined: 'Cancellation declined', rejectReason: 'Rejection reason',
  viewMc: 'View MC', mcMissing: 'Not uploaded', toastOk: 'Done', toastFail: 'Something went wrong. Please try again.', imported: 'Imported', notFound: 'Record not found.',
  hello: 'Hi', todo: 'To do', pendingCount: 'Pending', onLeaveToday: 'On leave today', staffUnit: 'staff', viewAll: 'View all', allFeatures: 'All features',
  employees: 'Employees', reports: 'Reports', holidays: 'Holidays', workHours: 'Work hours', auditLog: 'Audit log', today: 'Today',
  nOnLeave: 'on leave', nobodyOnLeave: 'No one on leave', publicHoliday: 'Public holiday', amOnly: 'AM only', pmOnly: 'PM only',
  manager: 'Manager', language: 'Language', changePassword: 'Change password', telegram: 'Telegram notifications', logout: 'Log out',
  fullTime: 'Full-time', partTime: 'Part-time', addEmployee: 'Add employee', active: 'Active', inactive: 'Inactive',
  roleManager: 'Manager', roleStaff: 'Staff', commencement: 'Date of commencement', override: 'Annual entitlement (blank = auto)', carryFwd: 'Carried forward',
  resetPassword: 'Reset password', save: 'Save', saved: 'Saved', newPassword: 'New password', min6: 'Password must be at least 6 characters', status: 'Status',
  deactivate: 'Deactivate account', activate: 'Activate account', confirmDeactivate: 'Deactivate this account? They will not be able to log in.', confirmActivate: 'Re-activate this account?',
  employmentType: 'Employment type', staffId: 'Staff ID', initialPassword: 'Initial password', fullName: 'Full name', roleLabel: 'Role',
  noLogin: 'Part-time employees have no login. Hours are recorded on the Work Hours page.', add: 'Add', adding: 'Adding...', noEmployees: 'No employees',
  pwdDone: 'Password reset. Share it with them separately.', addedOk: 'Added', digitsOnly: 'Digits only', optional: 'Optional',
  legendAnnual: 'Annual', legendMedical: 'Medical', legendMaternity: 'Maternity', legendPaternity: 'Paternity', legendUnpaid: 'Unpaid',
  weekdays: 'Sun,Mon,Tue,Wed,Thu,Fri,Sat',
}

export type MgrKey = keyof typeof zh

export function useMgrT() {
  const { lang } = useLang()
  const t = useCallback((k: MgrKey) => (lang === 'zh' ? zh : en)[k], [lang])
  return { t, lang }
}

export function leaveName(type: string, lang: 'zh' | 'en') {
  const m: Record<string, [string, string]> = {
    annual: ['年假', 'Annual Leave'], medical: ['病假 (MC)', 'Medical Leave (MC)'], unpaid: ['无薪假', 'Unpaid Leave'],
    maternity: ['产假', 'Maternity Leave'], paternity: ['陪产假', 'Paternity Leave'],
  }
  return m[type] ? m[type][lang === 'zh' ? 0 : 1] : type
}
