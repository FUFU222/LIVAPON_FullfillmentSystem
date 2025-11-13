-- Holds Shopify webhook payloads for sequential processing
CREATE TABLE webhook_jobs (
  id BIGSERIAL PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  topic TEXT NOT NULL,
  api_version TEXT,
  webhook_id TEXT,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending / running / completed / failed
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_jobs_status ON webhook_jobs(status, created_at);
CREATE INDEX idx_webhook_jobs_shop_domain ON webhook_jobs(shop_domain);
CREATE INDEX idx_webhook_jobs_webhook_id ON webhook_jobs(webhook_id);

-- Claims pending jobs in FIFO order with SKIP LOCKED semantics
CREATE OR REPLACE FUNCTION public.claim_pending_webhook_jobs(batch_limit integer DEFAULT 10)
RETURNS SETOF webhook_jobs
LANGUAGE plpgsql
AS $$
DECLARE
  limit_value integer;
BEGIN
  limit_value := GREATEST(1, LEAST(COALESCE(batch_limit, 10), 50));

  RETURN QUERY
    WITH cte AS (
      SELECT id
      FROM webhook_jobs
      WHERE status = 'pending'
      ORDER BY created_at
      LIMIT limit_value
      FOR UPDATE SKIP LOCKED
    )
    UPDATE webhook_jobs
    SET status = 'running',
        locked_at = NOW(),
        updated_at = NOW(),
        attempts = attempts + 1
    WHERE id IN (SELECT id FROM cte)
    RETURNING *;
END;
$$;
