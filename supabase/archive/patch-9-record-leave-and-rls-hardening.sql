-- Patch 9
--   1. 负责人可以替员工登记请假(新增 INSERT 权限)
--   2. 堵住漏洞:员工提交申请时,状态只能是 pending
--   3. 堵住漏洞:员工修改自己的申请时,只能改成 cancelled
-- 可以重复执行,不会删除任何资料。

-- 1. 负责人登记请假
drop policy if exists "managers can create leave applications" on leave_applications;
create policy "managers can create leave applications" on leave_applications
  for insert with check (is_manager());

-- 2. 员工提交申请:只能是自己的、只能是 pending
drop policy if exists "employees can create own leave applications" on leave_applications;
create policy "employees can create own leave applications" on leave_applications
  for insert with check (
    status = 'pending'
    and employee_id in (
      select id from employees where auth_user_id = auth.uid() and is_active
    )
  );

-- 3. 员工取消申请:只能把自己的 pending 申请改成 cancelled
drop policy if exists "employees can cancel own pending applications" on leave_applications;
create policy "employees can cancel own pending applications" on leave_applications
  for update
  using (
    status = 'pending'
    and employee_id in (select id from employees where auth_user_id = auth.uid())
  )
  with check (
    status = 'cancelled'
    and employee_id in (select id from employees where auth_user_id = auth.uid())
  );
