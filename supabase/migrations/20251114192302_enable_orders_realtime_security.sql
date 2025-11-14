ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "OrdersReadable" ON orders;

CREATE POLICY "OrdersReadable" ON orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM line_items li
      WHERE li.order_id = orders.id
        AND li.vendor_id = COALESCE(NULLIF((auth.jwt()->>'vendor_id'),'')::INT, -1)
    )
  );

CREATE POLICY "OrdersInsertUpdate" ON orders
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE PUBLICATION livapon_realtime FOR TABLE orders, line_items, shipments;
