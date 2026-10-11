-- Patch 7: Part-time employees no longer require a Supabase auth account.
-- Their work hours are recorded by the manager directly from the Work Hours page.
--
-- 1. Make auth_user_id nullable so we can insert part-time employee rows
--    without a corresponding auth.users entry.
-- 2. Drop the UNIQUE constraint first (it lives on the column definition),
--    then recreate it as a partial unique index that only enforces uniqueness
--    when the value is NOT NULL (so multiple part-timers with NULL are fine).

-- Step 1: remove the existing unique constraint on auth_user_id
ALTER TABLE employees
  DROP CONSTRAINT IF EXISTS employees_auth_user_id_key;

-- Step 2: make the column nullable
ALTER TABLE employees
  ALTER COLUMN auth_user_id DROP NOT NULL;

-- Step 3: re-add uniqueness only for non-null values
CREATE UNIQUE INDEX IF NOT EXISTS employees_auth_user_id_unique_notnull
  ON employees (auth_user_id)
  WHERE auth_user_id IS NOT NULL;
