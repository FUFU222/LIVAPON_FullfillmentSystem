-- Enable RLS on sensitive tables and scope access intentionally.
-- Internal integration tables are service-role-only (no non-service policies).

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fulfillment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE fulfillment_request_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "VendorsReadable" ON vendors;
DROP POLICY IF EXISTS "VendorsVendorSelfUpdate" ON vendors;
DROP POLICY IF EXISTS "VendorsAdminAll" ON vendors;

CREATE POLICY "VendorsReadable" ON vendors
  FOR SELECT USING (
    LOWER(COALESCE(NULLIF(auth.jwt()->>'role', ''), '')) = 'admin'
    OR id = COALESCE(NULLIF(auth.jwt()->>'vendor_id', '')::INT, -1)
  );

CREATE POLICY "VendorsVendorSelfUpdate" ON vendors
  FOR UPDATE USING (
    id = COALESCE(NULLIF(auth.jwt()->>'vendor_id', '')::INT, -1)
  )
  WITH CHECK (
    id = COALESCE(NULLIF(auth.jwt()->>'vendor_id', '')::INT, -1)
  );

CREATE POLICY "VendorsAdminAll" ON vendors
  FOR ALL USING (
    LOWER(COALESCE(NULLIF(auth.jwt()->>'role', ''), '')) = 'admin'
  )
  WITH CHECK (
    LOWER(COALESCE(NULLIF(auth.jwt()->>'role', ''), '')) = 'admin'
  );

DROP POLICY IF EXISTS "VendorApplicationsAdminAll" ON vendor_applications;

CREATE POLICY "VendorApplicationsAdminAll" ON vendor_applications
  FOR ALL USING (
    LOWER(COALESCE(NULLIF(auth.jwt()->>'role', ''), '')) = 'admin'
  )
  WITH CHECK (
    LOWER(COALESCE(NULLIF(auth.jwt()->>'role', ''), '')) = 'admin'
  );
