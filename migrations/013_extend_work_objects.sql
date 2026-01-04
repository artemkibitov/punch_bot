BEGIN;

-- Добавить manager_id (если его нет)
ALTER TABLE work_objects
  ADD COLUMN IF NOT EXISTS manager_id INTEGER REFERENCES employees(id);

-- Обновить существующие объекты: manager_id = created_by
UPDATE work_objects SET manager_id = created_by WHERE manager_id IS NULL;

-- Сделать manager_id обязательным
ALTER TABLE work_objects
  ALTER COLUMN manager_id SET NOT NULL;

-- Добавить поля для графика и timezone
ALTER TABLE work_objects
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS planned_start TIME NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS planned_end TIME NOT NULL DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS lunch_minutes INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();

-- Создать индекс для поиска объектов менеджера
CREATE INDEX IF NOT EXISTS idx_work_objects_manager 
  ON work_objects(manager_id, status);

COMMIT;

