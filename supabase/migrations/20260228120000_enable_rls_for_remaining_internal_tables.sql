-- Enable RLS on remaining internal/supporting tables.
-- These tables are only accessed through service-role flows today, so no
-- non-service policies are added here.

ALTER TABLE IF EXISTS vendor_skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS shipment_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS vendor_order_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS shipment_cancellation_logs ENABLE ROW LEVEL SECURITY;
