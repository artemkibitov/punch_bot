BEGIN;

-- Откат миграции
ALTER TABLE work_logs
  DROP COLUMN IF EXISTS object_shift_id;

-- Примечание: не восстанавливаем старый внешний ключ shift_id, так как он может быть неправильным

COMMIT;

