ALTER TABLE shipment_adjustment_requests
  ADD COLUMN IF NOT EXISTS assigned_admin_id UUID,
  ADD COLUMN IF NOT EXISTS assigned_admin_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS resolution_summary TEXT,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS shipment_adjustment_comments (
  id SERIAL PRIMARY KEY,
  request_id INT REFERENCES shipment_adjustment_requests(id) ON DELETE CASCADE,
  vendor_id INT REFERENCES vendors(id) ON DELETE CASCADE,
  author_id UUID,
  author_name VARCHAR(255),
  author_role VARCHAR(32) NOT NULL DEFAULT 'admin',
  visibility VARCHAR(32) NOT NULL DEFAULT 'vendor',
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipment_adjustment_requests_assigned_admin_id
  ON shipment_adjustment_requests(assigned_admin_id);
CREATE INDEX IF NOT EXISTS idx_shipment_adjustment_comments_request_id
  ON shipment_adjustment_comments(request_id);
CREATE INDEX IF NOT EXISTS idx_shipment_adjustment_comments_vendor_id
  ON shipment_adjustment_comments(vendor_id);

ALTER TABLE shipment_adjustment_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ShipmentAdjustmentCommentsAdminAll" ON shipment_adjustment_comments;
CREATE POLICY "ShipmentAdjustmentCommentsAdminAll" ON shipment_adjustment_comments
  FOR ALL USING (
    LOWER(COALESCE(NULLIF(auth.jwt()->>'role', ''), '')) = 'admin'
  )
  WITH CHECK (
    LOWER(COALESCE(NULLIF(auth.jwt()->>'role', ''), '')) = 'admin'
  );

DROP POLICY IF EXISTS "ShipmentAdjustmentCommentsVendorReadable" ON shipment_adjustment_comments;
CREATE POLICY "ShipmentAdjustmentCommentsVendorReadable" ON shipment_adjustment_comments
  FOR SELECT USING (
    vendor_id = COALESCE(NULLIF(auth.jwt()->>'vendor_id', '')::INT, -1)
    AND LOWER(COALESCE(NULLIF(visibility, ''), 'vendor')) <> 'internal'
  );
