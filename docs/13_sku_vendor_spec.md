# SKU / セラーコード仕様

## セラーコード
- 4 桁ゼロ埋め（例: `0001`）。`vendors.code` に保存しユニーク制約。
- `approveVendorApplication` 実行時に `generateNextVendorCode` が最大値+1 を採番。欠番は許容だが再利用しない。
- Supabase Auth ユーザーの `app_metadata.vendor_id` / `app_metadata.role` をアプリ側と RLS の信頼元にする。`user_metadata` は pending_vendor 移行互換以外では権限判定に使わない。

## セラー情報
- `vendors` テーブル: `name`, `contact_name`, `contact_email`, `code`。拡張フィールドは `vendor_profile` テーブル追加で対応予定。
- `vendors.notify_new_orders` と通知先メール設定で、新規注文メール通知の ON/OFF と送信先を制御する。
- 管理者 UI (`VendorBulkDeleteForm`) では `lastApplication` 情報を付与し、承認ステータスを Badge 表示。

## SKU 設計
- 形式: `CCCC-NNN-VV`
  - `CCCC`: セラーコード。
  - `NNN`: セラー内部プロダクト番号（0 埋め）。
  - `VV`: バリエーション番号。
- `vendor_skus` に SKU を登録。`attributes` JSONB で色・サイズ等を保持。
- Shopify 連携時は、優先順でセラーを解決:
  1. `vendor_skus` で SKU 一致。
  2. SKU 先頭 4 桁と `vendors.code`。
  3. Shopify `line_item.vendor` 名の部分一致。

## 注文・ラインアイテム
- `orders`:
  - Shopify ID、FO ID、配送先（郵便番号・都道府県・市区町村・住所1/2）。
  - `status` は Shopify の `fulfillment_status` をベースに `unfulfilled` / `partially_fulfilled` / `fulfilled`。
- `line_items`:
  - Shopify `line_item_id`、SKU、数量、`fulfillable_quantity`、`fulfilled_quantity`。
  - FO ID (`fulfillment_order_line_item_id`) と数量を同期し、部分発送に対応。

## 発送レコード
- `shipments` + `shipment_line_items`:
  - `shipments` が追跡情報・キャリア・同期状態を持つ。
  - `shipment_line_items` がラインアイテムとの紐付け。数量指定で部分発送を実現。
  - `sync_status`: `pending` / `processing` / `synced` / `error` / `manual_resolved`。`sync_pending_until` と `sync_retry_count` でバックオフ。
  - `registration_request_id` と `registration_payload_hash` でブラウザ再送・二重クリック時の冪等性を守る。
  - `shipment_sync_events` に `registered`, `sync_started`, `sync_succeeded`, `sync_failed`, `resync_requested`, `manual_resolved`, `shopify_fulfillment_linked` を append-only で残す。

## 運用ルール
- SKU は一度登録したら意味を変えない。変更が必要な場合は新 SKU を採番。
- セラー削除時は `ON DELETE CASCADE` により `vendor_skus` / `line_items` / `shipments` が自動削除されるため、過去レポートには注意。
- セラーコードと SKU プレフィックスに矛盾がある場合、Shopify 連携ログに WARN を記録し手動修正する。

## 今後の追加仕様
- `vendor_skus` に GTIN / JAN 等の識別子を追加予定。
- `line_items` に `vendor_assignment_status` を追加し、未割当 SKU を UI で可視化する。
- `vendor_profile` 拡張により会社住所・電話番号・請求先などの管理を検討。
