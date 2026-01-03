BEGIN;

CREATE TABLE work_objects (
  id SERIAL PRIMARY KEY,

  name TEXT NOT NULL,
  status work_object_status NOT NULL DEFAULT 'ACTIVE',

  created_by INTEGER NOT NULL
    REFERENCES employees(id),

  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_work_objects_status
  ON work_objects(status);

COMMIT;
