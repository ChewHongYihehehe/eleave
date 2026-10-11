-- Patch 6: work_hours 表的读写权限规则
-- 建表的时候(schema.sql)选了 "启用 RLS",但从来没有补上对应的
-- read/write policy——跟你们之前 public_holidays 踩过的坑是同一种问题
-- (表格本身建好了,但因为没有规则,没有人能读到/写入任何资料,不会报错,
-- 就是安安静静地什么都拿不到)。
-- 在正式数据库上跑这个就好,不影响其他表。

drop policy if exists "employees can view own work hours" on work_hours;
create policy "employees can view own work hours" on work_hours
  for select using (
    employee_id in (select id from employees where auth_user_id = auth.uid())
  );

drop policy if exists "employees can insert own work hours" on work_hours;
create policy "employees can insert own work hours" on work_hours
  for insert with check (
    employee_id in (select id from employees where auth_user_id = auth.uid())
  );

drop policy if exists "employees can update own work hours" on work_hours;
create policy "employees can update own work hours" on work_hours
  for update using (
    employee_id in (select id from employees where auth_user_id = auth.uid())
  );

drop policy if exists "employees can delete own work hours" on work_hours;
create policy "employees can delete own work hours" on work_hours
  for delete using (
    employee_id in (select id from employees where auth_user_id = auth.uid())
  );

-- 负责人能看到、也能新增/修改/删除所有人的工时记录(方便帮忙补登或更正)
drop policy if exists "managers can manage all work hours" on work_hours;
create policy "managers can manage all work hours" on work_hours
  for all using (is_manager());
