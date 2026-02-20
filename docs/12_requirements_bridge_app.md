# Shopify ブリッジ App 要件補足

## 目的
- Supabase に保存された配送情報と Shopify の Fulfillment 状態を双方向で同期させる仲介役。
- Shopify で発生した注文・Fulfillment Order（FO）イベントを受け取り、セラー UI での処理結果を Shopify へ確実に反映する。

## 実装済みの役割（2025-11-02）
- **OAuth**: `/api/shopify/auth/start|callback` がオンラインストア単位でアクセストークンを取得し `shopify_connections` に保存。
- **Webhook**:
  - `orders/create`, `orders/updated` → `upsertShopifyOrder` が `orders` / `line_items` / `vendor_skus` を整合。
  - `fulfillment_orders/order_routing_complete`, `fulfillment_orders/hold_released` → `triggerShipmentResyncForShopifyOrder` が保留中 Shipment の再同期を実行。
- **Fulfillment Order Callback (任意)**: `/api/shopify/fulfillment/callback` は Shopify が返す FO 依頼情報を記録する補助ルート。OM モデルでは在庫・割当は Shopify 管理ロケーションで完結するため、PULL 処理の補助として利用する。
- **Bulk Shipment API**: `/api/shopify/orders/shipments` がセラーの一括発送登録を受け付け、Supabase サーバーアクションと同等の検証を実施。
- **Fulfillment 同期**: `syncShipmentWithShopify` が FO 情報を自動取得し、REST Admin API で Fulfillment 作成/追跡更新。未生成 FO は指数バックオフでリトライ予定時刻を保存。

## データフロー概要
> **在庫管理ポリシー**: 在庫は Shopify GUI（マーチャント管理ロケーション）が唯一の真実の源。Console は在庫値を編集せず、閲覧・警告に徹する。

1. Shopify → Supabase
   - Webhook が HMAC 署名検証を通過（`SHOPIFY_WEBHOOK_SECRET` と `_APP` / `_STORE` の複数設定に対応）。
   - `order_id` / `line_item_id` / FO 情報を解析し、`vendor_id` 解決（`vendor_skus`・セラーコード・セラー名の優先順）。
   - 顧客名・配送先住所・ステータスを `orders` に保存、ラインアイテム詳細を `line_items` に保存。
2. Supabase → Shopify
   - セラー UI / CSV / API で `shipments` が作成されると `sync_status=pending`。
   - サービス層が FO を取得し Fulfillment API を呼び出し、成功した追跡番号を Shopify に反映。
   - `sync_status` は `pending` → `processing` → `synced` / `error`。
   - キャンセル時は `cancelShopifyFulfillment` を呼び出して Shopify 側の発送を取り消す。

## 運用ポイント
- **スコープ**: `write_merchant_managed_fulfillment_orders`, `read_orders`, `write_orders`, `read_fulfillments` を OAuth リクエストに含める。
- **ショップ登録**: テスト/本番のストアで OAuth を完了させ、Webhook を Admin で有効化する。未登録ドメインからの Webhook は 403 応答。
- **トークン更新**: Shopify がアクセストークン更新を要求した場合は再認可。`shopify_connections.updated_at` を監視し、古いトークンを検出したら再接続を案内。
- **レート制限**: REST Admin API の 40 calls/min を想定し、失敗時は指数バックオフですぐには再送しない。

## 未完了・今後の検討
- `sync_pending_until` 到来時に自動で `syncShipmentWithShopify` を再実行する Cron / Edge Function。
- Shopify で FO が生成されなかった注文への補助ロジック（GraphQL `fulfillmentOrderCreate` の採用検討）。
- 返品/再発送をトリガーする Webhook (`orders/cancelled`, `fulfillments/create`) の取り込み。
- Webhook 監査ログ（Supabase `webhook_logs` テーブル追加）と Slack 通知。
