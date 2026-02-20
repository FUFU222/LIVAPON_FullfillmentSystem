# Fulfillment Sync Backlog

最終更新: 2025-11-02

## Done / 完了
- FO ラインアイテム ID の取得・キャッシュ (`line_items.fulfillment_order_line_item_id`, `shipment_line_items.fulfillment_order_line_item_id`)。
- Fulfillment 作成・追跡更新のサービス層整備 (`syncShipmentWithShopify`)。
- `shipments` に `sync_status`, `sync_error`, `sync_retry_count`, `sync_pending_until`, `last_retry_at` を追加。
- Shopify FO Webhook での再同期トリガー (`triggerShipmentResyncForShopifyOrder`)。
- 注文 Webhook / FO Webhook / バックフィルスクリプトから FO メタデータを同期 (`syncFulfillmentOrderMetadata`, `scripts/backfill-fulfillment-orders.ts`)。

## Short-Term TODO
| タスク | 詳細 | 期待効果 |
| ------ | ---- | -------- |
| 自動再同期ワーカー | `sync_pending_until` <= NOW() の Shipment を順次処理。Supabase スケジューラ or Edge Functions で実装。 | 手動操作なしで FO 遅延を吸収 |
| 同期ログ保存 | Shopify API のレスポンスを JSON で履歴化 (`shipments_sync_logs` テーブル新設)。 | 障害解析を迅速化 |
| エラー再送 UI | `/orders/shipments` に「再同期」ボタンを追加し、`sync_status='error'` を解消。 | セラーセルフサービス |
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
