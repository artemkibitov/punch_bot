BEGIN;

-- Исправить ссылку shift_id в work_logs: должна ссылаться на object_shifts, а не на shifts
-- Сначала удаляем старую внешнюю ключевую связь (если она есть)
ALTER TABLE work_logs
  DROP CONSTRAINT IF EXISTS work_logs_shift_id_fkey;

-- Добавляем новую колонку object_shift_id, которая будет ссылаться на object_shifts
ALTER TABLE work_logs
  ADD COLUMN IF NOT EXISTS object_shift_id INTEGER REFERENCES object_shifts(id);

-- Копируем данные из shift_id в object_shift_id (если есть данные)
-- Примечание: старая таблица shifts не используется в новой модели
-- Поэтому для существующих записей object_shift_id будет NULL

-- Делаем shift_id необязательной (она остается для обратной совместимости, но не используется)
-- object_shift_id - новая колонка для связи с object_shifts

COMMIT;

