# Fulfillment Sync Backlog

最終更新: 2026-05-06

## Done / 完了
- FO ラインアイテム ID の取得・キャッシュ (`line_items.fulfillment_order_line_item_id`, `shipment_line_items.fulfillment_order_line_item_id`)。
- Fulfillment 作成・追跡更新のサービス層整備 (`syncShipmentWithShopify`)。
- `shipments` に `sync_status`, `sync_error`, `sync_retry_count`, `sync_pending_until`, `last_retry_at` を追加。
- Shopify FO Webhook での再同期トリガー (`triggerShipmentResyncForShopifyOrder`)。
- 注文 Webhook / FO Webhook / バックフィルスクリプトから FO メタデータを同期 (`syncFulfillmentOrderMetadata`, `scripts/backfill-fulfillment-orders.ts`)。
- 配送登録 API の即時受付化。`/api/shopify/orders/shipments` は `shipments` を作成して `202` を返し、Shopify 同期はバックグラウンド化。
- 自動再同期 worker。GitHub Actions `resync-pending-shipments` が `/api/internal/shipments/resync` を呼び、pending/error/stale processing を順次処理。
- Shipment 同期イベント (`shipment_sync_events`) と管理者対応（再同期、Fulfillment ID 紐付け、手動対応済み化）。

## Short-Term TODO
| タスク | 詳細 | 期待効果 |
| ------ | ---- | -------- |
| 同期監視 | `sync_status='error'` / stale `processing` / retry count 上限を Slack or Dashboard へ通知。 | 管理者が失敗を早く検知 |
| 同期イベント表示の拡充 | `shipment_sync_events` を admin 詳細で時系列表示し、エラー文を読みやすくする。 | 障害解析を迅速化 |
| 管理者再送 UX | admin 画面の再同期・手動対応済み・Fulfillment ID 紐付けの説明と確認導線を磨く。 | 例外対応の誤操作防止 |
| キャリアマッピング管理 | キャリアコード ⇔ Shopify 表記表を Supabase 管理に移行。 | 新キャリア追加を容易に |

## Mid-Term Ideas
- GraphQL `fulfillmentCreate` への移行検証（複数追跡番号、`notifyCustomer` 制御を柔軟に）。
- FO 未生成時に自動で `fulfillmentOrderCreate` を呼ぶ補助フロー（※スコープ追加が必要）。
- `orders` / `line_items` の差分検知ジョブ（Shopify API で日次整合性チェック）。
- 返品/再発送イベント (`fulfillment_orders/cancellation_requested` 等) の取り込み。

## Ops / Runbook TODO
- Webhook 登録・再登録手順を Notion にまとめる。
- 障害時の一次切り分けフローチャート（トークン・スコープ・FO・レート・API 側障害）。
- Shopify 側で FO が生成されない条件のサンプル収集とドキュメント化。
