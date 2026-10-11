-- Patch 12:病假申请提交时没附 MC,之后员工自己回来补传
-- (不用整笔作废重新登记)。可以重复执行,不会删除任何资料。

drop policy if exists "employees can attach mc to own medical leave without one" on leave_applications;
create policy "employees can attach mc to own medical leave without one" on leave_applications
  for update
  using (
    leave_type = 'medical'
    and mc_attachment_path is null
    and status in ('pending', 'approved')
    and employee_id in (select id from employees where auth_user_id = auth.uid())
  )
  with check (
    leave_type = 'medical'
    and employee_id in (select id from employees where auth_user_id = auth.uid())
  );
