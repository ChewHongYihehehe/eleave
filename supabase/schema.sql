-- ============================================================================
-- E-LEAVE SYSTEM — 完整数据库结构(唯一需要跑的 SQL 文件)
--
-- ✅ 可重复执行(idempotent):
--    · 全新的 Supabase 项目:直接整份贴到 SQL Editor 执行
--    · 已经在用的项目:同样整份贴上执行,会补上缺的栏位/表/规则,不会删除或清空现有资料
--
-- 这份文件取代了以前的 schema.sql + fix-rls-recursion.sql + patch-2 ~ patch-8
-- (旧文件已移到 supabase/archive/,不需要再跑)。
--
-- 依据:Malaysia Employment Act 假期额度(额度本身写在 lib/leaveRules.ts)
-- ============================================================================


-- ============================================================================
-- 1. EMPLOYEES (员工主档)
-- ============================================================================
create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  -- 兼职员工没有登录账号,所以允许为空
  auth_user_id uuid references auth.users(id),
  employee_no int,
  full_name text not null,
  date_of_commencement date not null,
  employment_type text not null default 'full_time' check (employment_type in ('full_time', 'part_time')),
  role text not null default 'staff' check (role in ('staff', 'manager')),
  is_active boolean not null default true,
  annual_leave_carry_forward numeric not null default 0,  -- 从去年结转过来的年假(负责人手动填)
  annual_leave_entitlement_override numeric,              -- 若填写则覆盖系统按年资自动算的额度(用于 prorated 或特殊情况)
  last_notifications_seen_at timestamptz,                 -- 员工上次看过通知的时间
  created_at timestamptz default now()
);

-- 给"旧版本建的表"补上后来才加的栏位
alter table employees add column if not exists annual_leave_carry_forward numeric not null default 0;
alter table employees add column if not exists annual_leave_entitlement_override numeric;
alter table employees add column if not exists last_notifications_seen_at timestamptz;
update employees set is_active = true where is_active is null;
alter table employees alter column is_active set default true;
alter table employees alter column is_active set not null;
alter table employees alter column auth_user_id drop not null;

-- auth_user_id 唯一,但只在不为空时才要求唯一(多个兼职员工都是 NULL 没问题)
alter table employees drop constraint if exists employees_auth_user_id_key;
create unique index if not exists employees_auth_user_id_unique_notnull
  on employees (auth_user_id) where auth_user_id is not null;

-- employee_no 不能重复。如果现有资料里已经有重复的号码,不会中断整份脚本,
-- 只会给出警告 —— 先把重复的号码改掉,再重跑一次这份脚本即可。
do $$
begin
  if exists (
    select 1 from employees where employee_no is not null
    group by employee_no having count(*) > 1
  ) then
    raise warning 'employees.employee_no 有重复的号码,唯一索引没有建立。请先在 Table Editor 把重复的号码改掉,然后重新执行这份 schema.sql。';
  else
    create unique index if not exists employees_employee_no_unique
      on employees (employee_no) where employee_no is not null;
  end if;
end $$;


-- ============================================================================
-- 2. LEAVE APPLICATIONS (请假申请记录)
-- ============================================================================
create table if not exists leave_applications (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  leave_type text not null check (leave_type in ('annual', 'medical', 'unpaid', 'maternity', 'paternity')),
  start_date date not null,
  end_date date not null,
  is_half_day boolean default false,
  half_day_period text check (half_day_period in ('am', 'pm')),
  total_days numeric not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by uuid references employees(id),
  approved_at timestamptz,
  remarks text,
  cancellation_status text not null default 'none' check (cancellation_status in ('none', 'requested')),
  cancellation_requested_at timestamptz,
  cancellation_decision_reason text,
  mc_attachment_path text,
  last_decision_at timestamptz,   -- 经理最近一次对这笔申请做决定的时间(用于员工通知)
  created_at timestamptz default now()
);

alter table leave_applications
  add column if not exists half_day_period text check (half_day_period in ('am', 'pm'));
alter table leave_applications
  add column if not exists last_decision_at timestamptz;


-- ============================================================================
-- 3. PUBLIC HOLIDAYS (公假日历)
-- ============================================================================
create table if not exists public_holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null unique,
  name text not null,
  is_enabled boolean not null default true   -- 关闭后不再从年假天数里扣除这天
);

alter table public_holidays add column if not exists is_enabled boolean not null default true;

