BEGIN;

CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  code role_type NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

INSERT INTO roles (code) VALUES
  ('MANAGER'),
  ('EMPLOYEE');

COMMIT;
