-- ========================================
-- 补丁5:让员工能取消自己"待批"的申请
-- 之前员工只能新增/查看自己的申请,没有权限修改
-- 这条规则只允许员工改自己的申请、而且只能在还是 pending 状态时
-- ========================================
drop policy if exists "employees can cancel own pending applications" on leave_applications;
create policy "employees can cancel own pending applications" on leave_applications
  for update
  using (
    status = 'pending'
    and employee_id in (select id from employees where auth_user_id = auth.uid())
  )
  with check (
    employee_id in (select id from employees where auth_user_id = auth.uid())
  );
