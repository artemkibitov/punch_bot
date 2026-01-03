BEGIN;

CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,

  telegram_user_id BIGINT NOT NULL UNIQUE,

  state TEXT,
  data JSONB NOT NULL DEFAULT '{}',

  status session_status NOT NULL DEFAULT 'ACTIVE',

  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_telegram_user_id
  ON sessions(telegram_user_id);

COMMIT;
