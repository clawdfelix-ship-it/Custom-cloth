-- Email outbox: transactional emails are enqueued in the SAME DB transaction
-- as the order, then delivered by a scheduled worker (Vercel cron). This makes
-- delivery reliable on serverless, where opening a fresh SMTP connection
-- during checkout can time out / be relay-throttled by Zoho.
CREATE TABLE IF NOT EXISTS email_outbox (
  id              BIGSERIAL PRIMARY KEY,
  to_address      TEXT NOT NULL,
  cc_address      TEXT,
  bcc_address     TEXT,
  subject         TEXT NOT NULL,
  html_body       TEXT NOT NULL,
  text_body       TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | sent | failed
  attempts        INTEGER NOT NULL DEFAULT 0,
  max_attempts    INTEGER NOT NULL DEFAULT 6,
  last_error      TEXT,
  available_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  related_type    TEXT,                            -- e.g. 'order'
  related_id      BIGINT
);

CREATE INDEX IF NOT EXISTS idx_email_outbox_pending
  ON email_outbox (available_at)
  WHERE status = 'pending';
