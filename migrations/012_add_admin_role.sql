BEGIN;

-- Добавить ADMIN в role_type enum (если еще не существует)
-- Проверяем через pg_enum перед добавлением
DO $$
BEGIN
    -- Проверяем, существует ли значение 'ADMIN' в enum role_type
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'role_type'
        AND e.enumlabel = 'ADMIN'
    ) THEN
        -- Добавляем значение только если его еще нет
        ALTER TYPE role_type ADD VALUE 'ADMIN';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Игнорируем ошибки (значение может уже существовать)
        NULL;
END $$;

-- Вставить роль ADMIN (если еще не существует)
INSERT INTO roles (code)
SELECT 'ADMIN'
WHERE NOT EXISTS (
    SELECT 1 FROM roles WHERE code = 'ADMIN'
);

COMMIT;

