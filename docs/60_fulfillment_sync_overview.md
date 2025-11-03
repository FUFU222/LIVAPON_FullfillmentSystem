# Fulfillment Sync Overview

最終更新: 2025-11-02

## ゴール
- Supabase で管理される Shipment を Shopify Fulfillment Order (FO) と同期し、追跡番号を確実に反映する。
- FO が未生成または一時的に取得できない場合でも、再試行と通知で整合を保つ。

## アーキテクチャ
- **データストア**: Supabase (Postgres)。`shipments`, `shipment_line_items`, `orders`, `line_items`。
- **サービス層**: `lib/data/orders.ts` が作成・キャンセル・再同期を担い、`lib/shopify/fulfillment.ts` が Shopify Admin API との通信を抽象化。
- **同期トリガー**:
  - 注文 Webhook (`orders/create`, `orders/updated`) で `upsertShopifyOrder` が注文保存 → `syncFulfillmentOrderMetadata` で FO を即時取得・保存（未生成なら pending）。
  - ベンダー UI / CSV / API で `upsertShipment` → `sync_status = 'pending'`。`syncShipmentWithShopify` が FO メタデータを再利用・更新。
  - Shopify Webhook (`fulfillment_orders/*`) 受信時に `triggerShipmentResyncForShopifyOrder` が FO メタ同期＋保留 Shipment の再同期を行う。
  - バックフィルスクリプト `scripts/backfill-fulfillment-orders.ts` が定期的に NULL 行を再取得し、再試行ログを残す。
- **再試行**: FO 未生成エラー時は指数バックオフで数分待機。ワーカー未実装のため、現状は次のユーザー操作 or Webhook で再実行。

## 関連テーブル
| テーブル | 主なカラム | 説明 |
| -------- | ---------- | ---- |
| `shipments` | `tracking_number`, `carrier`, `shopify_fulfillment_id`, `sync_status`, `sync_error`, `sync_pending_until` | Shopify との同期状態・メタ情報。|
| `shipment_line_items` | `line_item_id`, `quantity`, `fulfillment_order_line_item_id` | 1 Shipment に複数ラインを紐付け。数量指定可能。|
| `line_items` | `shopify_line_item_id`, `fulfillment_order_line_item_id`, `fulfillable_quantity` | Shopify 側 FO の残量を保存し部分発送を計算。|
| `orders` | `shopify_order_id`, `shopify_fulfillment_order_id`, `shop_domain` | FO 参照と Shopify 接続情報。|

## Shopify 側の依存
- Admin API Version: `2025-10`（`SHOPIFY_ADMIN_API_VERSION` で上書き可）。
- 必須スコープ: `write_merchant_managed_fulfillment_orders`, `read_orders`, `write_orders`, `read_fulfillments`。
- 配送会社マッピング: `yamato` → `Yamato (JA)`、`sagawa` → `Sagawa (JA)` 等。未対応キャリアはそのまま文字列を渡す。
- FO 取得: `/orders/{order_id}/fulfillment_orders.json`。最初の FO を前提にしているため、将来的に複数ロケーション対応を検討。

## エラー処理
- 戻り値に応じて `sync_status` を更新。
  - `pending`: まだ Shopify 送信前。
  - `processing`: API 呼び出し中。
  - `synced`: 成功。`synced_at` 記録。
  - `error`: 致命的失敗。`sync_error` にメッセージ保管。
- FO 未生成時は `sync_status='pending'` のまま `sync_pending_until` に次回試行予定時刻を設定。
- API 失敗時はメッセージをそのまま `sync_error` に保存。UI では Alert + Toast で提示。

## 今後の強化
- `sync_pending_until` を自動で監視する Cron/Edge Functions。
- Shopify GraphQL `fulfillmentCreate` への切り替え（複数追跡番号対応）。
- 複数ロケーション向けに FO 選択を動的に行う仕組み。
- `notify_customer` 設定の店舗別テンプレート化。
