BEGIN;

CREATE TABLE referral_tokens (
  id SERIAL PRIMARY KEY,

  token TEXT NOT NULL UNIQUE,

  manager_id INTEGER NOT NULL
    REFERENCES employees(id),

  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,

  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_referral_tokens_token
  ON referral_tokens(token);

COMMIT;
