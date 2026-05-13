-- 納品書(packing slip)機能の続編:
-- 新規セラー登録フローの上流(エントリー申請)で発送元住所を必須化するため、
-- vendor_applications にも住所カラムを追加する。承認時に vendors へコピーされる。
--
-- NULL 許容で追加(既存 pending 申請は null のまま許容)。新規申請はフォーム側で必須。

alter table public.vendor_applications
  add column if not exists postal varchar(20),
  add column if not exists prefecture varchar(100),
  add column if not exists city varchar(255),
  add column if not exists address1 varchar(255),
  add column if not exists address2 varchar(255);

comment on column public.vendor_applications.postal      is '発送元郵便番号(承認時に vendors.postal にコピー)';
comment on column public.vendor_applications.prefecture  is '発送元都道府県';
comment on column public.vendor_applications.city        is '発送元市区町村';
comment on column public.vendor_applications.address1    is '発送元番地等';
comment on column public.vendor_applications.address2    is '発送元建物名・部屋番号等';
