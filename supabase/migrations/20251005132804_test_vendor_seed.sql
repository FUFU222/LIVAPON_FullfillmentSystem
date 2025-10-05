-- テストベンダーとダミー import_logs レコードの投入

-- 同じファイル名のレコードがあれば削除してから挿入
DELETE FROM public.import_logs
WHERE file_name = 'logs/vendors/9000/import_2025-10-05.csv';

-- ベンダーコード 9000 が存在しない場合は作成、存在する場合は情報更新
INSERT INTO public.vendors (code, name, contact_email)
VALUES ('9000', 'テストベンダー', 'test-vendor@example.com')
ON CONFLICT (code)
  DO UPDATE SET
    name = EXCLUDED.name,
    contact_email = EXCLUDED.contact_email;

-- 該当ベンダー ID を参照して import_logs にテスト用行を追加
INSERT INTO public.import_logs (vendor_id, file_name, status, created_at)
SELECT id,
       'logs/vendors/9000/import_2025-10-05.csv' AS file_name,
       'pending' AS status,
       NOW() AS created_at
FROM public.vendors
WHERE code = '9000';
