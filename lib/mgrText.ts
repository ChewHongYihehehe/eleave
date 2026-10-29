'use client'

import { useCallback } from 'react'
import { useLang } from '@/lib/lang'

// 负责人手机版的文字(中 / 英 / 马来文)。单独放一个文件,不动 lib/lang.ts。
// 想改哪个词,直接改下面 zh / en / ms 里对应那一行。

const zh = {
  afterApprove: '批准后剩余', overdrawWarn: '额度不足,批准后将超出额度', retry: '重试', emptyTodoHint: '所有申请都已处理',
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
  flowTitle: '审批进度', tlSubmitted: '已提交', tlReviewing: '等待审批', tlApproved: '审批通过', tlRejected: '审批拒绝', tlCancelReq: '员工申请取消,等待确认',
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
  // ── 报表 / 兼职工时 / 公假(手机版)──
  tabMonth: '按月', tabYear: '年度余额', exportCsv: '导出', backThisMonth: '回到本月',
  unpaidLeave: '无薪假', medicalLeave: '病假', ptHours: '兼职工时', paidTag: '有薪', hoursUnit: '小时', peopleUnit: '人',
  noticePending: '本月有 {n} 笔申请还在待审批,未计入下方数字', noticeCancel: '有 {n} 笔已批准的假正在申请取消,处理前仍计入下方数字', noticeHours: '{n} 位兼职员工这个月还没录入工时',
  ftStaff: '全职员工', ptStaff: '兼职员工', filterAll: '全部', filterLeave: '有请假', noLeave: '无请假',
  filterUnpaid: '有无薪假', filterMc: '有病假', scopeAll: '全部', scopeFt: '全职', scopePt: '兼职', salaryDeduct: '涉及扣薪', workDays: '工作日', overdrawn: '已透支',
  matPat: '产/陪产假', total: '合计', notEntered: '未录入', noFullTime: '没有全职员工', noPartTime: '没有兼职员工', loadFail: '数据加载失败,请刷新后重试',
  monthNote: '只统计已批准的假。年假只算工作日(不含周末和公假);病假、无薪假、产假、陪产假按日历天算。跨月的假只计算落在当月的天数。',
  yearNote: '年假余额 = 额度 + 结转 − 已用,已用包含待审批的申请(和员工自己看到的一致)。结转只在当年有效。* 表示额度是手动设定的。',
  entitled: '额度', carriedFwd: '结转', taken: '已用', annualBalance: '年假余额', mcUsed: '病假已用', pendingIncluded: '天年假待审批(已含在已用里)',
  monthsEntered: '已录入月数', monthsUnit: '个月',
  enterHours: '录入工时', hoursHint: '留空并保存,表示清除这个月的记录。', monthTotal: '本月合计', yearTotal: '全年合计', enteredCount: '已录入',
  noPartActive: '没有在职的兼职员工', goAddPart: '去员工页新增', hoursSaved: '已保存', hoursInvalid: '请输入正确的小时数',
  workWeek: '工作周', workWeekHint: '年假只计算工作日。点一下星期几,在 全天 → 半天 → 休息 之间切换。',
  dayFull: '全', dayHalf: '半', dayOff: '休', saveWorkWeek: '保存工作周', weekPrefix: '周',
  addHoliday: '新增公假', holidayName: '名称', holidayDate: '日期', holidayNamePh: '例如:Hari Raya', delete: '删除', deleteHoliday: '删除这个公假',
  confirmDeleteHoliday: '相关的年假申请会自动重新计算天数。', noHolidays: '这一年还没有公假',
  holidayNote: '只有开启的公假,才会从年假天数里扣除。改动后,系统会自动重算相关的年假申请。',
  recalcDone: '{n} 笔年假申请已按最新的公假/工作周重算天数', weekSaved: '工作周已保存', dupDate: '这一天已经有公假了', failUpdate: '更新失败,请重试', failAdd: '新增失败,请重试', failRemove: '删除失败,请重试',
  recalcFailed: '已保存,但重算年假天数失败:', close: '关闭', yearSuffix: '年', holidayOn: '已开启', holidayOff: '已关闭',
}
const en: typeof zh = {
  afterApprove: 'Remaining after approval', overdrawWarn: 'Over quota: approving will exceed the entitlement', retry: 'Retry', emptyTodoHint: 'All caught up',
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
  flowTitle: 'Progress', tlSubmitted: 'Submitted', tlReviewing: 'Awaiting approval', tlApproved: 'Approved', tlRejected: 'Rejected', tlCancelReq: 'Employee requested cancellation',
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
  // ── Reports / Work hours / Holidays (mobile) ──
  tabMonth: 'Month', tabYear: 'Year balance', exportCsv: 'Export', backThisMonth: 'This month',
  unpaidLeave: 'Unpaid', medicalLeave: 'MC', ptHours: 'PT hours', paidTag: 'Paid', hoursUnit: 'hrs', peopleUnit: 'staff',
  noticePending: '{n} application(s) this month are still pending and not counted below', noticeCancel: '{n} approved leave(s) have a cancellation request. They are still counted below until decided', noticeHours: '{n} part-time staff have no hours entered this month',
  ftStaff: 'Full-time staff', ptStaff: 'Part-time staff', filterAll: 'All', filterLeave: 'With leave', noLeave: 'No leave',
  filterUnpaid: 'Unpaid only', filterMc: 'MC only', scopeAll: 'All', scopeFt: 'Full-time', scopePt: 'Part-time', salaryDeduct: 'Deduct pay', workDays: 'Working days', overdrawn: 'Overdrawn',
  matPat: 'Mat./Pat.', total: 'Total', notEntered: 'Not entered', noFullTime: 'No full-time staff', noPartTime: 'No part-time staff', loadFail: 'Could not load data. Please refresh and try again.',
  monthNote: 'Approved leave only. Annual leave counts working days (weekends and public holidays excluded); MC, unpaid, maternity and paternity count calendar days. A leave spanning two months only counts the days inside this month.',
  yearNote: 'Annual balance = Entitled + B/F − Taken. Taken includes pending applications (same as what staff see). B/F only applies to the current year. * = entitlement set manually.',
  entitled: 'Entitled', carriedFwd: 'B/F', taken: 'Taken', annualBalance: 'Annual balance', mcUsed: 'MC taken', pendingIncluded: 'day(s) of annual leave pending (included in Taken)',
  monthsEntered: 'Months entered', monthsUnit: 'months',
  enterHours: 'Enter hours', hoursHint: 'Leave blank and save to clear this month.', monthTotal: 'Month total', yearTotal: 'Year total', enteredCount: 'Entered',
  noPartActive: 'No active part-time staff', goAddPart: 'Add on Employees page', hoursSaved: 'Saved', hoursInvalid: 'Please enter a valid number of hours',
  workWeek: 'Work week', workWeekHint: 'Annual leave only counts working days. Tap a weekday to switch: Full → Half → Off.',
  dayFull: 'Full', dayHalf: 'Half', dayOff: 'Off', saveWorkWeek: 'Save work week', weekPrefix: '',
  addHoliday: 'Add holiday', holidayName: 'Name', holidayDate: 'Date', holidayNamePh: 'e.g. Hari Raya', delete: 'Delete', deleteHoliday: 'Delete this holiday',
  confirmDeleteHoliday: 'Related annual leave applications will be recalculated.', noHolidays: 'No holidays for this year yet',
  holidayNote: 'Only holidays that are switched on are excluded from annual leave days. Changes automatically recalculate related applications.',
  recalcDone: '{n} annual leave application(s) were recalculated', weekSaved: 'Work week saved', dupDate: 'A holiday already exists on this date', failUpdate: 'Update failed. Please try again.', failAdd: 'Could not add. Please try again.', failRemove: 'Could not delete. Please try again.',
  recalcFailed: 'Saved, but recalculating leave days failed: ', close: 'Close', yearSuffix: '', holidayOn: 'On', holidayOff: 'Off',
}

