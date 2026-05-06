# Fulfillment Sync Overview

最終更新: 2026-05-06

## ゴール
- Supabase で管理される Shipment を Shopify Fulfillment Order (FO) と同期し、追跡番号を確実に反映する。
- FO が未生成または一時的に取得できない場合でも、再試行・管理者対応・同期イベントで整合を保つ。

## アーキテクチャ
- **データストア**: Supabase (Postgres)。`shipments`, `shipment_line_items`, `orders`, `line_items`。
- **サービス層**: `lib/data/orders/*` が作成・再同期・同期イベント・管理者対応を担い、`lib/shopify/fulfillment.ts` が Shopify Admin API との通信を抽象化。
- **同期トリガー**:
  - 注文 Webhook (`orders/create`, `orders/updated`) で `upsertShopifyOrder` が注文保存 → `syncFulfillmentOrderMetadata` で FO を即時取得・保存（未生成なら pending）。
  - セラー UI / API で `registerShipmentsFromSelections` → `shipments` / `shipment_line_items` を即時作成し `sync_status = 'pending'`。API は `202` を返し、Shopify 同期はレスポンス後に処理する。
  - Shopify Webhook (`fulfillment_orders/*`) 受信時に `triggerShipmentResyncForShopifyOrder` が FO メタ同期＋保留 Shipment の再同期を行う。
  - GitHub Actions `resync-pending-shipments` が `/api/internal/shipments/resync` を定期実行し、`sync_pending_until` 到来分と stale `processing` を回収する。
  - バックフィルスクリプト `scripts/backfill-fulfillment-orders.ts` が定期的に NULL 行を再取得し、再試行ログを残す。
- **再試行**: FO 未生成エラー時は指数バックオフで待機。GitHub Actions worker / Webhook / 管理者再同期で再実行する。

## 関連テーブル
| テーブル | 主なカラム | 説明 |
| -------- | ---------- | ---- |
| `shipments` | `tracking_number`, `carrier`, `shopify_fulfillment_id`, `sync_status`, `sync_error`, `sync_pending_until` | Shopify との同期状態・メタ情報。|
| `shipment_line_items` | `line_item_id`, `quantity`, `fulfillment_order_line_item_id` | 1 Shipment に複数ラインを紐付け。数量指定可能。|
| `line_items` | `shopify_line_item_id`, `fulfillment_order_line_item_id`, `fulfillable_quantity` | Shopify 側 FO の残量を保存し部分発送を計算。|
| `orders` | `shopify_order_id`, `shopify_fulfillment_order_id`, `shop_domain` | FO 参照と Shopify 接続情報。|
| `shipment_sync_events` | `shipment_id`, `event_type`, `status_from`, `status_to`, `error_message`, `metadata` | Shipment 単位の同期・管理者操作イベント。|

## Shopify 側の依存
- Admin API Version: `2025-10`（`SHOPIFY_ADMIN_API_VERSION` で上書き可）。
- 必須スコープ: `read_merchant_managed_fulfillment_orders`, `write_merchant_managed_fulfillment_orders`, `read_orders`, `write_orders`。
- 配送会社マッピング: `yamato` → `Yamato (JA)`、`sagawa` → `Sagawa (JA)` 等。未対応キャリアはそのまま文字列を渡す。
- FO 取得: `/orders/{order_id}/fulfillment_orders.json`。最初の FO を前提にしているため、将来的に複数ロケーション対応を検討。
- FO webhook: `order_routing_complete` / `hold_released` / `cancellation_request_accepted` はいずれも order 解決後に同じ resync 経路へ流す。

## エラー処理
- 戻り値に応じて `sync_status` を更新。
  - `pending`: まだ Shopify 送信前。
  - `processing`: API 呼び出し中。
  - `synced`: 成功。`synced_at` 記録。
  - `error`: 致命的失敗。`sync_error` にメッセージ保管。
  - `manual_resolved`: 管理者が Shopify 側状態を確認し、LIVAPON 側の自動再同期対象から外した状態。
- FO 未生成時は `sync_status='pending'` のまま `sync_pending_until` に次回試行予定時刻を設定。
- API 失敗時はメッセージを `sync_error` に保存し、管理画面で再同期・手動対応済み化・Fulfillment ID 紐付けを行う。セラー主導線では発送登録済み表示を維持する。

## 今後の強化
- `sync_status='error'` と stale `processing` を Slack / Dashboard へ通知。
- Shopify GraphQL `fulfillmentCreate` への切り替え（複数追跡番号対応）。
- 複数ロケーション向けに FO 選択を動的に行う仕組み。
- `notify_customer` 設定の店舗別テンプレート化。
