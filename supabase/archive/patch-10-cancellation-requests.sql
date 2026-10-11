-- Patch 10:已批准的假,员工可以发起取消,经理确认或拒绝
-- 可以重复执行,不会删除任何资料。

-- 新增栏位:请假记录本身的 status 不动(还是 approved),
-- 用另一个栏位记录"取消申请"走到哪一步了。
alter table leave_applications
  add column if not exists cancellation_status text not null default 'none'
    check (cancellation_status in ('none', 'requested'));

alter table leave_applications
  add column if not exists cancellation_requested_at timestamptz;

alter table leave_applications
  add column if not exists cancellation_decision_reason text;

-- 员工:对自己"已批准、还没开始"的假,发起取消申请
drop policy if exists "employees can request cancellation of own approved leave" on leave_applications;
create policy "employees can request cancellation of own approved leave" on leave_applications
  for update
  using (
    status = 'approved'
    and cancellation_status = 'none'
    and start_date > current_date
    and employee_id in (select id from employees where auth_user_id = auth.uid())
  )
  with check (
    status = 'approved'
    and cancellation_status = 'requested'
    and employee_id in (select id from employees where auth_user_id = auth.uid())
  );

-- 员工:自己反悔,把取消申请撤回
drop policy if exists "employees can withdraw own cancellation request" on leave_applications;
create policy "employees can withdraw own cancellation request" on leave_applications
  for update
  using (
    cancellation_status = 'requested'
    and employee_id in (select id from employees where auth_user_id = auth.uid())
  )
  with check (
    status = 'approved'
    and cancellation_status = 'none'
    and employee_id in (select id from employees where auth_user_id = auth.uid())
  );

-- 经理确认/拒绝取消,用的是原本已经有的
-- "managers can update leave applications" 权限(is_manager() 可以改任何申请),不用新增规则。
