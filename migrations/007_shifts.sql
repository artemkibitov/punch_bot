BEGIN;

CREATE TABLE shifts (
  id SERIAL PRIMARY KEY,

  employee_id INTEGER NOT NULL
    REFERENCES employees(id),

  work_object_id INTEGER NOT NULL
    REFERENCES work_objects(id),

  shift_date DATE NOT NULL,

  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,

  type shift_type NOT NULL DEFAULT 'REGULAR',

  parent_shift_id INTEGER
    REFERENCES shifts(id),

  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_shifts_employee_date
  ON shifts(employee_id, shift_date);

COMMIT;
