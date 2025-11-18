-- Align Realtime tables with vendor-scoped RLS and Supabase publication

-- Ensure RLS is enabled for line_items and shipments
ALTER TABLE public.line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "LineItemsReadable" ON public.line_items;
CREATE POLICY "LineItemsReadable" ON public.line_items
  FOR SELECT
  USING (
    LOWER(COALESCE(NULLIF(auth.jwt()->>'role', ''), '')) = 'admin'
    OR vendor_id = COALESCE(NULLIF(auth.jwt()->>'vendor_id', '')::INT, -1)
  );

DROP POLICY IF EXISTS "ShipmentsReadable" ON public.shipments;
CREATE POLICY "ShipmentsReadable" ON public.shipments
  FOR SELECT
  USING (
    LOWER(COALESCE(NULLIF(auth.jwt()->>'role', ''), '')) = 'admin'
    OR vendor_id = COALESCE(NULLIF(auth.jwt()->>'vendor_id', '')::INT, -1)
  );

-- Realtime requires replica identity for UPDATE/DELETE payloads
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.line_items REPLICA IDENTITY FULL;
ALTER TABLE public.shipments REPLICA IDENTITY FULL;

-- Ensure the official supabase_realtime publication includes the key tables
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
END;
$$;

DROP PUBLICATION IF EXISTS livapon_realtime;
