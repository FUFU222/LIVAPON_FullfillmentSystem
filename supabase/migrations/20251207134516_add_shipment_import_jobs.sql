-- Shipment import background jobs
CREATE TABLE IF NOT EXISTS shipment_import_jobs (
  id BIGSERIAL PRIMARY KEY,
  vendor_id INT REFERENCES vendors(id),
  tracking_number VARCHAR(200) NOT NULL,
  carrier VARCHAR(100) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  total_count INT NOT NULL DEFAULT 0,
  processed_count INT NOT NULL DEFAULT 0,
  error_count INT NOT NULL DEFAULT 0,
  last_error TEXT,
  attempts INT NOT NULL DEFAULT 0,
  locked_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipment_import_job_items (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT REFERENCES shipment_import_jobs(id) ON DELETE CASCADE,
  vendor_id INT REFERENCES vendors(id),
  order_id INT REFERENCES orders(id) ON DELETE SET NULL,
  line_item_id INT REFERENCES line_items(id) ON DELETE SET NULL,
  quantity INT NOT NULL DEFAULT 1,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  error_message TEXT,
  attempts INT NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faster job querying
CREATE INDEX IF NOT EXISTS idx_shipment_import_jobs_vendor_id ON shipment_import_jobs(vendor_id);
CREATE INDEX IF NOT EXISTS idx_shipment_import_jobs_status ON shipment_import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_shipment_import_jobs_created_at ON shipment_import_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_shipment_import_job_items_job_id ON shipment_import_job_items(job_id);
CREATE INDEX IF NOT EXISTS idx_shipment_import_job_items_vendor_id ON shipment_import_job_items(vendor_id);
CREATE INDEX IF NOT EXISTS idx_shipment_import_job_items_status ON shipment_import_job_items(status);

-- Enable RLS
ALTER TABLE shipment_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_import_job_items ENABLE ROW LEVEL SECURITY;

-- RLS policies
DROP POLICY IF EXISTS "ShipmentImportJobsVendorReadable" ON shipment_import_jobs;
CREATE POLICY "ShipmentImportJobsVendorReadable" ON shipment_import_jobs
  FOR SELECT USING (
    LOWER(COALESCE(NULLIF(auth.jwt()->>'role', ''), '')) = 'admin'
    OR vendor_id = COALESCE(NULLIF(auth.jwt()->>'vendor_id', '')::INT, -1)
  );

DROP POLICY IF EXISTS "ShipmentImportJobsVendorModify" ON shipment_import_jobs;
CREATE POLICY "ShipmentImportJobsVendorModify" ON shipment_import_jobs
  FOR INSERT WITH CHECK (
    vendor_id = COALESCE(NULLIF(auth.jwt()->>'vendor_id', '')::INT, -1)
  );

DROP POLICY IF EXISTS "ShipmentImportJobsAdminAll" ON shipment_import_jobs;
CREATE POLICY "ShipmentImportJobsAdminAll" ON shipment_import_jobs
  FOR ALL USING (
    LOWER(COALESCE(NULLIF(auth.jwt()->>'role', ''), '')) = 'admin'
  )
  WITH CHECK (
    LOWER(COALESCE(NULLIF(auth.jwt()->>'role', ''), '')) = 'admin'
  );

DROP POLICY IF EXISTS "ShipmentImportJobItemsVendorReadable" ON shipment_import_job_items;
CREATE POLICY "ShipmentImportJobItemsVendorReadable" ON shipment_import_job_items
  FOR SELECT USING (
    LOWER(COALESCE(NULLIF(auth.jwt()->>'role', ''), '')) = 'admin'
    OR vendor_id = COALESCE(NULLIF(auth.jwt()->>'vendor_id', '')::INT, -1)
  );

DROP POLICY IF EXISTS "ShipmentImportJobItemsAdminAll" ON shipment_import_job_items;
CREATE POLICY "ShipmentImportJobItemsAdminAll" ON shipment_import_job_items
  FOR ALL USING (
    LOWER(COALESCE(NULLIF(auth.jwt()->>'role', ''), '')) = 'admin'
  )
  WITH CHECK (
    LOWER(COALESCE(NULLIF(auth.jwt()->>'role', ''), '')) = 'admin'
  );

-- RPC for claiming shipment jobs
CREATE OR REPLACE FUNCTION public.claim_pending_shipment_import_jobs(job_limit integer DEFAULT 1)
RETURNS SETOF shipment_import_jobs
LANGUAGE plpgsql
AS $$
DECLARE
  limit_value integer;
BEGIN
  limit_value := GREATEST(1, LEAST(COALESCE(job_limit, 1), 10));

  RETURN QUERY
    WITH cte AS (
      SELECT id
      FROM shipment_import_jobs
      WHERE status = 'pending'
      ORDER BY created_at
      LIMIT limit_value
      FOR UPDATE SKIP LOCKED
    )
    UPDATE shipment_import_jobs
    SET status = 'running',
        locked_at = NOW(),
        attempts = attempts + 1,
        last_attempt_at = NOW(),
        updated_at = NOW()
    WHERE id IN (SELECT id FROM cte)
    RETURNING *;
END;
$$;
