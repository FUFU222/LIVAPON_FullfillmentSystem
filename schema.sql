-- =========================================
-- schema.sql : Shopify配送管理アプリ (MVP)
-- =========================================

-- ベンダー（メーカー）情報
CREATE TABLE vendors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  contact_email VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
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

-- 注文ごとの商品ライン
CREATE TABLE line_items (
  id SERIAL PRIMARY KEY,
  order_id INT REFERENCES orders(id) ON DELETE CASCADE,
  shopify_line_item_id BIGINT NOT NULL, -- Shopify側のLine Item ID
  product_name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL,
  fulfilled_quantity INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 配送情報（1つのline_itemに複数shipmentが紐づけ可能）
CREATE TABLE shipments (
  id SERIAL PRIMARY KEY,
  line_item_id INT REFERENCES line_items(id) ON DELETE CASCADE,
  tracking_number VARCHAR(100),
  carrier VARCHAR(100), -- yamato / sagawa / dhl / fedex など
  status VARCHAR(50) DEFAULT 'in_transit', -- in_transit / delivered / returned など
  shipped_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
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
CREATE INDEX idx_shipments_line_item_id ON shipments(line_item_id);
CREATE INDEX idx_shipments_tracking_number ON shipments(tracking_number);
