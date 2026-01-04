BEGIN;

-- Удалить индексы
DROP INDEX IF EXISTS idx_employees_status;
DROP INDEX IF EXISTS idx_employees_ref_code;

-- Удалить добавленные поля
ALTER TABLE employees
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS ref_code,
  DROP COLUMN IF EXISTS ref_code_expires_at,
  DROP COLUMN IF EXISTS updated_at;

COMMIT;

