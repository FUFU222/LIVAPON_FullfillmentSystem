-- Phase 1 integrity and timestamp normalization:
-- 1. Codify the already-rolled-out composite indexes in migrations.
-- 2. Prevent duplicate pending vendor applications at the database layer.
-- 3. Normalize primary mutable business timestamps to timestamptz.

create index if not exists idx_orders_vendor_id_order_number
on public.orders (vendor_id, order_number);

create index if not exists idx_shipments_vendor_id_shipped_at_created_at
on public.shipments (vendor_id, shipped_at desc, created_at desc);

create index if not exists idx_shipments_sync_status_pending_until
on public.shipments (sync_status, sync_pending_until);

create index if not exists idx_shipment_adjustment_requests_vendor_id_created_at
on public.shipment_adjustment_requests (vendor_id, created_at desc);

create index if not exists idx_shipment_adjustment_requests_status_created_at
on public.shipment_adjustment_requests (status, created_at desc);

create index if not exists idx_shipment_import_job_items_job_id_status_id
on public.shipment_import_job_items (job_id, status, id);

create index if not exists idx_line_items_order_id_vendor_id
on public.line_items (order_id, vendor_id);

create unique index if not exists idx_vendor_applications_pending_email_unique
on public.vendor_applications ((lower(contact_email)))
where status = 'pending';

alter table public.vendor_applications
  alter column reviewed_at type timestamptz using reviewed_at at time zone 'UTC',
  alter column created_at type timestamptz using created_at at time zone 'UTC',
  alter column updated_at type timestamptz using updated_at at time zone 'UTC',
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.orders
  alter column created_at type timestamptz using created_at at time zone 'UTC',
  alter column updated_at type timestamptz using updated_at at time zone 'UTC',
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.shipments
  alter column shipped_at type timestamptz using shipped_at at time zone 'UTC',
  alter column created_at type timestamptz using created_at at time zone 'UTC',
  alter column updated_at type timestamptz using updated_at at time zone 'UTC',
  alter column shipped_at set default now(),
  alter column created_at set default now(),
  alter column updated_at set default now();
