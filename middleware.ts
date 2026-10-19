import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// 服务器端路由守卫:在页面渲染之前就检查
//   1. 有没有登录
//   2. 员工资料是否存在、是否启用、是否全职
//   3. 负责人专属页面是否由负责人访问
//   4. 还没设定自己密码的人(must_change_password),只能去 /change-password
// 不通过就直接 redirect,不会先闪出页面再跳走。
// API 路由(/api/**)不经过这里,它们自己验证 Bearer token。

const MANAGER_PATHS = ['/approve', '/calendar', '/manage', '/reports', '/holidays', '/work-hours', '/audit-log']
const STAFF_PATHS = ['/dashboard']
const LOGIN_ONLY_PATHS = ['/change-password', '/notifications']

const startsWithAny = (path: string, list: string[]) =>
  list.some((p) => path === p || path.startsWith(p + '/'))

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const needsManager = startsWithAny(path, MANAGER_PATHS)
  const needsProfile = needsManager || startsWithAny(path, STAFF_PATHS) || startsWithAny(path, ['/notifications'])
  const needsLogin = needsProfile || startsWithAny(path, LOGIN_ONLY_PATHS)

  if (!needsLogin) return NextResponse.next()

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  // 重定向时要把(可能刚刷新/清除的)登录 cookie 一起带过去
  function redirect(to: string, notice?: string) {
    const url = request.nextUrl.clone()
    url.pathname = to
    url.search = notice ? `?notice=${notice}` : ''
    const res = NextResponse.redirect(url)
    response.cookies.getAll().forEach((c) => res.cookies.set(c))
    return res
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect('/')

  if (!needsProfile) return response

  const { data: emp } = await supabase
    .from('employees')
    .select('role, is_active, employment_type, must_change_password')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  // 查不到资料时不在这里判死刑(可能只是暂时的网络/RLS 问题),
  // 交给页面里的 useEmployee() 显示明确的错误画面。
  if (!emp) return response

  if (emp.is_active === false) {
    await supabase.auth.signOut()
    return redirect('/', 'inactive')
  }
  if (emp.employment_type === 'part_time') {
    await supabase.auth.signOut()
    return redirect('/', 'part-time')
  }
  // 初始密码是负责人设的 → 第一次登录必须先换成自己的(设好之后服务器会把这个标记关掉)
  if (emp.must_change_password) return redirect('/change-password')
  if (needsManager && emp.role !== 'manager') return redirect('/dashboard')

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
