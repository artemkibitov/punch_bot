BEGIN;

-- Добавить поле role_type в manager_pins
ALTER TABLE manager_pins
  ADD COLUMN role_type role_type;

-- Обновить существующие PIN (если есть) на MANAGER
UPDATE manager_pins SET role_type = 'MANAGER' WHERE role_type IS NULL;

-- Сделать role_type обязательным
ALTER TABLE manager_pins
  ALTER COLUMN role_type SET NOT NULL;

COMMIT;

