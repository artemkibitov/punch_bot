BEGIN;

CREATE TYPE role_type AS ENUM (
  'MANAGER',
  'EMPLOYEE',
  'ADMIN'
);

CREATE TYPE work_object_status AS ENUM (
  'ACTIVE',
  'ARCHIVED'
);

CREATE TYPE session_status AS ENUM (
  'ACTIVE',
  'CLOSED'
);

CREATE TYPE shift_type AS ENUM (
  'REGULAR',
  'OVERRIDE'
);

CREATE TYPE break_type AS ENUM (
  'LUNCH',
  'PERSONAL',
  'VACATION',
  'SICK'
);

COMMIT;
