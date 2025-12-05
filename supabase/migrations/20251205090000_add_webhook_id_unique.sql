ALTER TABLE webhook_jobs
  ADD CONSTRAINT webhook_jobs_webhook_id_unique UNIQUE (webhook_id)
  DEFERRABLE INITIALLY DEFERRED;
