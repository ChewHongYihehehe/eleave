import { supabase } from '@/lib/supabaseClient'
import { uploadMcFile, getMcSignedUrl, validateMcFile, pickLang } from '@/lib/mcAttachments'
import type { Lang } from '@/lib/lang'

// 员工端的写操作。成功回传 null,失败回传错误文字。
// 真正的额度 / 重叠检查都在服务器 /api/leave-applications 里,这里不重复。

export async function cancelPending(id: string): Promise<string | null> {
  const { error } = await supabase.from('leave_applications').update({ status: 'cancelled' }).eq('id', id)
  return error ? error.message : null
}

export async function requestCancellation(id: string): Promise<string | null> {
  const { error } = await supabase
    .from('leave_applications')
    .update({ cancellation_status: 'requested', cancellation_requested_at: new Date().toISOString(), cancellation_decision_reason: null })
    .eq('id', id)
  if (error) return error.message
  const { data: { session } } = await supabase.auth.getSession()
  fetch('/api/notifications/cancellation-requested', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify({ id }),
  }).catch(() => {}) // 通知失败不影响申请本身
  return null
}

export async function withdrawCancellation(id: string): Promise<string | null> {
  const { error } = await supabase.from('leave_applications').update({ cancellation_status: 'none' }).eq('id', id)
  return error ? error.message : null
}

export async function attachMc(employeeId: string, appId: string, file: File, lang?: Lang): Promise<string | null> {
  const bad = validateMcFile(file, lang)
  if (bad) return bad
  const { path, error } = await uploadMcFile(employeeId, file, lang)
  if (error) return error
  const { error: dbErr } = await supabase.from('leave_applications').update({ mc_attachment_path: path }).eq('id', appId)
  return dbErr ? dbErr.message : null
}

export async function openMc(path: string): Promise<boolean> {
  const url = await getMcSignedUrl(path)
  if (!url) return false
  window.open(url, '_blank', 'noopener,noreferrer')
  return true
}

export async function markNoticesSeen() {
  const { data: { session } } = await supabase.auth.getSession()
  await fetch('/api/notifications/seen', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session?.access_token}` },
  }).catch(() => {})
}

export async function submitApplication(p: {
  employeeId: string
  leaveType: string
  startDate: string
  endDate: string
  isHalfDay: boolean
  halfDayPeriod: 'am' | 'pm'
  reason: string
  mcFile: File | null
  lang?: Lang
}): Promise<string | null> {
  let mcAttachmentPath: string | undefined
  if (p.leaveType === 'medical' && p.mcFile) {
    const { path, error } = await uploadMcFile(p.employeeId, p.mcFile, p.lang)
    if (error) return error
    mcAttachmentPath = path || undefined
  }
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/leave-applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify({
      leave_type: p.leaveType,
      start_date: p.startDate,
      end_date: p.isHalfDay ? p.startDate : p.endDate,
      is_half_day: p.isHalfDay,
      half_day_period: p.isHalfDay ? p.halfDayPeriod : null,
      reason: p.reason,
      mcAttachmentPath,
    }),
  })
  const result = await res.json().catch(() => ({}))
  return res.ok ? null : result.error || pickLang(p.lang, '提交失败,请重试。', 'Failed to submit. Please try again.', 'Gagal menghantar. Sila cuba lagi.')
}