const ms: typeof zh = {
  afterApprove: 'Baki selepas kelulusan', overdrawWarn: 'Melebihi kuota: kelulusan akan melebihi kelayakan', retry: 'Cuba semula', emptyTodoHint: 'Semua telah diselesaikan',
  workspace: 'Ruang Kerja', approvals: 'Kelulusan', calendar: 'Kalendar', me: 'Saya', back: 'Kembali',
  toApprove: 'Untuk diluluskan', processed: 'Diproses', all: 'Semua', approved: 'Diluluskan', rejected: 'Ditolak', cancelled: 'Dibatalkan',
  allStaff: 'Semua pekerja', selectStaff: 'Pilih pekerja', batch: 'Pilih', done: 'Selesai', selected: 'Dipilih',
  approve: 'Lulus', reject: 'Tolak', recordLeave: 'Rekod cuti', cancelReq: 'Batal permohonan',
  emptyTodo: 'Tiada permohonan untuk diluluskan', noItems: 'Tiada rekod', loadMore: 'Muat lagi', loading: 'Memuatkan...',
  details: 'Butiran permohonan', applicant: 'Pekerja', leaveType: 'Jenis cuti', dates: 'Tarikh', duration: 'Tempoh', reason: 'Sebab',
  submittedAt: 'Dihantar', sameTime: 'Turut bercuti', noneSame: 'Tiada', balance: 'Baki cuti', quota: 'Kelayakan', usedDays: 'Digunakan',
  pendingDays: 'Menunggu (termasuk ini)', remainingDays: 'Baki', daysUnit: 'hari', halfAm: 'Pagi', halfPm: 'Petang',
  confirmApprove: 'Luluskan permohonan ini?', confirmApproveBatch: 'Luluskan permohonan yang dipilih?', confirm: 'Sahkan', cancel: 'Batal',
  rejectTitle: 'Tolak permohonan', rejectHint: 'Sila nyatakan sebab. Pekerja akan melihatnya.', reasonPh: 'Masukkan sebab', required: 'Wajib',
  q1: 'Terlalu ramai pekerja bercuti', q2: 'Baki tidak mencukupi', q3: 'Sila tukar tarikh dan mohon semula',
  confirmCancellation: 'Luluskan pembatalan', keepLeave: 'Kekalkan cuti', declineTitle: 'Kekalkan cuti ini', declineHint: 'Sila jelaskan mengapa pembatalan ditolak.',
  confirmCancelTitle: 'Luluskan pembatalan cuti ini?', managerCancel: 'Batalkan cuti ini', managerCancelTitle: 'Batalkan cuti ini', managerCancelHint: 'Pilihan: tulis sebab. Pekerja akan dimaklumkan.',
  sPending: 'Menunggu', sApproved: 'Diluluskan', sRejected: 'Ditolak', sCancelled: 'Dibatalkan', sCancelReq: 'Pembatalan dipohon',
  flowTitle: 'Kemajuan', tlSubmitted: 'Dihantar', tlReviewing: 'Menunggu kelulusan', tlApproved: 'Diluluskan', tlRejected: 'Ditolak', tlCancelReq: 'Pekerja memohon pembatalan',
  tlCancelled: 'Dibatalkan', cancelDeclined: 'Pembatalan ditolak', rejectReason: 'Sebab penolakan',
  viewMc: 'Lihat MC', mcMissing: 'Belum dimuat naik', toastOk: 'Berjaya', toastFail: 'Sesuatu tidak kena. Sila cuba lagi.', imported: 'Diimport', notFound: 'Rekod tidak dijumpai.',
  hello: 'Hai', todo: 'Perlu diurus', pendingCount: 'Menunggu', onLeaveToday: 'Bercuti hari ini', staffUnit: 'orang', viewAll: 'Lihat semua', allFeatures: 'Semua fungsi',
  employees: 'Pekerja', reports: 'Laporan', holidays: 'Cuti Umum', workHours: 'Jam Kerja', auditLog: 'Log Audit', today: 'Hari ini',
  nOnLeave: 'bercuti', nobodyOnLeave: 'Tiada yang bercuti', publicHoliday: 'Cuti umum', amOnly: 'Pagi sahaja', pmOnly: 'Petang sahaja',
  manager: 'Pengurus', language: 'Bahasa', changePassword: 'Tukar kata laluan', telegram: 'Notifikasi Telegram', logout: 'Log keluar',
  fullTime: 'Sepenuh masa', partTime: 'Sambilan', addEmployee: 'Tambah pekerja', active: 'Aktif', inactive: 'Tidak aktif',
  roleManager: 'Pengurus', roleStaff: 'Kakitangan', commencement: 'Tarikh mula kerja', override: 'Kelayakan tahunan (kosong = auto)', carryFwd: 'Dibawa ke hadapan',
  resetPassword: 'Tetap semula kata laluan', save: 'Simpan', saved: 'Disimpan', newPassword: 'Kata laluan baharu', min6: 'Kata laluan mesti sekurang-kurangnya 6 aksara', status: 'Status',
  deactivate: 'Nyahaktifkan akaun', activate: 'Aktifkan akaun', confirmDeactivate: 'Nyahaktifkan akaun ini? Mereka tidak boleh log masuk.', confirmActivate: 'Aktifkan semula akaun ini?',
  employmentType: 'Jenis pekerjaan', staffId: 'ID pekerja', initialPassword: 'Kata laluan awal', fullName: 'Nama penuh', roleLabel: 'Peranan',
  noLogin: 'Pekerja sambilan tiada akaun log masuk. Jam direkod di halaman Jam Kerja.', add: 'Tambah', adding: 'Menambah...', noEmployees: 'Tiada pekerja',
  pwdDone: 'Kata laluan telah ditetapkan semula. Maklumkan mereka secara berasingan.', addedOk: 'Ditambah', digitsOnly: 'Nombor sahaja', optional: 'Pilihan',
  legendAnnual: 'Tahunan', legendMedical: 'Sakit', legendMaternity: 'Bersalin', legendPaternity: 'Paterniti', legendUnpaid: 'Tanpa gaji',
  weekdays: 'Ahd,Isn,Sel,Rab,Kha,Jum,Sab',
  // ── Laporan / Jam kerja / Cuti umum (mudah alih) ──
  tabMonth: 'Bulan', tabYear: 'Baki tahunan', exportCsv: 'Eksport', backThisMonth: 'Bulan ini',
  unpaidLeave: 'Tanpa gaji', medicalLeave: 'MC', ptHours: 'Jam sambilan', paidTag: 'Bergaji', hoursUnit: 'jam', peopleUnit: 'orang',
  noticePending: '{n} permohonan bulan ini masih menunggu dan tidak dikira di bawah', noticeCancel: '{n} cuti diluluskan mempunyai permohonan pembatalan. Masih dikira di bawah sehingga diputuskan', noticeHours: '{n} pekerja sambilan belum memasukkan jam bulan ini',
  ftStaff: 'Pekerja sepenuh masa', ptStaff: 'Pekerja sambilan', filterAll: 'Semua', filterLeave: 'Ada cuti', noLeave: 'Tiada cuti',
  filterUnpaid: 'Tanpa gaji sahaja', filterMc: 'MC sahaja', scopeAll: 'Semua', scopeFt: 'Sepenuh masa', scopePt: 'Sambilan', salaryDeduct: 'Potong gaji', workDays: 'Hari bekerja', overdrawn: 'Terlebih had',
  matPat: 'Bersalin/Pat.', total: 'Jumlah', notEntered: 'Belum dimasukkan', noFullTime: 'Tiada pekerja sepenuh masa', noPartTime: 'Tiada pekerja sambilan', loadFail: 'Tidak dapat memuatkan data. Sila muat semula dan cuba lagi.',
  monthNote: 'Cuti diluluskan sahaja. Cuti tahunan dikira hari bekerja (tidak termasuk hujung minggu dan cuti umum); MC, tanpa gaji, bersalin dan paterniti dikira hari kalendar. Cuti merentas dua bulan hanya mengira hari dalam bulan ini.',
  yearNote: 'Baki tahunan = Kelayakan + Bawa hadapan − Digunakan. Digunakan termasuk permohonan menunggu (sama seperti yang dilihat pekerja). Bawa hadapan hanya sah untuk tahun semasa. * = kelayakan ditetapkan secara manual.',
  entitled: 'Kelayakan', carriedFwd: 'B/F', taken: 'Digunakan', annualBalance: 'Baki tahunan', mcUsed: 'MC digunakan', pendingIncluded: 'hari cuti tahunan menunggu (termasuk dalam Digunakan)',
  monthsEntered: 'Bulan dimasukkan', monthsUnit: 'bulan',
  enterHours: 'Masukkan jam', hoursHint: 'Biarkan kosong dan simpan untuk memadam rekod bulan ini.', monthTotal: 'Jumlah bulan', yearTotal: 'Jumlah tahun', enteredCount: 'Dimasukkan',
  noPartActive: 'Tiada pekerja sambilan aktif', goAddPart: 'Tambah di halaman Pekerja', hoursSaved: 'Disimpan', hoursInvalid: 'Sila masukkan bilangan jam yang sah',
  workWeek: 'Minggu bekerja', workWeekHint: 'Cuti tahunan hanya mengira hari bekerja. Ketik hari untuk menukar: Penuh → Separuh → Cuti.',
  dayFull: 'Penuh', dayHalf: 'Separuh', dayOff: 'Cuti', saveWorkWeek: 'Simpan minggu bekerja', weekPrefix: '',
  addHoliday: 'Tambah cuti umum', holidayName: 'Nama', holidayDate: 'Tarikh', holidayNamePh: 'cth: Hari Raya', delete: 'Padam', deleteHoliday: 'Padam cuti umum ini',
  confirmDeleteHoliday: 'Permohonan cuti tahunan berkaitan akan dikira semula.', noHolidays: 'Belum ada cuti umum untuk tahun ini',
  holidayNote: 'Hanya cuti umum yang diaktifkan akan dikecualikan daripada hari cuti tahunan. Perubahan akan mengira semula permohonan berkaitan secara automatik.',
  recalcDone: '{n} permohonan cuti tahunan telah dikira semula', weekSaved: 'Minggu bekerja disimpan', dupDate: 'Cuti umum sudah wujud pada tarikh ini', failUpdate: 'Kemas kini gagal. Sila cuba lagi.', failAdd: 'Tidak dapat menambah. Sila cuba lagi.', failRemove: 'Tidak dapat memadam. Sila cuba lagi.',
  recalcFailed: 'Disimpan, tetapi pengiraan semula hari cuti gagal: ', close: 'Tutup', yearSuffix: '', holidayOn: 'Aktif', holidayOff: 'Mati',
}