-- 预填 2026 年登嘉楼(Terengganu)官方公假。日期已存在就跳过,不会覆盖你手动加/改过的。
insert into public_holidays (holiday_date, name, is_enabled) values
  ('2026-01-17', 'Israk and Mikraj', true),
  ('2026-01-18', 'Israk and Mikraj Holiday', true),
  ('2026-02-17', 'Chinese New Year', true),
  ('2026-02-18', 'Chinese New Year Holiday', true),
  ('2026-03-04', 'Installation of Sultan of Terengganu', true),
  ('2026-03-07', 'Nuzul Al-Quran', true),
  ('2026-03-08', 'Nuzul Al-Quran Holiday', true),
  ('2026-03-20', 'Hari Raya Aidilfitri Holiday', true),
  ('2026-03-21', 'Hari Raya Aidilfitri', true),
  ('2026-03-22', 'Hari Raya Aidilfitri Holiday', true),
  ('2026-03-23', 'Hari Raya Aidilfitri Holiday', true),
  ('2026-04-26', 'Sultan of Terengganu''s Birthday', true),
  ('2026-05-01', 'Labour Day', true),
  ('2026-05-26', 'Arafat Day', true),
  ('2026-05-27', 'Hari Raya Haji', true),
  ('2026-05-28', 'Hari Raya Haji Holiday', true),
  ('2026-05-31', 'Wesak Day', true),
  ('2026-06-01', 'Agong''s Birthday', true),
  ('2026-06-17', 'Awal Muharram', true),
  ('2026-08-25', 'Prophet Muhammad''s Birthday', true),
  ('2026-08-31', 'Merdeka Day', true),
  ('2026-09-16', 'Malaysia Day', true),
  ('2026-11-08', 'Deepavali', true),
  ('2026-12-25', 'Christmas Day', true)
on conflict (holiday_date) do nothing;


-- ============================================================================
-- 4. MONTHLY WORK HOURS (兼职员工每月工时,由负责人在 Work Hours 页登记)
-- ============================================================================
create table if not exists monthly_work_hours (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references employees(id) on delete cascade,
  year          int  not null,
  month         int  not null check (month between 1 and 12),
  total_hours   numeric not null default 0 check (total_hours >= 0),
  notes         text,
  created_at    timestamptz default now(),
  unique (employee_id, year, month)
);

-- 旧的按天记录工时的表 work_hours 已被上面这张取代,程序里也没有再用。
-- 只有在它是空的时候才删除;里面如果有资料,不会动它,只给警告(请自己确认后再手动删)。
do $$
begin
  if to_regclass('public.work_hours') is not null then
    if (select count(*) from public.work_hours) = 0 then
      drop table public.work_hours;
    else
      raise warning '旧表 work_hours 里还有资料,没有删除。确认不需要后请手动执行: drop table work_hours;';
    end if;
  end if;
end $$;


-- ============================================================================
-- 5. APP SETTINGS (公司设定,目前只有"工作周":每个星期几算 全天/半天/休息)
-- ============================================================================
create table if not exists app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz default now()
);

-- key: 0=周日 … 6=周六;值 1=全天上班, 0.5=上半天班, 0=休息
insert into app_settings (key, value)
values ('work_week', '{"0":0,"1":1,"2":1,"3":1,"4":1,"5":1,"6":0}'::jsonb)
on conflict (key) do nothing;


-- ============================================================================
-- HELPER FUNCTION: 目前登录的人是不是(启用中的)负责人
-- security definer:内部查 employees 时绕过 RLS。没有它,employees 表上的规则
-- 再去查 employees 会造成无限递归(Postgres 错误 42P17,前端看到 500)。
-- ============================================================================
create or replace function public.is_manager()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from employees
    where auth_user_id = auth.uid()
      and role = 'manager'
      and coalesce(is_active, true)
  );
$$;


-- ============================================================================
-- ROW LEVEL SECURITY
-- 每张表都要 enable RLS 并且写好规则。"启用了 RLS 但没有任何规则"= 谁都读不到资料,
-- 而且不会报错(以前 public_holidays / work_hours 就踩过这个坑)。
-- ============================================================================
alter table employees          enable row level security;
alter table leave_applications enable row level security;
alter table public_holidays    enable row level security;
alter table monthly_work_hours enable row level security;
alter table app_settings       enable row level security;

-- ---- employees ----
drop policy if exists "employees can view own profile" on employees;
create policy "employees can view own profile" on employees
  for select using (auth_user_id = auth.uid());

drop policy if exists "managers can view all employees" on employees;
create policy "managers can view all employees" on employees
  for select using (is_manager());

drop policy if exists "managers can update employees" on employees;
create policy "managers can update employees" on employees
  for update using (is_manager());

drop policy if exists "managers can insert employees" on employees;
create policy "managers can insert employees" on employees
  for insert with check (is_manager());

-- ---- leave_applications ----
drop policy if exists "employees can view own leave applications" on leave_applications;
create policy "employees can view own leave applications" on leave_applications
  for select using (
    employee_id in (select id from employees where auth_user_id = auth.uid())
  );

