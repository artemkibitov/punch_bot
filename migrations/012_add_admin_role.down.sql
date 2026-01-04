BEGIN;

-- Удалить роль ADMIN
DELETE FROM roles WHERE code = 'ADMIN';

-- Примечание: нельзя удалить значение из ENUM в PostgreSQL
-- Если нужно полностью удалить, потребуется пересоздать тип

COMMIT;

