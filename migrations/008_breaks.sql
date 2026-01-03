BEGIN;

CREATE TABLE breaks (
  id SERIAL PRIMARY KEY,

  shift_id INTEGER NOT NULL
    REFERENCES shifts(id) ON DELETE CASCADE,

  type break_type NOT NULL,

  start_time TIMESTAMP,
  end_time TIMESTAMP,

  duration_minutes INTEGER,

  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_breaks_shift_id
  ON breaks(shift_id);

COMMIT;
