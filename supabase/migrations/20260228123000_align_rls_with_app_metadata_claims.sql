CREATE OR REPLACE FUNCTION public.requesting_app_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  WITH raw_role AS (
    SELECT LOWER(COALESCE(
      NULLIF(auth.jwt() -> 'app_metadata' ->> 'role', ''),
      NULLIF(auth.jwt() -> 'app_metadata' ->> 'user_role', ''),
      NULLIF(auth.jwt() -> 'app_metadata' ->> 'app_role', ''),
      NULLIF(auth.jwt() ->> 'role', '')
    )) AS role_value
  )
  SELECT CASE
    WHEN role_value IN ('administrator', 'admin_user', 'super_admin', 'superadmin') THEN 'admin'
    WHEN role_value IN ('pending', 'pending-vendor') THEN 'pending_vendor'
    WHEN role_value IN ('vendor_user', 'merchant') THEN 'vendor'
    ELSE NULLIF(role_value, '')
  END
  FROM raw_role;
$$;

CREATE OR REPLACE FUNCTION public.requesting_vendor_id()
RETURNS INT
LANGUAGE sql
STABLE
AS $$
  WITH raw_vendor AS (
    SELECT COALESCE(
      NULLIF(auth.jwt() -> 'app_metadata' ->> 'vendor_id', ''),
      NULLIF(auth.jwt() -> 'app_metadata' ->> 'vendorId', ''),
      NULLIF(auth.jwt() ->> 'vendor_id', ''),
      NULLIF(auth.jwt() ->> 'vendorId', '')
    ) AS vendor_value
  )
  SELECT CASE
    WHEN vendor_value ~ '^[0-9]+$' THEN vendor_value::INT
    ELSE NULL
  END
  FROM raw_vendor;
$$;

CREATE OR REPLACE FUNCTION public.requesting_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(public.requesting_app_role() = 'admin', FALSE);
$$;

DROP POLICY IF EXISTS "VendorsReadable" ON vendors;
CREATE POLICY "VendorsReadable" ON vendors
  FOR SELECT USING (
    public.requesting_is_admin()
    OR id = public.requesting_vendor_id()
  );

DROP POLICY IF EXISTS "VendorsVendorSelfUpdate" ON vendors;
CREATE POLICY "VendorsVendorSelfUpdate" ON vendors
  FOR UPDATE USING (
    id = public.requesting_vendor_id()
  )
  WITH CHECK (
    id = public.requesting_vendor_id()
  );

DROP POLICY IF EXISTS "VendorsAdminAll" ON vendors;
CREATE POLICY "VendorsAdminAll" ON vendors
  FOR ALL USING (
    public.requesting_is_admin()
  )
  WITH CHECK (
    public.requesting_is_admin()
  );

DROP POLICY IF EXISTS "VendorApplicationsAdminAll" ON vendor_applications;
CREATE POLICY "VendorApplicationsAdminAll" ON vendor_applications
  FOR ALL USING (
    public.requesting_is_admin()
  )
  WITH CHECK (
    public.requesting_is_admin()
  );

DROP POLICY IF EXISTS "OrdersReadable" ON orders;
CREATE POLICY "OrdersReadable" ON orders
  FOR SELECT USING (
    public.requesting_is_admin()
    OR vendor_id = public.requesting_vendor_id()
    OR EXISTS (
      SELECT 1 FROM line_items li
      WHERE li.order_id = orders.id
        AND li.vendor_id = public.requesting_vendor_id()
    )
  );

DROP POLICY IF EXISTS "OrdersAdminWrite" ON orders;
CREATE POLICY "OrdersAdminWrite" ON orders
  FOR ALL USING (
    public.requesting_is_admin()
  )
  WITH CHECK (
    public.requesting_is_admin()
  );

DROP POLICY IF EXISTS "LineItemsReadable" ON line_items;
CREATE POLICY "LineItemsReadable" ON line_items
  FOR SELECT USING (
    public.requesting_is_admin()
    OR vendor_id = public.requesting_vendor_id()
  );

