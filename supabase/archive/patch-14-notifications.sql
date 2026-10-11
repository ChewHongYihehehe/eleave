-- Patch 14:系统内的通知提示(红点 + "有更新"横幅)
-- 可以重复执行,不会删除任何资料。

-- 这笔申请"最近一次被经理做了决定"是什么时候(批准/拒绝/取消/确认取消/不同意取消都算),
-- 不管哪一种决定都会更新这个时间戳,方便统一拿来跟员工"上次看过的时间"比较。
alter table leave_applications
  add column if not exists last_decision_at timestamptz;

-- 员工上一次打开 dashboard、看过通知的时间。null 代表"从来没看过"。
alter table employees
  add column if not exists last_notifications_seen_at timestamptz;
