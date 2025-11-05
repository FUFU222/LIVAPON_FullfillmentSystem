-- Adds tables to capture Shopify Fulfillment Service callback requests and line item breakdowns
CREATE TABLE IF NOT EXISTS fulfillment_requests (
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

CREATE TABLE IF NOT EXISTS fulfillment_request_line_items (
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

CREATE INDEX IF NOT EXISTS idx_fulfillment_requests_shop_domain ON fulfillment_requests(shop_domain);
CREATE INDEX IF NOT EXISTS idx_fulfillment_requests_vendor_id ON fulfillment_requests(vendor_id);
CREATE INDEX IF NOT EXISTS idx_fulfillment_request_line_items_request_id ON fulfillment_request_line_items(fulfillment_request_id);
CREATE INDEX IF NOT EXISTS idx_fulfillment_request_line_items_line_item_id ON fulfillment_request_line_items(line_item_id);
