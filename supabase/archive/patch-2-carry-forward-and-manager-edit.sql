-- ========================================
-- 补丁2:加入年假结转(B/F)欄位 + 让负责人能编辑员工资料
-- 可以安全贴到 SQL Editor 执行,不影响现有资料
-- ========================================

-- 1. 加一个欄位,存放"从去年带过来的年假余额"
--    负责人手动填入这个数字(比如去年剩3天没休完,就填3)
alter table employees
  add column if not exists annual_leave_carry_forward numeric not null default 0;

-- 2. 让负责人能新增/编辑员工资料(原本只能看,不能改)
drop policy if exists "managers can update employees" on employees;
create policy "managers can update employees" on employees
  for update using (is_manager());

drop policy if exists "managers can insert employees" on employees;
create policy "managers can insert employees" on employees
  for insert with check (is_manager());

-- 3. 之前建表时你选了 "Run and enable RLS",但 public_holidays 表
--    从来没有设过"谁能读"的规则,导致默认没有人能读到公假资料
--    (员工申请年假时,系统会读不到公假日期,无法正确排除公假)
alter table public_holidays enable row level security;
drop policy if exists "everyone can view public holidays" on public_holidays;
create policy "everyone can view public holidays" on public_holidays
  for select using (auth.role() = 'authenticated');

drop policy if exists "managers can manage public holidays" on public_holidays;
create policy "managers can manage public holidays" on public_holidays
  for all using (is_manager());
