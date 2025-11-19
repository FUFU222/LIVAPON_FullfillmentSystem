-- Relax SKU length constraints to accommodate Shopify line items
ALTER TABLE vendor_skus
  ALTER COLUMN sku TYPE VARCHAR(64);

ALTER TABLE line_items
  ALTER COLUMN sku TYPE VARCHAR(64);
