BEGIN;

ALTER TABLE manager_pins
  DROP COLUMN IF EXISTS role_type;

COMMIT;

