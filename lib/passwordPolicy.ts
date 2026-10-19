// 密码规则:服务器(新增员工、重设密码、自己改密码)和浏览器(即时提示)共用同一份。
// 纯函数、不依赖任何东西,所以两边都能 import。
//
// 规则故意保持简单、员工看得懂:至少 8 个字符;不能是明显容易猜的(全同一个字、连号、
// 常见密码、和工号一样)。不强制"大小写加符号",那种规则只会让人写在便条纸上。

export const MIN_PASSWORD_LENGTH = 8
export const MAX_PASSWORD_LENGTH = 72 // Supabase 用 bcrypt,超过 72 字节的部分不会被计算

const COMMON = new Set([
  '12345678', '123456789', '1234567890', '987654321', '11111111', '00000000', '88888888', '66666666',
  'password', 'password1', 'password123', 'passw0rd', 'qwertyui', 'qwerty123', 'abc12345', 'abcd1234',
  'iloveyou', 'admin123', 'welcome1', 'eleave123', 'eleave1234',
])

// 12345678 / 87654321 / abcdefgh 这种每个字符都比前一个 +1 或 -1 的连号
function isSequence(s: string): boolean {
  if (s.length < 2) return false
  const step = s.charCodeAt(1) - s.charCodeAt(0)
  if (step !== 1 && step !== -1) return false
  for (let i = 1; i < s.length; i++) {
    if (s.charCodeAt(i) - s.charCodeAt(i - 1) !== step) return false
  }
  return true
}

/** 合格回 null,不合格回要显示给使用者的错误文字。staffId:工号(用来挡"密码 = 工号") */
export function checkPassword(password: string, ctx: { staffId?: string | number | null } = {}): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
  if (password.length > MAX_PASSWORD_LENGTH) return `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`
  const lower = password.toLowerCase()
  if (/^(.)\1+$/.test(password) || isSequence(lower) || COMMON.has(lower)) {
    return 'That password is too easy to guess. Please choose a different one.'
  }
  if (ctx.staffId != null && ctx.staffId !== '' && /^\d+$/.test(password) && Number(password) === Number(ctx.staffId)) {
    return 'Your password cannot be the same as your Staff ID.'
  }
  return null
}
