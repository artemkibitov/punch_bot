BEGIN;

-- Добавить поля для статуса и ref-кодов
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS ref_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS ref_code_expires_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();

-- Создать индексы
CREATE INDEX IF NOT EXISTS idx_employees_status 
  ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_ref_code 
  ON employees(ref_code) WHERE ref_code IS NOT NULL;

COMMIT;

