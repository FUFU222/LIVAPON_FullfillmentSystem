alter table public.shipments
  add column if not exists registration_request_id uuid,
  add column if not exists registration_payload_hash text;

create unique index if not exists idx_shipments_vendor_request_order_unique
on public.shipments(vendor_id, registration_request_id, order_id)
where registration_request_id is not null;

create table if not exists public.shipment_sync_events (
  id bigserial primary key,
  shipment_id int references public.shipments(id) on delete set null,
  order_id int references public.orders(id) on delete set null,
  vendor_id int references public.vendors(id) on delete set null,
  actor_type text not null default 'system',
  actor_user_id uuid,
  event_type text not null,
  status_from text,
  status_to text,
  request_id uuid,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_shipment_sync_events_shipment_id_created_at
on public.shipment_sync_events(shipment_id, created_at desc);

create index if not exists idx_shipment_sync_events_vendor_id_created_at
on public.shipment_sync_events(vendor_id, created_at desc);

create index if not exists idx_shipment_sync_events_event_type_created_at
on public.shipment_sync_events(event_type, created_at desc);

alter table public.shipment_sync_events enable row level security;
