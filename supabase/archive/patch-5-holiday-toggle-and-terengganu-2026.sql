-- Patch 5: public_holidays 加 enable/disable 开关 + 预填 2026 年登嘉楼(Terengganu)官方公假
-- 在现有正式数据库上跑这个即可,不会影响你已经手动加过的公假记录。

-- 1. 加 is_enabled 欄位(预设 true = 启用中)
alter table public_holidays
  add column if not exists is_enabled boolean not null default true;

-- 2. 预填 2026 年登嘉楼(Terengganu)官方公假(24天)
--    资料来源:terengganu.gov.my 官方公告(经 publicholidays.com.my / officeholidays.com 交叉核对)
--    用 ON CONFLICT DO NOTHING,如果这个日期你已经手动加过了就不会重复或覆盖
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
