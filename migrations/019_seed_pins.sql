BEGIN;

-- Добавить PIN-коды для Admin и Manager
-- ВАЖНО: Измените PIN-коды на свои!
-- Admin PIN: 0000 (по умолчанию, измените!)
-- Manager PIN: 1111 (по умолчанию, измените!)

INSERT INTO manager_pins (pin, role_type, is_active)
VALUES 
  ('0000', 'ADMIN', true),
  ('1111', 'MANAGER', true)
ON CONFLICT (pin) DO NOTHING;

COMMIT;

