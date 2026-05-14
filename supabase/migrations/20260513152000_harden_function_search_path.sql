-- Pin search_path for application-owned functions flagged by Supabase security advisors.
-- This prevents function execution from depending on caller-controlled search_path values.

ALTER FUNCTION public.requesting_app_role()
  SET search_path = public, auth, pg_temp;

ALTER FUNCTION public.requesting_vendor_id()
  SET search_path = public, auth, pg_temp;

ALTER FUNCTION public.requesting_is_admin()
  SET search_path = public, auth, pg_temp;

ALTER FUNCTION public.sync_order_line_items(integer, jsonb)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.claim_pending_webhook_jobs(integer)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.claim_pending_shipment_import_jobs(integer)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.ensure_last_updated_metadata()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.maintain_order_vendor_segments()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.touch_order_vendor_segments()
  SET search_path = public, pg_temp;
