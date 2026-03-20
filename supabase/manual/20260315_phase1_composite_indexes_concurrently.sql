-- Phase 1 composite index rollout for production-like Supabase environments.
-- Run each statement directly in the Supabase SQL editor or psql.
-- Do not wrap this file in an explicit transaction because CREATE INDEX CONCURRENTLY is not allowed there.

set lock_timeout = '5s';
set statement_timeout = '0';

create index concurrently if not exists idx_orders_vendor_id_order_number
on public.orders (vendor_id, order_number);

create index concurrently if not exists idx_shipments_vendor_id_shipped_at_created_at
on public.shipments (vendor_id, shipped_at desc, created_at desc);

create index concurrently if not exists idx_shipments_sync_status_pending_until
on public.shipments (sync_status, sync_pending_until);

create index concurrently if not exists idx_shipment_adjustment_requests_vendor_id_created_at
on public.shipment_adjustment_requests (vendor_id, created_at desc);

create index concurrently if not exists idx_shipment_adjustment_requests_status_created_at
on public.shipment_adjustment_requests (status, created_at desc);

create index concurrently if not exists idx_shipment_import_job_items_job_id_status_id
on public.shipment_import_job_items (job_id, status, id);

create index concurrently if not exists idx_line_items_order_id_vendor_id
on public.line_items (order_id, vendor_id);

analyze public.orders;
analyze public.shipments;
analyze public.shipment_adjustment_requests;
analyze public.shipment_import_job_items;
analyze public.line_items;
