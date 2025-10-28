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
  vendor_id INT REFERENCES vendors(id),
  order_number VARCHAR(50) NOT NULL, -- Shopifyの注文番号 (#1001 等)
  customer_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'unfulfilled', -- Fulfilled / Partially Fulfilled / Unfulfilled
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
  sku VARCHAR(16),
  product_name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL,
  fulfilled_quantity INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE shipments (
  id SERIAL PRIMARY KEY,
  vendor_id INT REFERENCES vendors(id),
  tracking_number VARCHAR(100),
  carrier VARCHAR(100),
  status VARCHAR(50) DEFAULT 'in_transit',
  shipped_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE shipment_line_items (
  shipment_id INT REFERENCES shipments(id) ON DELETE CASCADE,
  line_item_id INT REFERENCES line_items(id) ON DELETE CASCADE,
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
