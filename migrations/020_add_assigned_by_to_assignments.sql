BEGIN;

-- Добавить колонку assigned_by в таблицу assignments
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS assigned_by INTEGER REFERENCES employees(id);

COMMIT;