-- 提交新申请(INSERT)不再对 anon/authenticated 开放任何权限:
-- 额度、重叠检查只有在服务器端(app/api/leave-applications,用 service role key)才能保证不被绕过,
-- 所以新增申请一律走那支 API,浏览器不能直接 insert。这里故意不建立任何 insert policy,
-- 等于默认拒绝(RLS 没有对应的 policy = 拒绝)。
drop policy if exists "employees can create own leave applications" on leave_applications;
drop policy if exists "managers can create leave applications" on leave_applications;

drop policy if exists "managers can view all leave applications" on leave_applications;
create policy "managers can view all leave applications" on leave_applications
  for select using (is_manager());

drop policy if exists "managers can update leave applications" on leave_applications;
create policy "managers can update leave applications" on leave_applications
  for update using (is_manager());

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

-- 员工:对已批准、还没开始的假,发起取消申请(要等经理确认)
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

-- 员工:撤回自己发起的取消申请
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

-- 员工:提交病假时没附 MC,之后自己回来补传
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

-- ---- public_holidays ----
drop policy if exists "everyone can view public holidays" on public_holidays;
create policy "everyone can view public holidays" on public_holidays
  for select using (auth.role() = 'authenticated');

drop policy if exists "managers can manage public holidays" on public_holidays;
create policy "managers can manage public holidays" on public_holidays
  for all using (is_manager());

-- ---- monthly_work_hours(只有负责人能读写;兼职员工没有登录账号) ----
drop policy if exists "managers can manage monthly work hours" on monthly_work_hours;
create policy "managers can manage monthly work hours" on monthly_work_hours
  for all using (is_manager());

-- ---- app_settings(所有登录的人能读,只有负责人能改) ----
drop policy if exists "everyone can view app settings" on app_settings;
create policy "everyone can view app settings" on app_settings
  for select using (auth.role() = 'authenticated');

drop policy if exists "managers can manage app settings" on app_settings;
create policy "managers can manage app settings" on app_settings
  for all using (is_manager()) with check (is_manager());

-- ---- MC 附件的 Storage bucket 和权限 ----
insert into storage.buckets (id, name, public)
values ('mc-attachments', 'mc-attachments', false)
on conflict (id) do nothing;

drop policy if exists "mc attachments: owner or manager can view" on storage.objects;
create policy "mc attachments: owner or manager can view" on storage.objects
  for select using (
    bucket_id = 'mc-attachments'
    and (
      is_manager()
      or (storage.foldername(name))[1] in (
        select id::text from employees where auth_user_id = auth.uid()
      )
    )
  );

drop policy if exists "mc attachments: owner or manager can upload" on storage.objects;
create policy "mc attachments: owner or manager can upload" on storage.objects
  for insert with check (
    bucket_id = 'mc-attachments'
    and (
      is_manager()
      or (storage.foldername(name))[1] in (
        select id::text from employees where auth_user_id = auth.uid()
      )
    )
  );

drop policy if exists "mc attachments: manager can delete" on storage.objects;
create policy "mc attachments: manager can delete" on storage.objects
  for delete using (
    bucket_id = 'mc-attachments' and is_manager()
  );

-- ============================================================================
-- AUDIT LOG(谁、什么时候、对系统做了什么敏感操作;只由服务器写入)
-- ============================================================================
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


-- ============================================================================
-- TELEGRAM 通知
--   · employees.telegram_chat_id:员工(含负责人)绑定的 Telegram 私聊 id,空 = 没绑定
--   · telegram_link_tokens:"绑定 Telegram"用的一次性短效 token,只由服务器读写
--   · leave_applications.cancellation_notified_at:避免同一次"申请取消"重复通知负责人
-- ============================================================================
alter table employees add column if not exists telegram_chat_id bigint;

-- 一个 Telegram 帐号只能绑定一位员工
create unique index if not exists employees_telegram_chat_id_unique
  on employees (telegram_chat_id) where telegram_chat_id is not null;

alter table leave_applications add column if not exists cancellation_notified_at timestamptz;

