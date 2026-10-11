-- Patch 13:审计日志 —— 谁、什么时候、对系统做了什么敏感操作。
-- 可以重复执行,不会删除任何资料。
--
-- 设计:这张表只由服务器(service role key,supabaseAdmin)写入,
-- 不开放任何人从浏览器直接新增/修改/删除 ——
-- 所以下面故意只给「经理可以读」一条权限,没有任何 insert/update/delete policy。
-- 这跟 leave_applications 现在的做法是同一个精神:
-- 凡是需要被信任的记录,一律走服务器端 API,不让浏览器自己说了算。
--
-- 为了做到这点,这个 patch 顺便把 /manage 页面「改员工资料」这个操作
-- 也从浏览器直接改数据库,挪进了 /api/employees 的 PATCH 里
-- (附带代码改动,不是这份 SQL 能做的,要跟着这次一起换的文件一起套用)。

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references employees(id),
  action text not null,
  target_employee_id uuid references employees(id),
  leave_application_id uuid references leave_applications(id),
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_at_idx on audit_log (created_at desc);

alter table audit_log enable row level security;

drop policy if exists "managers can view audit log" on audit_log;
create policy "managers can view audit log" on audit_log
  for select using (is_manager());
