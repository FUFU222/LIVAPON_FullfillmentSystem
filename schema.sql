-- =========================================
-- schema.sql : Shopify配送管理アプリ (MVP)
-- =========================================

-- ベンダー（メーカー）情報
CREATE TABLE vendors (
  id SERIAL PRIMARY KEY,
  code CHAR(4) UNIQUE,
  name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  contact_email VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ベンダー利用申請
CREATE TABLE vendor_applications (
  id SERIAL PRIMARY KEY,
  auth_user_id UUID,
  vendor_code CHAR(4),
  company_name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  contact_email VARCHAR(255) NOT NULL,
  message TEXT,
  status VARCHAR(32) DEFAULT 'pending', -- pending / approved / rejected
  notes TEXT,
  vendor_id INT REFERENCES vendors(id),
  reviewer_id UUID,
  reviewer_email VARCHAR(255),
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Shopify注文
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  shopify_order_id BIGINT NOT NULL UNIQUE, -- Shopify側の注文ID
  shopify_fulfillment_order_id BIGINT,
  shop_domain TEXT,
  vendor_id INT REFERENCES vendors(id),
  order_number VARCHAR(50) NOT NULL, -- Shopifyの注文番号 (#1001 等)
  customer_name VARCHAR(255),
  shipping_postal VARCHAR(20),
  shipping_prefecture VARCHAR(100),
  shipping_city VARCHAR(255),
  shipping_address1 VARCHAR(255),
  shipping_address2 VARCHAR(255),
  status VARCHAR(50) DEFAULT 'unfulfilled', -- Fulfilled / Partially Fulfilled / Unfulfilled
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ベンダーごとのSKU管理
CREATE TABLE vendor_skus (
  id SERIAL PRIMARY KEY,
  vendor_id INT REFERENCES vendors(id) ON DELETE CASCADE,
  sku VARCHAR(16) NOT NULL UNIQUE,
  product_number INT NOT NULL,
  variation_number INT NOT NULL,
  shopify_product_id BIGINT,
  shopify_variant_id BIGINT,
  attributes JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 注文ごとの商品ライン
CREATE TABLE line_items (
  id SERIAL PRIMARY KEY,
  order_id INT REFERENCES orders(id) ON DELETE CASCADE,
  vendor_id INT REFERENCES vendors(id),
  vendor_sku_id INT REFERENCES vendor_skus(id),
  shopify_line_item_id BIGINT NOT NULL, -- Shopify側のLine Item ID
  fulfillment_order_line_item_id BIGINT,
  sku VARCHAR(16),
  product_name VARCHAR(255) NOT NULL,
  variant_title VARCHAR(255),
  quantity INT NOT NULL,
  fulfillable_quantity INT DEFAULT 0,
  fulfilled_quantity INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT line_items_order_id_shopify_line_item_id_unique UNIQUE (order_id, shopify_line_item_id)
);

CREATE TABLE shipments (
  id SERIAL PRIMARY KEY,
  vendor_id INT REFERENCES vendors(id),
  order_id INT REFERENCES orders(id) ON DELETE CASCADE,
  tracking_number VARCHAR(100),
  carrier VARCHAR(100),
  tracking_company VARCHAR(100),
  tracking_url TEXT,
  shopify_fulfillment_id BIGINT,
  status VARCHAR(50) DEFAULT 'in_transit',
  shipped_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  sync_status VARCHAR(32) DEFAULT 'pending',
  synced_at TIMESTAMPTZ,
  sync_error TEXT,
  sync_retry_count INT DEFAULT 0,
  last_retry_at TIMESTAMPTZ,
  sync_pending_until TIMESTAMPTZ
);

-- Shopify OAuth 接続情報
CREATE TABLE shopify_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  scopes TEXT,
  installed_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE shipment_line_items (
  shipment_id INT REFERENCES shipments(id) ON DELETE CASCADE,
  line_item_id INT REFERENCES line_items(id) ON DELETE CASCADE,
  fulfillment_order_line_item_id BIGINT,
  quantity INT DEFAULT 0,
  PRIMARY KEY (shipment_id, line_item_id)
);

-- CSVインポートログ（アップロード履歴管理用）
CREATE TABLE import_logs (
  id SERIAL PRIMARY KEY,
  vendor_id INT REFERENCES vendors(id),
  file_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending', -- pending / success / failed
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_orders_vendor_id ON orders(vendor_id);
CREATE INDEX idx_line_items_order_id ON line_items(order_id);
CREATE INDEX idx_line_items_vendor_id ON line_items(vendor_id);
CREATE INDEX idx_shipments_tracking_number ON shipments(tracking_number);
CREATE INDEX idx_vendor_skus_vendor_id ON vendor_skus(vendor_id);
CREATE INDEX idx_vendor_applications_status ON vendor_applications(status);
CREATE INDEX idx_vendor_applications_vendor_code ON vendor_applications(vendor_code);
CREATE INDEX idx_shipments_vendor_id ON shipments(vendor_id);
CREATE INDEX idx_shipment_line_items_line_item_id ON shipment_line_items(line_item_id);
CREATE INDEX idx_orders_shop_domain ON orders(shop_domain);
CREATE INDEX idx_orders_shopify_fo_id ON orders(shopify_fulfillment_order_id);
CREATE INDEX idx_line_items_fo_line_item_id ON line_items(fulfillment_order_line_item_id);
CREATE INDEX idx_shipments_order_id ON shipments(order_id);
CREATE INDEX idx_shipments_shopify_fulfillment_id ON shipments(shopify_fulfillment_id);
CREATE INDEX idx_shipments_sync_status ON shipments(sync_status);
CREATE INDEX idx_shipment_line_items_fo_line_item_id ON shipment_line_items(fulfillment_order_line_item_id);

-- Shopify Fulfillment Service callback リクエストの記録
CREATE TABLE fulfillment_requests (
  id SERIAL PRIMARY KEY,
  shop_domain TEXT,
  shopify_order_id BIGINT NOT NULL,
  shopify_fulfillment_order_id BIGINT NOT NULL,
  order_id INT REFERENCES orders(id) ON DELETE SET NULL,
  vendor_id INT REFERENCES vendors(id) ON DELETE SET NULL,
  status VARCHAR(32) DEFAULT 'pending',
  message TEXT,
  raw_payload JSONB NOT NULL,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fulfillment_requests_unique_fo UNIQUE (shopify_fulfillment_order_id)
);

CREATE TABLE fulfillment_request_line_items (
  id SERIAL PRIMARY KEY,
  fulfillment_request_id INT NOT NULL REFERENCES fulfillment_requests(id) ON DELETE CASCADE,
  line_item_id INT REFERENCES line_items(id) ON DELETE SET NULL,
  shopify_line_item_id BIGINT NOT NULL,
  fulfillment_order_line_item_id BIGINT,
  requested_quantity INT,
  remaining_quantity INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fulfillment_requests_shop_domain ON fulfillment_requests(shop_domain);
CREATE INDEX idx_fulfillment_requests_vendor_id ON fulfillment_requests(vendor_id);
CREATE INDEX idx_fulfillment_request_line_items_request_id ON fulfillment_request_line_items(fulfillment_request_id);
CREATE INDEX idx_fulfillment_request_line_items_line_item_id ON fulfillment_request_line_items(line_item_id);

-- Webhook job queue
CREATE TABLE webhook_jobs (
  id BIGSERIAL PRIMARY KEY,
  shop_domain TEXT NOT NULL,
  topic TEXT NOT NULL,
  api_version TEXT,
  webhook_id TEXT,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_jobs_status ON webhook_jobs(status, created_at);
CREATE INDEX idx_webhook_jobs_shop_domain ON webhook_jobs(shop_domain);
CREATE INDEX idx_webhook_jobs_webhook_id ON webhook_jobs(webhook_id);

-- Stored procedures
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

CREATE OR REPLACE FUNCTION public.claim_pending_webhook_jobs(batch_limit integer DEFAULT 10)
RETURNS SETOF webhook_jobs
LANGUAGE plpgsql
AS $$
DECLARE
  limit_value integer;
BEGIN
  limit_value := GREATEST(1, LEAST(COALESCE(batch_limit, 10), 50));

  RETURN QUERY
    WITH cte AS (
      SELECT id
      FROM webhook_jobs
      WHERE status = 'pending'
      ORDER BY created_at
      LIMIT limit_value
      FOR UPDATE SKIP LOCKED
    )
    UPDATE webhook_jobs
    SET status = 'running',
        locked_at = NOW(),
        updated_at = NOW(),
        attempts = attempts + 1
    WHERE id IN (SELECT id FROM cte)
    RETURNING *;
END;
$$;
