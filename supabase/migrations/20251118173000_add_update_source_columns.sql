-- Add metadata columns for tracking who/what updated rows
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS last_updated_source text NOT NULL DEFAULT 'console',
  ADD COLUMN IF NOT EXISTS last_updated_by uuid;

ALTER TABLE public.line_items
  ADD COLUMN IF NOT EXISTS last_updated_source text NOT NULL DEFAULT 'console',
  ADD COLUMN IF NOT EXISTS last_updated_by uuid;

ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS last_updated_source text NOT NULL DEFAULT 'console',
  ADD COLUMN IF NOT EXISTS last_updated_by uuid;

UPDATE public.orders SET last_updated_source = COALESCE(last_updated_source, 'console');
UPDATE public.line_items SET last_updated_source = COALESCE(last_updated_source, 'console');
UPDATE public.shipments SET last_updated_source = COALESCE(last_updated_source, 'console');

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

DROP TRIGGER IF EXISTS trg_orders_last_updated ON public.orders;
CREATE TRIGGER trg_orders_last_updated
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.ensure_last_updated_metadata();

DROP TRIGGER IF EXISTS trg_line_items_last_updated ON public.line_items;
CREATE TRIGGER trg_line_items_last_updated
BEFORE INSERT OR UPDATE ON public.line_items
FOR EACH ROW EXECUTE FUNCTION public.ensure_last_updated_metadata();

DROP TRIGGER IF EXISTS trg_shipments_last_updated ON public.shipments;
CREATE TRIGGER trg_shipments_last_updated
BEFORE INSERT OR UPDATE ON public.shipments
FOR EACH ROW EXECUTE FUNCTION public.ensure_last_updated_metadata();
