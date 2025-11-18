-- Create mapping table for vendor-specific realtime events
CREATE TABLE IF NOT EXISTS public.order_vendor_segments (
  order_id INT REFERENCES public.orders(id) ON DELETE CASCADE,
  vendor_id INT REFERENCES public.vendors(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (order_id, vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_order_vendor_segments_vendor_id
  ON public.order_vendor_segments(vendor_id);

ALTER TABLE public.order_vendor_segments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "OrderVendorSegmentsReadable" ON public.order_vendor_segments;
CREATE POLICY "OrderVendorSegmentsReadable" ON public.order_vendor_segments
  FOR SELECT USING (
    LOWER(COALESCE(NULLIF(auth.jwt()->>'role', ''), '')) = 'admin'
    OR vendor_id = COALESCE(NULLIF(auth.jwt()->>'vendor_id', '')::INT, -1)
  );

ALTER TABLE public.order_vendor_segments REPLICA IDENTITY FULL;

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

DROP TRIGGER IF EXISTS trg_line_items_insert_vendor_segments ON public.line_items;
DROP TRIGGER IF EXISTS trg_line_items_update_vendor_segments ON public.line_items;
DROP TRIGGER IF EXISTS trg_line_items_delete_vendor_segments ON public.line_items;

CREATE TRIGGER trg_line_items_insert_vendor_segments
AFTER INSERT ON public.line_items
FOR EACH ROW EXECUTE FUNCTION public.maintain_order_vendor_segments();

CREATE TRIGGER trg_line_items_update_vendor_segments
AFTER UPDATE ON public.line_items
FOR EACH ROW EXECUTE FUNCTION public.maintain_order_vendor_segments();

CREATE TRIGGER trg_line_items_delete_vendor_segments
AFTER DELETE ON public.line_items
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

DROP TRIGGER IF EXISTS trg_orders_update_vendor_segments ON public.orders;
CREATE TRIGGER trg_orders_update_vendor_segments
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.touch_order_vendor_segments();

-- Backfill existing data
INSERT INTO order_vendor_segments (order_id, vendor_id)
SELECT DISTINCT order_id, vendor_id
FROM line_items
WHERE vendor_id IS NOT NULL
ON CONFLICT (order_id, vendor_id) DO NOTHING;
