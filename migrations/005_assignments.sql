BEGIN;

CREATE TABLE assignments (
  id SERIAL PRIMARY KEY,

  employee_id INTEGER NOT NULL
    REFERENCES employees(id),

  work_object_id INTEGER NOT NULL
    REFERENCES work_objects(id),

  assigned_at TIMESTAMP NOT NULL DEFAULT now(),
  unassigned_at TIMESTAMP
);

CREATE UNIQUE INDEX uniq_active_assignment
  ON assignments(employee_id, work_object_id)
  WHERE unassigned_at IS NULL;

COMMIT;
