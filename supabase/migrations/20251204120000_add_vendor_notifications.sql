ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS notify_new_orders BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS vendor_order_notifications (
  id BIGSERIAL PRIMARY KEY,
  order_id INT REFERENCES orders(id) ON DELETE CASCADE,
  vendor_id INT REFERENCES vendors(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL DEFAULT 'new_order',
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id, vendor_id, notification_type)
);

CREATE INDEX IF NOT EXISTS idx_vendor_order_notifications_vendor_id
  ON vendor_order_notifications(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_order_notifications_status
  ON vendor_order_notifications(status);
