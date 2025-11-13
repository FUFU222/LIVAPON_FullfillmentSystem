-- Sync Shopify line items inside a single transaction.
CREATE OR REPLACE FUNCTION public.sync_order_line_items(
  p_order_id integer,
  p_items jsonb
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  items_count integer;
BEGIN
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'order_id is required';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    DELETE FROM line_items WHERE order_id = p_order_id;
    RETURN;
  END IF;

  items_count := jsonb_array_length(p_items);

  IF items_count = 0 THEN
    DELETE FROM line_items WHERE order_id = p_order_id;
    RETURN;
  END IF;

  INSERT INTO line_items (
    order_id,
    vendor_id,
    vendor_sku_id,
    shopify_line_item_id,
    sku,
    product_name,
    variant_title,
    quantity,
    fulfillable_quantity,
    fulfilled_quantity
  )
  SELECT
    p_order_id,
    NULLIF((item->>'vendor_id')::int, 0),
    NULLIF((item->>'vendor_sku_id')::int, 0),
    (item->>'shopify_line_item_id')::bigint,
    NULLIF(item->>'sku', ''),
    item->>'product_name',
    NULLIF(item->>'variant_title', ''),
    COALESCE((item->>'quantity')::int, 0),
    COALESCE((item->>'fulfillable_quantity')::int, 0),
    COALESCE((item->>'fulfilled_quantity')::int, 0)
  FROM jsonb_array_elements(p_items) AS item
  ON CONFLICT (order_id, shopify_line_item_id)
  DO UPDATE SET
    vendor_id = EXCLUDED.vendor_id,
    vendor_sku_id = EXCLUDED.vendor_sku_id,
    sku = EXCLUDED.sku,
    product_name = EXCLUDED.product_name,
    variant_title = EXCLUDED.variant_title,
    quantity = EXCLUDED.quantity,
    fulfillable_quantity = EXCLUDED.fulfillable_quantity,
    fulfilled_quantity = EXCLUDED.fulfilled_quantity;

  DELETE FROM line_items
  WHERE order_id = p_order_id
    AND shopify_line_item_id NOT IN (
      SELECT (item->>'shopify_line_item_id')::bigint FROM jsonb_array_elements(p_items) AS item
    );
END;
$$;
