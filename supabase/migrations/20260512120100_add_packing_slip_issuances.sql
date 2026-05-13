-- 納品書(packing slip)の発行履歴テーブル
-- 1 行 = 1 回の発行(誰が・いつ・どの注文の納品書を出したか)
-- 同一注文で複数セラー混在の場合は vendor_id で分離して記録できる
-- admin が出したものは vendor_id = NULL とする

create table if not exists public.packing_slip_issuances (
  id          bigserial primary key,
  order_id    int not null references public.orders(id) on delete cascade,
  vendor_id   int references public.vendors(id) on delete set null,
  issued_by   uuid not null,
  issued_at   timestamptz not null default now()
);

comment on table  public.packing_slip_issuances             is '納品書発行履歴(視覚化と監査ログ兼用)';
comment on column public.packing_slip_issuances.order_id    is '発行対象の注文';
comment on column public.packing_slip_issuances.vendor_id   is 'セラー視点で発行した場合の vendor_id (admin発行は NULL)';
comment on column public.packing_slip_issuances.issued_by   is '発行操作を行った auth.users.id';
comment on column public.packing_slip_issuances.issued_at   is '発行日時';

create index if not exists idx_packing_slip_issuances_order_id
  on public.packing_slip_issuances(order_id);

create index if not exists idx_packing_slip_issuances_vendor_id
  on public.packing_slip_issuances(vendor_id);

create index if not exists idx_packing_slip_issuances_order_vendor
  on public.packing_slip_issuances(order_id, vendor_id);

-- RLS
alter table public.packing_slip_issuances enable row level security;

-- admin: 全件 SELECT/INSERT
drop policy if exists "PackingSlipIssuancesAdminAll" on public.packing_slip_issuances;
create policy "PackingSlipIssuancesAdminAll" on public.packing_slip_issuances
  for all using (
    public.requesting_is_admin()
  )
  with check (
    public.requesting_is_admin()
  );

-- vendor: 自分の vendor_id の行のみ SELECT
drop policy if exists "PackingSlipIssuancesVendorReadable" on public.packing_slip_issuances;
create policy "PackingSlipIssuancesVendorReadable" on public.packing_slip_issuances
  for select using (
    vendor_id = public.requesting_vendor_id()
  );

-- vendor: 自分の vendor_id の行のみ INSERT 可能
drop policy if exists "PackingSlipIssuancesVendorInsert" on public.packing_slip_issuances;
create policy "PackingSlipIssuancesVendorInsert" on public.packing_slip_issuances
  for insert with check (
    vendor_id = public.requesting_vendor_id()
  );
