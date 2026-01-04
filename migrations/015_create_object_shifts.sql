BEGIN;

-- Создать новую таблицу object_shifts для новой модели смен
-- (смена относится к объекту, а не к сотруднику)
CREATE TABLE object_shifts (
  id SERIAL PRIMARY KEY,
  work_object_id INTEGER NOT NULL REFERENCES work_objects(id),
  date DATE NOT NULL,
  planned_start TIMESTAMP NOT NULL,
  planned_end TIMESTAMP NOT NULL,
  lunch_minutes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  started_at TIMESTAMP,
  closed_at TIMESTAMP,
  confirmed_by INTEGER REFERENCES employees(id),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE(work_object_id, date)
);

CREATE INDEX idx_object_shifts_work_object_date 
  ON object_shifts(work_object_id, date);
CREATE INDEX idx_object_shifts_status 
  ON object_shifts(status);
CREATE INDEX idx_object_shifts_date 
  ON object_shifts(date);

-- Примечание: старая таблица shifts остается для истории
-- Новая модель использует object_shifts

COMMIT;

