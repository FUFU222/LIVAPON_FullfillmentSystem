-- Ensure each Shopify line item appears only once per order
WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY order_id, shopify_line_item_id ORDER BY id) AS rn
  FROM line_items
)
DELETE FROM line_items
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

ALTER TABLE line_items
  ADD CONSTRAINT line_items_order_id_shopify_line_item_id_unique
  UNIQUE (order_id, shopify_line_item_id);
