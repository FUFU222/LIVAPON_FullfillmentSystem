WITH duplicates AS (
  SELECT
    id,
    webhook_id,
    ROW_NUMBER() OVER (PARTITION BY webhook_id ORDER BY id) AS rn
  FROM webhook_jobs
  WHERE webhook_id IS NOT NULL
)
DELETE FROM webhook_jobs
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

ALTER TABLE webhook_jobs
  ADD CONSTRAINT webhook_jobs_webhook_id_unique UNIQUE (webhook_id)
  DEFERRABLE INITIALLY DEFERRED;
