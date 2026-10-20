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
