create table if not exists shipment_cancellation_logs (
  id bigserial primary key,
  shipment_id int references shipments(id) on delete set null,
  order_id int references orders(id) on delete set null,
  vendor_id int references vendors(id) on delete set null,
  reason_type text not null,
  reason_detail text,
  created_at timestamptz default now()
);

create index if not exists idx_shipment_cancellation_logs_vendor_id on shipment_cancellation_logs(vendor_id);
create index if not exists idx_shipment_cancellation_logs_order_id on shipment_cancellation_logs(order_id);
