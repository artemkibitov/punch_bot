BEGIN;

-- Удалить колонку assigned_by из таблицы assignments
ALTER TABLE assignments
  DROP COLUMN IF EXISTS assigned_by;

COMMIT;

