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
  contact_phone VARCHAR(100),
  notify_new_orders BOOLEAN NOT NULL DEFAULT TRUE,
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
  contact_phone VARCHAR(100),
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
  shopify_fo_status VARCHAR(50),
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
  , last_updated_source TEXT NOT NULL DEFAULT 'console'
  , last_updated_by UUID
);

-- ベンダーごとのSKU管理
CREATE TABLE vendor_skus (
  id SERIAL PRIMARY KEY,
  vendor_id INT REFERENCES vendors(id) ON DELETE CASCADE,
  sku VARCHAR(64) NOT NULL UNIQUE,
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
  sku VARCHAR(64),
  product_name VARCHAR(255) NOT NULL,
  variant_title VARCHAR(255),
  quantity INT NOT NULL,
  fulfillable_quantity INT DEFAULT 0,
  fulfilled_quantity INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT line_items_order_id_shopify_line_item_id_unique UNIQUE (order_id, shopify_line_item_id)
  , last_updated_source TEXT NOT NULL DEFAULT 'console'
  , last_updated_by UUID
);

CREATE TABLE order_vendor_segments (
  order_id INT REFERENCES orders(id) ON DELETE CASCADE,
  vendor_id INT REFERENCES vendors(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (order_id, vendor_id)
);

CREATE TABLE vendor_order_notifications (
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
  sync_pending_until TIMESTAMPTZ,
  last_updated_source TEXT NOT NULL DEFAULT 'console',
  last_updated_by UUID
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

CREATE TABLE shipment_import_jobs (
  id BIGSERIAL PRIMARY KEY,
  vendor_id INT REFERENCES vendors(id),
  tracking_number VARCHAR(200) NOT NULL,
  carrier VARCHAR(100) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  total_count INT NOT NULL DEFAULT 0,
  processed_count INT NOT NULL DEFAULT 0,
  error_count INT NOT NULL DEFAULT 0,
  last_error TEXT,
  attempts INT NOT NULL DEFAULT 0,
  locked_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE shipment_import_job_items (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT REFERENCES shipment_import_jobs(id) ON DELETE CASCADE,
  vendor_id INT REFERENCES vendors(id),
  order_id INT REFERENCES orders(id) ON DELETE SET NULL,
  line_item_id INT REFERENCES line_items(id) ON DELETE SET NULL,
  quantity INT NOT NULL DEFAULT 1,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  error_message TEXT,
  attempts INT NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE shipment_adjustment_requests (
  id SERIAL PRIMARY KEY,
  vendor_id INT REFERENCES vendors(id) ON DELETE CASCADE,
  order_id INT REFERENCES orders(id) ON DELETE SET NULL,
  order_number VARCHAR(64) NOT NULL,
  shopify_order_id BIGINT,
  tracking_number VARCHAR(120),
  issue_type VARCHAR(50) NOT NULL,
  issue_summary TEXT NOT NULL,
  desired_change TEXT NOT NULL,
  line_item_context TEXT,
  contact_name VARCHAR(255),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(100),
  submitted_by UUID,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  assigned_admin_id UUID,
  assigned_admin_email VARCHAR(255),
  resolution_summary TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE shipment_adjustment_comments (
  id SERIAL PRIMARY KEY,
  request_id INT REFERENCES shipment_adjustment_requests(id) ON DELETE CASCADE,
  vendor_id INT REFERENCES vendors(id) ON DELETE CASCADE,
  author_id UUID,
  author_name VARCHAR(255),
  author_role VARCHAR(32) NOT NULL DEFAULT 'admin',
  visibility VARCHAR(32) NOT NULL DEFAULT 'vendor',
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
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
CREATE INDEX idx_order_vendor_segments_vendor_id ON order_vendor_segments(vendor_id);
CREATE INDEX idx_shipments_tracking_number ON shipments(tracking_number);
CREATE INDEX idx_vendor_skus_vendor_id ON vendor_skus(vendor_id);
CREATE INDEX idx_vendor_applications_status ON vendor_applications(status);
CREATE INDEX idx_vendor_applications_vendor_code ON vendor_applications(vendor_code);
CREATE INDEX idx_shipments_vendor_id ON shipments(vendor_id);
CREATE INDEX idx_shipment_line_items_line_item_id ON shipment_line_items(line_item_id);
CREATE INDEX idx_shipment_import_jobs_vendor_id ON shipment_import_jobs(vendor_id);
CREATE INDEX idx_shipment_import_jobs_status ON shipment_import_jobs(status);
CREATE INDEX idx_shipment_import_jobs_created_at ON shipment_import_jobs(created_at);
CREATE INDEX idx_shipment_import_job_items_job_id ON shipment_import_job_items(job_id);
CREATE INDEX idx_shipment_import_job_items_vendor_id ON shipment_import_job_items(vendor_id);
CREATE INDEX idx_shipment_import_job_items_status ON shipment_import_job_items(status);
CREATE INDEX idx_orders_shop_domain ON orders(shop_domain);
CREATE INDEX idx_orders_shopify_fo_id ON orders(shopify_fulfillment_order_id);
CREATE INDEX idx_line_items_fo_line_item_id ON line_items(fulfillment_order_line_item_id);
CREATE INDEX idx_shipments_order_id ON shipments(order_id);
CREATE INDEX idx_shipments_shopify_fulfillment_id ON shipments(shopify_fulfillment_id);
CREATE INDEX idx_shipments_sync_status ON shipments(sync_status);
CREATE INDEX idx_shipment_line_items_fo_line_item_id ON shipment_line_items(fulfillment_order_line_item_id);
CREATE INDEX idx_shipment_adjustment_requests_vendor_id ON shipment_adjustment_requests(vendor_id);
CREATE INDEX idx_shipment_adjustment_requests_status ON shipment_adjustment_requests(status);
CREATE INDEX idx_shipment_adjustment_requests_assigned_admin_id ON shipment_adjustment_requests(assigned_admin_id);
CREATE INDEX idx_shipment_adjustment_comments_request_id ON shipment_adjustment_comments(request_id);
CREATE INDEX idx_shipment_adjustment_comments_vendor_id ON shipment_adjustment_comments(vendor_id);

-- RLS / Realtime settings
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_import_job_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_vendor_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_adjustment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_adjustment_comments ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "OrdersAdminWrite" ON orders;
CREATE POLICY "OrdersAdminWrite" ON orders
  FOR ALL USING (
    LOWER(COALESCE(NULLIF(auth.jwt()->>'role', ''), '')) = 'admin'
  )
  WITH CHECK (
    LOWER(COALESCE(NULLIF(auth.jwt()->>'role', ''), '')) = 'admin'
  );

DROP POLICY IF EXISTS "LineItemsReadable" ON line_items;
CREATE POLICY "LineItemsReadable" ON line_items
  FOR SELECT USING (
    LOWER(COALESCE(NULLIF(auth.jwt()->>'role', ''), '')) = 'admin'
    OR vendor_id = COALESCE(NULLIF(auth.jwt()->>'vendor_id', '')::INT, -1)
  );

DROP POLICY IF EXISTS "ShipmentsReadable" ON shipments;
CREATE POLICY "ShipmentsReadable" ON shipments
  FOR SELECT USING (
    LOWER(COALESCE(NULLIF(auth.jwt()->>'role', ''), '')) = 'admin'
    OR vendor_id = COALESCE(NULLIF(auth.jwt()->>'vendor_id', '')::INT, -1)
  );

DROP POLICY IF EXISTS "OrderVendorSegmentsReadable" ON order_vendor_segments;
CREATE POLICY "OrderVendorSegmentsReadable" ON order_vendor_segments
  FOR SELECT USING (
    LOWER(COALESCE(NULLIF(auth.jwt()->>'role', ''), '')) = 'admin'
    OR vendor_id = COALESCE(NULLIF(auth.jwt()->>'vendor_id', '')::INT, -1)
  );

DROP POLICY IF EXISTS "ShipmentAdjustmentRequestsVendorReadable" ON shipment_adjustment_requests;
CREATE POLICY "ShipmentAdjustmentRequestsVendorReadable" ON shipment_adjustment_requests
  FOR SELECT USING (
    LOWER(COALESCE(NULLIF(auth.jwt()->>'role', ''), '')) = 'admin'
    OR vendor_id = COALESCE(NULLIF(auth.jwt()->>'vendor_id', '')::INT, -1)
  );

DROP POLICY IF EXISTS "ShipmentAdjustmentRequestsVendorInsert" ON shipment_adjustment_requests;
CREATE POLICY "ShipmentAdjustmentRequestsVendorInsert" ON shipment_adjustment_requests
  FOR INSERT WITH CHECK (
    vendor_id = COALESCE(NULLIF(auth.jwt()->>'vendor_id', '')::INT, -1)
  );

DROP POLICY IF EXISTS "ShipmentAdjustmentRequestsAdminAll" ON shipment_adjustment_requests;
CREATE POLICY "ShipmentAdjustmentRequestsAdminAll" ON shipment_adjustment_requests
  FOR ALL USING (
    LOWER(COALESCE(NULLIF(auth.jwt()->>'role', ''), '')) = 'admin'
  )
  WITH CHECK (
    LOWER(COALESCE(NULLIF(auth.jwt()->>'role', ''), '')) = 'admin'
  );

DROP POLICY IF EXISTS "ShipmentAdjustmentCommentsAdminAll" ON shipment_adjustment_comments;
CREATE POLICY "ShipmentAdjustmentCommentsAdminAll" ON shipment_adjustment_comments
  FOR ALL USING (
    LOWER(COALESCE(NULLIF(auth.jwt()->>'role', ''), '')) = 'admin'
  )
  WITH CHECK (
    LOWER(COALESCE(NULLIF(auth.jwt()->>'role', ''), '')) = 'admin'
  );

DROP POLICY IF EXISTS "ShipmentAdjustmentCommentsVendorReadable" ON shipment_adjustment_comments;
CREATE POLICY "ShipmentAdjustmentCommentsVendorReadable" ON shipment_adjustment_comments
  FOR SELECT USING (
    vendor_id = COALESCE(NULLIF(auth.jwt()->>'vendor_id', '')::INT, -1)
    AND LOWER(COALESCE(NULLIF(visibility, ''), 'vendor')) <> 'internal'
  );

DROP POLICY IF EXISTS "ShipmentImportJobsVendorReadable" ON shipment_import_jobs;
CREATE POLICY "ShipmentImportJobsVendorReadable" ON shipment_import_jobs
  FOR SELECT USING (
    LOWER(COALESCE(NULLIF(auth.jwt()->>'role', ''), '')) = 'admin'
    OR vendor_id = COALESCE(NULLIF(auth.jwt()->>'vendor_id', '')::INT, -1)
  );

DROP POLICY IF EXISTS "ShipmentImportJobsVendorModify" ON shipment_import_jobs;
CREATE POLICY "ShipmentImportJobsVendorModify" ON shipment_import_jobs
  FOR INSERT WITH CHECK (
    vendor_id = COALESCE(NULLIF(auth.jwt()->>'vendor_id', '')::INT, -1)
  );

DROP POLICY IF EXISTS "ShipmentImportJobsAdminAll" ON shipment_import_jobs;
CREATE POLICY "ShipmentImportJobsAdminAll" ON shipment_import_jobs
  FOR ALL USING (
    LOWER(COALESCE(NULLIF(auth.jwt()->>'role', ''), '')) = 'admin'
  )
  WITH CHECK (
    LOWER(COALESCE(NULLIF(auth.jwt()->>'role', ''), '')) = 'admin'
  );

DROP POLICY IF EXISTS "ShipmentImportJobItemsVendorReadable" ON shipment_import_job_items;
CREATE POLICY "ShipmentImportJobItemsVendorReadable" ON shipment_import_job_items
  FOR SELECT USING (
    LOWER(COALESCE(NULLIF(auth.jwt()->>'role', ''), '')) = 'admin'
    OR vendor_id = COALESCE(NULLIF(auth.jwt()->>'vendor_id', '')::INT, -1)
  );

DROP POLICY IF EXISTS "ShipmentImportJobItemsAdminAll" ON shipment_import_job_items;
CREATE POLICY "ShipmentImportJobItemsAdminAll" ON shipment_import_job_items
  FOR ALL USING (
    LOWER(COALESCE(NULLIF(auth.jwt()->>'role', ''), '')) = 'admin'
  )
  WITH CHECK (
    LOWER(COALESCE(NULLIF(auth.jwt()->>'role', ''), '')) = 'admin'
  );

ALTER TABLE orders REPLICA IDENTITY FULL;
ALTER TABLE line_items REPLICA IDENTITY FULL;
ALTER TABLE shipments REPLICA IDENTITY FULL;
ALTER TABLE order_vendor_segments REPLICA IDENTITY FULL;
ALTER TABLE shipment_adjustment_requests REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END;
$$;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.line_items;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shipments;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_vendor_segments;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_order_vendor_segments()
RETURNS trigger AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF NEW.vendor_id IS NOT NULL THEN
      INSERT INTO order_vendor_segments (order_id, vendor_id)
      VALUES (NEW.order_id, NEW.vendor_id)
      ON CONFLICT (order_id, vendor_id)
      DO UPDATE SET updated_at = NOW();
    END IF;
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    IF (TG_OP = 'DELETE' AND OLD.vendor_id IS NOT NULL)
       OR (TG_OP = 'UPDATE' AND OLD.vendor_id IS NOT NULL AND OLD.vendor_id <> NEW.vendor_id) THEN
      DELETE FROM order_vendor_segments ovs
      WHERE ovs.order_id = OLD.order_id
        AND ovs.vendor_id = OLD.vendor_id
        AND NOT EXISTS (
          SELECT 1 FROM line_items li
          WHERE li.order_id = OLD.order_id
            AND li.vendor_id = OLD.vendor_id
        );
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_line_items_insert_vendor_segments
AFTER INSERT ON line_items
FOR EACH ROW EXECUTE FUNCTION public.maintain_order_vendor_segments();

CREATE TRIGGER trg_line_items_update_vendor_segments
AFTER UPDATE ON line_items
FOR EACH ROW EXECUTE FUNCTION public.maintain_order_vendor_segments();

CREATE TRIGGER trg_line_items_delete_vendor_segments
AFTER DELETE ON line_items
FOR EACH ROW EXECUTE FUNCTION public.maintain_order_vendor_segments();

CREATE OR REPLACE FUNCTION public.touch_order_vendor_segments()
RETURNS trigger AS $$
BEGIN
  UPDATE order_vendor_segments
  SET updated_at = NOW()
  WHERE order_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orders_update_vendor_segments
AFTER UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION public.touch_order_vendor_segments();

DROP TRIGGER IF EXISTS trg_orders_last_updated ON orders;
CREATE TRIGGER trg_orders_last_updated
BEFORE INSERT OR UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION public.ensure_last_updated_metadata();

DROP TRIGGER IF EXISTS trg_line_items_last_updated ON line_items;
CREATE TRIGGER trg_line_items_last_updated
BEFORE INSERT OR UPDATE ON line_items
FOR EACH ROW EXECUTE FUNCTION public.ensure_last_updated_metadata();

DROP TRIGGER IF EXISTS trg_shipments_last_updated ON shipments;
CREATE TRIGGER trg_shipments_last_updated
BEFORE INSERT OR UPDATE ON shipments
FOR EACH ROW EXECUTE FUNCTION public.ensure_last_updated_metadata();

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
    fulfilled_quantity,
    last_updated_source,
    last_updated_by
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
    COALESCE((item->>'fulfilled_quantity')::int, 0),
    COALESCE(NULLIF(item->>'last_updated_source', ''), 'console'),
    NULLIF(item->>'last_updated_by', '')::uuid
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
    fulfilled_quantity = EXCLUDED.fulfilled_quantity,
    last_updated_source = EXCLUDED.last_updated_source,
    last_updated_by = EXCLUDED.last_updated_by;

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
CREATE OR REPLACE FUNCTION public.ensure_last_updated_metadata()
RETURNS trigger AS $$
DECLARE
  claims jsonb;
  jwt_sub uuid;
BEGIN
  BEGIN
    claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    claims := '{}'::jsonb;
  END;

  jwt_sub := NULLIF(COALESCE(claims->>'sub', ''), '')::uuid;

  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.last_updated_source IS NULL THEN
      NEW.last_updated_source := 'console';
    END IF;
    IF NEW.last_updated_by IS NULL THEN
      NEW.last_updated_by := jwt_sub;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.claim_pending_shipment_import_jobs(job_limit integer DEFAULT 1)
RETURNS SETOF shipment_import_jobs
LANGUAGE plpgsql
AS $$
DECLARE
  limit_value integer;
BEGIN
  limit_value := GREATEST(1, LEAST(COALESCE(job_limit, 1), 10));

  RETURN QUERY
    WITH cte AS (
      SELECT id
      FROM shipment_import_jobs
      WHERE status = 'pending'
      ORDER BY created_at
      LIMIT limit_value
      FOR UPDATE SKIP LOCKED
    )
    UPDATE shipment_import_jobs
    SET status = 'running',
        locked_at = NOW(),
        attempts = attempts + 1,
        last_attempt_at = NOW(),
        updated_at = NOW()
    WHERE id IN (SELECT id FROM cte)
    RETURNING *;
END;
$$;
ALTER TABLE webhook_jobs
  ADD CONSTRAINT webhook_jobs_webhook_id_unique UNIQUE (webhook_id)
  DEFERRABLE INITIALLY DEFERRED;