DROP POLICY IF EXISTS "ShipmentsReadable" ON shipments;
CREATE POLICY "ShipmentsReadable" ON shipments
  FOR SELECT USING (
    public.requesting_is_admin()
    OR vendor_id = public.requesting_vendor_id()
  );

DROP POLICY IF EXISTS "OrderVendorSegmentsReadable" ON order_vendor_segments;
CREATE POLICY "OrderVendorSegmentsReadable" ON order_vendor_segments
  FOR SELECT USING (
    public.requesting_is_admin()
    OR vendor_id = public.requesting_vendor_id()
  );

DROP POLICY IF EXISTS "ShipmentAdjustmentRequestsVendorReadable" ON shipment_adjustment_requests;
CREATE POLICY "ShipmentAdjustmentRequestsVendorReadable" ON shipment_adjustment_requests
  FOR SELECT USING (
    public.requesting_is_admin()
    OR vendor_id = public.requesting_vendor_id()
  );

DROP POLICY IF EXISTS "ShipmentAdjustmentRequestsVendorInsert" ON shipment_adjustment_requests;
CREATE POLICY "ShipmentAdjustmentRequestsVendorInsert" ON shipment_adjustment_requests
  FOR INSERT WITH CHECK (
    vendor_id = public.requesting_vendor_id()
  );

DROP POLICY IF EXISTS "ShipmentAdjustmentRequestsAdminAll" ON shipment_adjustment_requests;
CREATE POLICY "ShipmentAdjustmentRequestsAdminAll" ON shipment_adjustment_requests
  FOR ALL USING (
    public.requesting_is_admin()
  )
  WITH CHECK (
    public.requesting_is_admin()
  );

DROP POLICY IF EXISTS "ShipmentAdjustmentCommentsAdminAll" ON shipment_adjustment_comments;
CREATE POLICY "ShipmentAdjustmentCommentsAdminAll" ON shipment_adjustment_comments
  FOR ALL USING (
    public.requesting_is_admin()
  )
  WITH CHECK (
    public.requesting_is_admin()
  );

DROP POLICY IF EXISTS "ShipmentAdjustmentCommentsVendorReadable" ON shipment_adjustment_comments;
CREATE POLICY "ShipmentAdjustmentCommentsVendorReadable" ON shipment_adjustment_comments
  FOR SELECT USING (
    vendor_id = public.requesting_vendor_id()
    AND LOWER(COALESCE(NULLIF(visibility, ''), 'vendor')) <> 'internal'
  );

DROP POLICY IF EXISTS "ShipmentImportJobsVendorReadable" ON shipment_import_jobs;
CREATE POLICY "ShipmentImportJobsVendorReadable" ON shipment_import_jobs
  FOR SELECT USING (
    public.requesting_is_admin()
    OR vendor_id = public.requesting_vendor_id()
  );

DROP POLICY IF EXISTS "ShipmentImportJobsVendorModify" ON shipment_import_jobs;
CREATE POLICY "ShipmentImportJobsVendorModify" ON shipment_import_jobs
  FOR INSERT WITH CHECK (
    vendor_id = public.requesting_vendor_id()
  );

DROP POLICY IF EXISTS "ShipmentImportJobsAdminAll" ON shipment_import_jobs;
CREATE POLICY "ShipmentImportJobsAdminAll" ON shipment_import_jobs
  FOR ALL USING (
    public.requesting_is_admin()
  )
  WITH CHECK (
    public.requesting_is_admin()
  );

DROP POLICY IF EXISTS "ShipmentImportJobItemsVendorReadable" ON shipment_import_job_items;
CREATE POLICY "ShipmentImportJobItemsVendorReadable" ON shipment_import_job_items
  FOR SELECT USING (
    public.requesting_is_admin()
    OR vendor_id = public.requesting_vendor_id()
  );

DROP POLICY IF EXISTS "ShipmentImportJobItemsAdminAll" ON shipment_import_job_items;
CREATE POLICY "ShipmentImportJobItemsAdminAll" ON shipment_import_job_items
  FOR ALL USING (
    public.requesting_is_admin()
  )
  WITH CHECK (
    public.requesting_is_admin()
  );
