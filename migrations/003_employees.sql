BEGIN;

CREATE TABLE employees (
  id SERIAL PRIMARY KEY,

  telegram_user_id BIGINT UNIQUE,
  full_name TEXT NOT NULL,

  role_id INTEGER NOT NULL
    REFERENCES roles(id),

  created_by INTEGER
    REFERENCES employees(id),

  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_employees_telegram_user_id
  ON employees(telegram_user_id);

COMMIT;
