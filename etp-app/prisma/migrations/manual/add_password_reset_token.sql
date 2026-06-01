-- Run this against the Supabase production DB before deploying.
-- psql $DATABASE_URL -f prisma/migrations/manual/add_password_reset_token.sql

CREATE TABLE IF NOT EXISTS password_reset_token (
  id         TEXT        NOT NULL,
  email      TEXT        NOT NULL,
  user_id    TEXT        NOT NULL,
  token_hash TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT password_reset_token_pkey       PRIMARY KEY (id),
  CONSTRAINT password_reset_token_hash_key   UNIQUE (token_hash)
);
