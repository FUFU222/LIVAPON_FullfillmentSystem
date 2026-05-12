-- 納品書(packing slip)機能のため、セラーの倉庫住所カラムを追加
-- 既存セラーは値が NULL のまま。納品書側で「住所未登録」 fallback を表示する。

alter table public.vendors
  add column if not exists postal varchar(20),
  add column if not exists prefecture varchar(100),
  add column if not exists city varchar(255),
  add column if not exists address1 varchar(255),
  add column if not exists address2 varchar(255);

comment on column public.vendors.postal      is '発送元郵便番号(例: 107-0062)';
comment on column public.vendors.prefecture  is '発送元都道府県';
comment on column public.vendors.city        is '発送元市区町村';
comment on column public.vendors.address1    is '発送元番地等';
comment on column public.vendors.address2    is '発送元建物名・部屋番号等';
