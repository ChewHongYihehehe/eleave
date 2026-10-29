import { supabase } from './supabaseClient'
import type { Lang } from './lang'

// 按语言挑一句话;没传 lang 就是英文(电脑版 / 负责人端的调用方式不变)
export function pickLang(lang: Lang | undefined, zh: string, en: string, ms: string) {
  return lang === 'zh' ? zh : lang === 'ms' ? ms : en
}

// MC(病假证明)附件统一放在私有的 mc-attachments bucket 里,
// 路径规则是 `${employee_id}/${时间戳}_${文件名}` —— 这样 storage.objects 的
// RLS 规则才能用「路径开头的 employee_id 是不是自己」来判断谁能看、谁能传
// (细节见 supabase/patch-11-mc-attachments.sql)。
//
// bucket 是私有的,所以要看文件不能直接用网址,每次都要现生成一个短效的签名连结。

export const MC_MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
export const MC_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']

export function validateMcFile(file: File, lang?: Lang): string | null {
  if (file.size > MC_MAX_FILE_SIZE) return pickLang(lang, '文件太大(最大 5MB)。', 'File is too large (max 5MB).', 'Fail terlalu besar (maks 5MB).')
  if (MC_ALLOWED_TYPES.length > 0 && file.type && !MC_ALLOWED_TYPES.includes(file.type)) {
    return pickLang(lang, '请上传照片(JPG/PNG/HEIC)或 PDF。', 'Please upload a photo (JPG/PNG/HEIC) or a PDF.', 'Sila muat naik gambar (JPG/PNG/HEIC) atau PDF.')
  }
  return null
}

// 上传 MC 文件,回传存进数据库的 path。employeeId 是这张 MC 属于哪个员工
// (员工自己申请时就是自己的 id;经理代登记时是目标员工的 id)。
export async function uploadMcFile(employeeId: string, file: File, lang?: Lang): Promise<{ path: string | null; error: string | null }> {
  const validationError = validateMcFile(file, lang)
  if (validationError) return { path: null, error: validationError }

  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_').slice(-80)
  const path = `${employeeId}/${Date.now()}_${safeName}`

  const { error } = await supabase.storage.from('mc-attachments').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) return { path: null, error: `${pickLang(lang, '无法上传 MC 文件', 'Could not upload the MC file', 'Tidak dapat memuat naik fail MC')}: ${error.message}` }
  return { path, error: null }
}

// 生成一个短效(10 分钟)的签名连结,用来查看/下载某个 MC 附件。
// 权限由 storage.objects 的 RLS 决定:只有那位员工本人或经理能拿到。
export async function getMcSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('mc-attachments').createSignedUrl(path, 600)
  if (error || !data) return null
  return data.signedUrl
}
