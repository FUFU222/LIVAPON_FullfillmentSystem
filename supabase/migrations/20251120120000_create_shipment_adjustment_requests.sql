CREATE TABLE IF NOT EXISTS shipment_adjustment_requests (
  id SERIAL PRIMARY KEY,
  vendor_id INT REFERENCES vendors(id) ON DELETE CASCADE,
  order_id INT REFERENCES orders(id) ON DELETE SET NULL,
  order_number VARCHAR(64) NOT NULL,
  shopify_order_id BIGINT,
  tracking_number VARCHAR(120),
  issue_type VARCHAR(50) NOT NULL,
  issue_summary TEXT NOT NULL,
  desired_change TEXT NOT NULL,
  line_item_context TEXT,
  contact_name VARCHAR(255),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(100),
  submitted_by UUID,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipment_adjustment_requests_vendor_id
  ON shipment_adjustment_requests(vendor_id);
CREATE INDEX IF NOT EXISTS idx_shipment_adjustment_requests_status
  ON shipment_adjustment_requests(status);

ALTER TABLE shipment_adjustment_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ShipmentAdjustmentRequestsVendorReadable" ON shipment_adjustment_requests;
CREATE POLICY "ShipmentAdjustmentRequestsVendorReadable" ON shipment_adjustment_requests
  FOR SELECT USING (
    LOWER(COALESCE(NULLIF(auth.jwt()->>'role', ''), '')) = 'admin'
    OR vendor_id = COALESCE(NULLIF(auth.jwt()->>'vendor_id', '')::INT, -1)
  );

DROP POLICY IF EXISTS "ShipmentAdjustmentRequestsVendorInsert" ON shipment_adjustment_requests;
CREATE POLICY "ShipmentAdjustmentRequestsVendorInsert" ON shipment_adjustment_requests
  FOR INSERT WITH CHECK (
    vendor_id = COALESCE(NULLIF(auth.jwt()->>'vendor_id', '')::INT, -1)
  );

DROP POLICY IF EXISTS "ShipmentAdjustmentRequestsAdminAll" ON shipment_adjustment_requests;
CREATE POLICY "ShipmentAdjustmentRequestsAdminAll" ON shipment_adjustment_requests
  FOR ALL USING (
    LOWER(COALESCE(NULLIF(auth.jwt()->>'role', ''), '')) = 'admin'
  )
  WITH CHECK (
    LOWER(COALESCE(NULLIF(auth.jwt()->>'role', ''), '')) = 'admin'
  );

ALTER TABLE shipment_adjustment_requests REPLICA IDENTITY FULL;