create table if not exists telegram_link_tokens (
  token text primary key,
  employee_id uuid not null references employees(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- 开启 RLS 但故意不建任何 policy = 浏览器(anon/authenticated)完全读不到,
-- 只有服务器端用 service role key 才能操作这张表。
alter table telegram_link_tokens enable row level security;


-- ============================================================================
-- TELEGRAM 按钮(在 Telegram 里直接批准 / 拒绝)
--   telegram_messages 记住"哪条 Telegram 消息对应哪笔申请":
--     · kind = 'notice'        发给负责人的申请通知(带按钮)。无论是在网页还是 Telegram 里
--                              做了决定,都靠它把所有负责人手上的按钮收掉、改成结果。
--     · kind = 'reason_prompt' 点了"拒绝"之后,bot 问"请回复理由"的那条消息。
--                              负责人回复它时,靠这一行知道这个理由是给哪一笔申请的。
--   同样开启 RLS 且不建 policy:只有服务器能读写。
-- ============================================================================
create table if not exists telegram_messages (
  id bigserial primary key,
  leave_application_id uuid not null references leave_applications(id) on delete cascade,
  chat_id bigint not null,
  message_id bigint not null,
  kind text not null check (kind in ('notice', 'reason_prompt')),
  action text,
  original_text text,
  created_at timestamptz not null default now()
);
create index if not exists telegram_messages_app_idx on telegram_messages (leave_application_id);
create index if not exists telegram_messages_chat_msg_idx on telegram_messages (chat_id, message_id);
alter table telegram_messages enable row level security;


-- ============================================================================
-- 员工只能"取消 / 申请取消 / 撤回取消 / 补传 MC",不能改别的栏位
--
-- 为什么需要这个触发器:
-- 上面几条 "employees can ..." 的 UPDATE policy,Postgres 会把它们的 USING 条件、
-- WITH CHECK 条件各自用"或"合并,而不是一条一条配对检查。结果是:旧资料符合
-- "取消自己待批的申请" 的 USING,新资料又符合 "撤回取消申请" 的 WITH CHECK,
-- 两条拼在一起,员工就能绕过网站,直接把自己待批的假改成"已批准",或改日期、天数。
-- RLS 本身没办法限制"哪些栏位可以改",所以用触发器把关:
--   · 负责人 / 服务器(没有登录用户时 auth.uid() 为空):不受限制
--   · 员工:只允许下面 4 种改动,其他一律拒绝
-- ============================================================================
create or replace function public.guard_employee_leave_updates()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  changed text[];
begin
  if auth.uid() is null or is_manager() then
    return new;
  end if;

  select coalesce(array_agg(n.key), '{}') into changed
  from jsonb_each(to_jsonb(new)) n
  where to_jsonb(old) -> n.key is distinct from n.value;

  if cardinality(changed) = 0 then
    return new;
  end if;

  -- 1) 取消自己"待批"的申请:只能改 status
  if old.status = 'pending' and new.status = 'cancelled'
     and changed <@ array['status'] then
    return new;
  end if;

  -- 2) 对已批准的假"申请取消"
  if old.status = 'approved' and new.status = 'approved'
     and old.cancellation_status = 'none' and new.cancellation_status = 'requested'
     and changed <@ array['cancellation_status', 'cancellation_requested_at', 'cancellation_decision_reason'] then
    return new;
  end if;

  -- 3) 撤回自己的取消申请
  if old.status = 'approved' and new.status = 'approved'
     and old.cancellation_status = 'requested' and new.cancellation_status = 'none'
     and changed <@ array['cancellation_status', 'cancellation_requested_at', 'cancellation_decision_reason'] then
    return new;
  end if;

  -- 4) 补传 MC:原本没有附件的病假,只能改 mc_attachment_path
  if old.leave_type = 'medical' and old.mc_attachment_path is null
     and changed = array['mc_attachment_path'] then
    return new;
  end if;

  raise exception 'Employees can only cancel, request cancellation of, or attach an MC to their own leave.'
    using errcode = '42501';
end;
$$;

drop trigger if exists guard_employee_leave_updates on leave_applications;
create trigger guard_employee_leave_updates
  before update on leave_applications
  for each row execute function public.guard_employee_leave_updates();


-- ============================================================================
-- 老板账号(is_owner)
--   · 登录后权限和 manager 一样(role 仍然是 'manager',所有现有的检查照常运作)
--   · 不会出现在"员工"页面和"补录请假"的员工名单里
--   · 其他负责人(包括她自己)都不能改她这一行、也不能重设她的密码、停用或降级她
--     —— 这些只能在 Supabase 后台由项目拥有者处理
--
-- 设定方法(在 Supabase 的 SQL Editor 执行,把 99 换成老板账号的 Staff ID):
--   update employees set is_owner = true where employee_no = 99;
-- 取消:同样的语句把 true 改成 false。
-- ============================================================================
alter table employees add column if not exists is_owner boolean not null default false;

create or replace function public.guard_owner_employee_row()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- 服务器(service role)和 SQL Editor 没有"登录用户",不受限制。
  -- 所有登录的人(包括负责人)都走不过这里。
  if auth.uid() is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'INSERT' then
    if new.is_owner then
      raise exception 'The owner flag can only be set in Supabase.' using errcode = '42501';
    end if;
    return new;
  end if;

  if old.is_owner then
    raise exception 'This account is protected and can only be changed in Supabase.' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and new.is_owner then
    raise exception 'The owner flag can only be set in Supabase.' using errcode = '42501';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists guard_owner_employee_row on employees;
create trigger guard_owner_employee_row
  before insert or update or delete on employees
  for each row execute function public.guard_owner_employee_row();
