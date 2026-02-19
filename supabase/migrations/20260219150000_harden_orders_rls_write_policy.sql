-- Harden orders RLS:
-- 1) Remove permissive write policy (FOR ALL USING true).
-- 2) Restrict writes to admin JWT role only.
-- 3) Keep vendor-scoped read access and allow admin reads explicitly.

DROP POLICY IF EXISTS "OrdersInsertUpdate" ON orders;
DROP POLICY IF EXISTS "OrdersAdminWrite" ON orders;
DROP POLICY IF EXISTS "OrdersReadable" ON orders;

CREATE POLICY "OrdersReadable" ON orders
  FOR SELECT USING (
    LOWER(COALESCE(NULLIF(auth.jwt()->>'role', ''), '')) = 'admin'
    OR (vendor_id = COALESCE(NULLIF((auth.jwt()->>'vendor_id'),'')::INT, -1))
    OR EXISTS (
      SELECT 1 FROM line_items li
      WHERE li.order_id = orders.id
        AND li.vendor_id = COALESCE(NULLIF((auth.jwt()->>'vendor_id'),'')::INT, -1)
    )
  );

CREATE POLICY "OrdersAdminWrite" ON orders
  FOR ALL USING (
    LOWER(COALESCE(NULLIF(auth.jwt()->>'role', ''), '')) = 'admin'
  )
  WITH CHECK (
    LOWER(COALESCE(NULLIF(auth.jwt()->>'role', ''), '')) = 'admin'
  );
