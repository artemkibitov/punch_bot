BEGIN;

CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  field_name TEXT,
  old_value JSONB,
  new_value JSONB,
  changed_by INTEGER NOT NULL REFERENCES employees(id),
  changed_at TIMESTAMP NOT NULL DEFAULT now(),
  metadata JSONB
);

CREATE INDEX idx_audit_logs_entity 
  ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_changed_by 
  ON audit_logs(changed_by);
CREATE INDEX idx_audit_logs_changed_at 
  ON audit_logs(changed_at);
CREATE INDEX idx_audit_logs_action 
  ON audit_logs(action);

COMMIT;

