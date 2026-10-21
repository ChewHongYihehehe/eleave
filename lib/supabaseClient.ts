import { createBrowserClient } from '@supabase/ssr'

// 用 @supabase/ssr 的浏览器 client:登录状态存在 cookie 里(而不是 localStorage),
// 这样 middleware.ts 在服务器端才看得到登录状态,可以在页面渲染前就拦截未登录/无权限的访问。
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
