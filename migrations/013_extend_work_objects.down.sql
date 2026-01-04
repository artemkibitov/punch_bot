BEGIN;

-- Удалить индексы
DROP INDEX IF EXISTS idx_work_objects_manager;

-- Удалить добавленные поля
ALTER TABLE work_objects
  DROP COLUMN IF EXISTS timezone,
  DROP COLUMN IF EXISTS planned_start,
  DROP COLUMN IF EXISTS planned_end,
  DROP COLUMN IF EXISTS lunch_minutes,
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS manager_id;

COMMIT;

