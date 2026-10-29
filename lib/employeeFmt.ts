import type { Lang } from '@/lib/lang'
import type { LeaveApp } from '@/lib/useLeaveData'

const d = (s: string) => new Date(s + 'T00:00:00')
// 日期格式用的地区:中文 zh-CN、马来文 ms-MY、英文 en-MY
const localeOf = (lang: Lang) => (lang === 'zh' ? 'zh-CN' : lang === 'ms' ? 'ms-MY' : 'en-MY')

export function fmtDate(s: string, lang: Lang, withYear = false) {
  const dt = d(s)
  if (lang === 'zh') return `${withYear ? dt.getFullYear() + '年' : ''}${dt.getMonth() + 1}月${dt.getDate()}日`
  return dt.toLocaleDateString(localeOf(lang), { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) })
}

export function fmtRange(app: Pick<LeaveApp, 'start_date' | 'end_date' | 'remarks'>, lang: Lang, importedLabel: string) {
  if (app.remarks && app.remarks.includes('Historical import')) {
    const dt = d(app.start_date)
    const m = lang === 'zh' ? `${dt.getFullYear()}年${dt.getMonth() + 1}月` : dt.toLocaleDateString(localeOf(lang), { month: 'short', year: 'numeric' })
    return `${m} (${importedLabel})`
  }
  if (app.start_date === app.end_date) return fmtDate(app.start_date, lang, true)
  return `${fmtDate(app.start_date, lang)} – ${fmtDate(app.end_date, lang, true)}`
}

export function fmtDateTime(iso: string, lang: Lang) {
  return new Date(iso).toLocaleString(localeOf(lang), {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

export function monthLabel(ym: string, lang: Lang) {
  const [y, m] = ym.split('-').map(Number)
  return lang === 'zh' ? `${y}年${m}月` : new Date(y, m - 1, 1).toLocaleDateString(localeOf(lang), { month: 'long', year: 'numeric' })
}

// 状态 → 文字 + 颜色(钉钉:状态是右侧一个彩色字,不是胶囊)
export function statusInfo(app: Pick<LeaveApp, 'status' | 'cancellation_status'>, t: (k: any) => string) {
  if (app.status === 'approved' && app.cancellation_status === 'requested') return { label: t('sCancelReq'), color: '#AD4E00' }
  switch (app.status) {
    case 'approved': return { label: t('sApproved'), color: '#237804' }
    case 'pending': return { label: t('sPending'), color: '#AD4E00' }
    case 'rejected': return { label: t('sRejected'), color: '#CF1322' }
    case 'cancelled': return { label: t('sCancelled'), color: '#595959' }
    default: return { label: app.status, color: '#595959' }
  }
}
