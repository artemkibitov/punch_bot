BEGIN;

CREATE TABLE work_logs (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  work_object_id INTEGER NOT NULL REFERENCES work_objects(id),
  shift_id INTEGER REFERENCES shifts(id),
  date DATE NOT NULL,
  actual_start TIMESTAMP NOT NULL,
  actual_end TIMESTAMP,
  lunch_minutes INTEGER NOT NULL DEFAULT 0,
  is_override BOOLEAN NOT NULL DEFAULT false,
  created_by INTEGER NOT NULL REFERENCES employees(id),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_work_logs_employee_date 
  ON work_logs(employee_id, date);
CREATE INDEX idx_work_logs_work_object_date 
  ON work_logs(work_object_id, date);
CREATE INDEX idx_work_logs_shift 
  ON work_logs(shift_id);
CREATE INDEX idx_work_logs_date 
  ON work_logs(date);

COMMIT;

