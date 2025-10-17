alter table public.orders
  add column if not exists shopify_fulfillment_order_id bigint,
  add column if not exists shop_domain text;

alter table public.line_items
  add column if not exists fulfillment_order_line_item_id bigint,
  add column if not exists fulfillable_quantity integer default 0;

alter table public.shipments
  add column if not exists order_id integer references public.orders(id) on delete cascade,
  add column if not exists tracking_company varchar(100),
  add column if not exists tracking_url text,
  add column if not exists shopify_fulfillment_id bigint,
  add column if not exists updated_at timestamp default now(),
  add column if not exists sync_status varchar(32) default 'pending',
  add column if not exists synced_at timestamptz,
  add column if not exists sync_error text;

alter table public.shipment_line_items
  add column if not exists fulfillment_order_line_item_id bigint;

create index if not exists idx_orders_shop_domain on public.orders(shop_domain);
create index if not exists idx_orders_shopify_fo_id on public.orders(shopify_fulfillment_order_id);
create index if not exists idx_line_items_fo_line_item_id on public.line_items(fulfillment_order_line_item_id);
create index if not exists idx_shipments_order_id on public.shipments(order_id);
create index if not exists idx_shipments_shopify_fulfillment_id on public.shipments(shopify_fulfillment_id);
create index if not exists idx_shipments_sync_status on public.shipments(sync_status);
create index if not exists idx_shipment_line_items_fo_line_item_id on public.shipment_line_items(fulfillment_order_line_item_id);

update public.shipments set sync_status = 'pending' where sync_status is null;
update public.shipments set updated_at = coalesce(updated_at, now());
