ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shopify_fo_status TEXT;
