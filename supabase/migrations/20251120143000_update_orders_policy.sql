DROP POLICY IF EXISTS "OrdersReadable" ON orders;
CREATE POLICY "OrdersReadable" ON orders
  FOR SELECT USING (
    (vendor_id = COALESCE(NULLIF((auth.jwt()->>'vendor_id'),'')::INT, -1))
    OR EXISTS (
      SELECT 1 FROM line_items li
      WHERE li.order_id = orders.id
        AND li.vendor_id = COALESCE(NULLIF((auth.jwt()->>'vendor_id'),'')::INT, -1)
    )
  );
