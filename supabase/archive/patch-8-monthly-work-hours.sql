-- Patch 8: New monthly_work_hours table for part-time employees.
-- Replaces the daily time-in/time-out approach with a simple monthly total
-- that matches the Excel tracking format (one number per employee per month).

CREATE TABLE IF NOT EXISTS monthly_work_hours (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  year          int  NOT NULL,
  month         int  NOT NULL CHECK (month BETWEEN 1 AND 12),
  total_hours   numeric NOT NULL DEFAULT 0 CHECK (total_hours >= 0),
  notes         text,
  created_at    timestamptz DEFAULT now(),

  UNIQUE (employee_id, year, month)
);

ALTER TABLE monthly_work_hours ENABLE ROW LEVEL SECURITY;

-- Only managers can read and write monthly work hours.
-- Part-time employees have no auth account so they can never hit this table.
DROP POLICY IF EXISTS "managers can manage monthly work hours" ON monthly_work_hours;
CREATE POLICY "managers can manage monthly work hours" ON monthly_work_hours
  FOR ALL USING (is_manager());
