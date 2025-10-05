-- Seed data for local/remote resets
-- テスト用ベンダーとインポートログのダミーデータ

-- 同じファイル名のログがあれば消しておく
DELETE FROM public.import_logs
WHERE file_name = 'logs/vendors/9000/import_2025-10-05.csv';

-- ベンダーコード 9000 のテストベンダーを登録（既にあれば情報更新）
INSERT INTO public.vendors (code, name, contact_email)
VALUES ('9000', 'テストベンダー', 'test-vendor@example.com')
ON CONFLICT (code)
  DO UPDATE SET
    name = EXCLUDED.name,
    contact_email = EXCLUDED.contact_email;

-- 作成したベンダーの ID を使って import_logs にテストレコードを書き込む
INSERT INTO public.import_logs (vendor_id, file_name, status, created_at)
SELECT id,
       'logs/vendors/9000/import_2025-10-05.csv' AS file_name,
       'pending' AS status,
       NOW() AS created_at
FROM public.vendors
WHERE code = '9000';