export type MgrKey = keyof typeof zh

export function useMgrT() {
  const { lang } = useLang()
  const t = useCallback((k: MgrKey) => (lang === 'zh' ? zh : lang === 'ms' ? ms : en)[k] ?? zh[k] ?? en[k] ?? '', [lang])
  return { t, lang }
}

import type { Lang } from '@/lib/lang'

export function leaveName(type: string, lang: Lang | 'zh' | 'en') {
  const m: Record<string, { ms: string; en: string; zh: string }> = {
    annual: { ms: 'Cuti Tahunan', en: 'Annual Leave', zh: '年假' },
    medical: { ms: 'Cuti Sakit (MC)', en: 'Medical Leave (MC)', zh: '病假 (MC)' },
    unpaid: { ms: 'Cuti Tanpa Gaji', en: 'Unpaid Leave', zh: '无薪假' },
    maternity: { ms: 'Cuti Bersalin', en: 'Maternity Leave', zh: '产假' },
    paternity: { ms: 'Cuti Paterniti', en: 'Paternity Leave', zh: '陪产假' },
  }
  return m[type]?.[lang as Lang] ?? m[type]?.['en'] ?? type
}

// ── 三语小工具(手机版共用)──
export const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const MONTH_MS = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis']

/** 按语言挑一句:pick(lang, '中文', 'English', 'Bahasa Melayu') */
export function pick(lang: Lang | 'zh' | 'en' | 'ms', zhText: string, enText: string, msText: string) {
  return lang === 'zh' ? zhText : lang === 'ms' ? msText : enText
}

/** 月份简称:中文 "3月",英文 "Mar",马来文 "Mac" */
export function monthShort(m: number, lang: Lang | 'zh' | 'en' | 'ms') {
  return lang === 'zh' ? `${m}月` : (lang === 'ms' ? MONTH_MS : MONTH_EN)[m - 1] || ''
}

/** "2026年3月" / "Mar 2026" / "Mac 2026" */
export function monthYear(y: number, m: number, lang: Lang | 'zh' | 'en' | 'ms') {
  return lang === 'zh' ? `${y}年${m}月` : `${monthShort(m, lang)} ${y}`
}

/** 给 toLocaleDateString / toLocaleTimeString 用 */
export function localeOf(lang: Lang | 'zh' | 'en' | 'ms') {
  return lang === 'zh' ? 'zh-CN' : lang === 'ms' ? 'ms-MY' : 'en-MY'
}
