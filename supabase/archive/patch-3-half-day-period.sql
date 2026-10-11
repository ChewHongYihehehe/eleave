-- ========================================
-- 补丁4:半天假加入 AM / PM 选择
-- ========================================
alter table leave_applications
  add column if not exists half_day_period text check (half_day_period in ('am', 'pm'));
