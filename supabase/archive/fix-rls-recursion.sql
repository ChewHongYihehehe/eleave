-- ========================================
-- 修复补丁:解决 employees 表查询时的 500 报错
-- 原因:manager 权限规则里查询 employees 表本身,造成无限循环
-- 这段可以安全地贴到 SQL Editor 执行,不会影响你现有的员工资料
-- ========================================

-- 1. 建一个安全查询角色的函数(用 security definer 绕过循环检查)
create or replace function public.is_manager()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from employees
    where auth_user_id = auth.uid() and role = 'manager'
  );
$$;

-- 2. 把原本会循环的权限规则,换成用这个函数检查
drop policy if exists "managers can view all employees" on employees;
create policy "managers can view all employees" on employees
  for select using (is_manager());

drop policy if exists "managers can view all leave applications" on leave_applications;
create policy "managers can view all leave applications" on leave_applications
  for select using (is_manager());

drop policy if exists "managers can update leave applications" on leave_applications;
create policy "managers can update leave applications" on leave_applications
  for update using (is_manager());
