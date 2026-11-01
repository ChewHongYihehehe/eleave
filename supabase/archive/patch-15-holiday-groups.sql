-- ============================================================================
-- PATCH 15:公假分组(华人 / 马来)+ 换成公司自己的 11 天公假
-- 在 Supabase → SQL Editor 整份贴上去执行一次。可以重复执行,不会出错。
-- ⚠️ 必须先执行这份,再部署新版代码(新版代码会读 holiday_group 栏位)。
-- ============================================================================

-- 1. 每个公假标记「适用对象」:all = 全公司,chinese = 只有华人组,malay = 只有马来组
alter table public_holidays
  add column if not exists applies_to text not null default 'all';
alter table public_holidays drop constraint if exists public_holidays_applies_to_check;
alter table public_holidays
  add constraint public_holidays_applies_to_check check (applies_to in ('all', 'chinese', 'malay'));

-- 2. 每位员工属于哪一组(预设华人;马来员工请到「员工 → 点进去 → 公假组别」改成马来)
alter table employees
  add column if not exists holiday_group text not null default 'chinese';
alter table employees drop constraint if exists employees_holiday_group_check;
alter table employees
  add constraint employees_holiday_group_check check (holiday_group in ('chinese', 'malay'));

-- 3. 删掉原来的官方公假清单,换成公司的版本(每人每年 11 天)
--    华人:春节 3 + 开斋节 1 + 哈芝节 2 + 劳动节 + 元首诞辰+ 国庆日 + 马来西亚日 + 登嘉楼苏丹诞辰
--    马来:春节 1 + 开斋节 3 + 哈芝节 2 + 同上 5 天
--    ⚠️ 这里是直接改数据库,已经批准/已休的年假天数不会被重算(保持当时的数字)。
begin;
delete from public_holidays;
insert into public_holidays (holiday_date, name, is_enabled, applies_to) values
  -- ── 2026 ──
  ('2026-02-17', 'Chinese New Year', true, 'all'),
  ('2026-02-18', 'Chinese New Year (Day 2)', true, 'chinese'),
  ('2026-02-19', 'Chinese New Year (Day 3)', true, 'chinese'),
  ('2026-03-21', 'Hari Raya Aidilfitri', true, 'all'),
  ('2026-03-22', 'Hari Raya Aidilfitri (Day 2)', true, 'malay'),
  ('2026-03-23', 'Hari Raya Aidilfitri (Day 3)', true, 'malay'),
  ('2026-04-26', 'Sultan of Terengganu''s Birthday', true, 'all'),
  ('2026-05-01', 'Labour Day', true, 'all'),
  ('2026-05-27', 'Hari Raya Haji', true, 'all'),
  ('2026-05-28', 'Hari Raya Haji (Day 2)', true, 'all'),
  ('2026-06-01', 'Agong''s Birthday', true, 'all'),
  ('2026-08-31', 'National Day', true, 'all'),
  ('2026-09-16', 'Malaysia Day', true, 'all'),
  -- ── 2027(日期来自官方 2027 公假公告;回历节日以官方最后公布为准)──
  ('2027-02-06', 'Chinese New Year', true, 'all'),
  ('2027-02-07', 'Chinese New Year (Day 2)', true, 'chinese'),
  ('2027-02-08', 'Chinese New Year (Day 3)', true, 'chinese'),
  ('2027-03-10', 'Hari Raya Aidilfitri', true, 'all'),
  ('2027-03-11', 'Hari Raya Aidilfitri (Day 2)', true, 'malay'),
  ('2027-03-12', 'Hari Raya Aidilfitri (Day 3)', true, 'malay'),
  ('2027-04-26', 'Sultan of Terengganu''s Birthday', true, 'all'),
  ('2027-05-01', 'Labour Day', true, 'all'),
  ('2027-05-17', 'Hari Raya Haji', true, 'all'),
  ('2027-05-18', 'Hari Raya Haji (Day 2)', true, 'all'),
  ('2027-06-07', 'Agong''s Birthday', true, 'all'),
  ('2027-08-31', 'National Day', true, 'all'),
  ('2027-09-16', 'Malaysia Day', true, 'all')
;
commit;

-- 检查:每个组别每年应该都是 11 天
select extract(year from holiday_date)::int as year, 'chinese' as grp, count(*) as days
  from public_holidays where applies_to in ('all', 'chinese') group by 1
union all
select extract(year from holiday_date)::int, 'malay', count(*)
  from public_holidays where applies_to in ('all', 'malay') group by 1
order by 1, 2;
