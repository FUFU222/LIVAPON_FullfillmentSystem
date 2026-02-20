# Fulfillment Sync ワークフロー & 耐障害設計

最終更新: 2025-11-02

## データマッピング
- `shipments` — 追跡番号・キャリア・同期状態・FO 関連 ID。
- `shipment_line_items` — Shipment とラインアイテムのペア、数量指定、`fulfillment_order_line_item_id` キャッシュ。
- `line_items` — Shopify `line_item_id`, `fulfillable_quantity`, `fulfilled_quantity` を保持。
- `orders` — Shopify `order_id`, `shopify_fulfillment_order_id`, `shop_domain`。

## フロー概要
1. セラーが UI / CSV / API で発送登録。
2. `upsertShipment`
   - Line Item 権限を検証。
   - Shipment と pivot を作成・更新。
   - `sync_status = 'pending'`, `sync_error = null`, `sync_retry_count = 0`。
3. `syncShipmentWithShopify`
   - `sync_status = 'processing'` に更新。
   - Shopify から FO を取得し、ラインアイテム毎に残量を計算。
   - 既存 Fulfillment があれば `update_tracking`、なければ新規作成。
   - 成功時に `sync_status='synced'`, `synced_at` 設定。FO ID と残量を `line_items` / `shipment_line_items` に反映。
4. FO 未生成などで失敗した場合
   - `sync_status='pending'` を維持。
   - `sync_error` にメッセージ、`sync_retry_count += 1`。
   - `sync_pending_until` を指数バックオフで未来に設定（5, 10, 20, ... 最大 60 分）。
5. Shopify から FO 関連 Webhook を受信すると `triggerShipmentResyncForShopifyOrder` が対象注文の `sync_status='pending'` を再実行。
6. セラーが発送取消すると `cancelShipment` が Shopify Fulfillment をキャンセルし、Supabase レコードを削除。注文の残件が無ければ `orders.status` を `unfulfilled` に戻す。

## エラーパターン & 対応
| 種類 | 想定原因 | 対応 |
| ---- | -------- | ---- |
| `No fulfillment order found` | Shopify 側で FO 未生成 | `sync_pending_until` で待機。Webhook で再同期。|
| `Shopify API 4xx` | スコープ不足/数量不整合 | `sync_status='error'` + `sync_error` に詳細。管理者が確認。|
| ネットワークエラー | Shopify 側障害 | バックオフ → 管理者にはアラート。|
| 429 レート | 呼び出し過多 | `sync_pending_until` をレート制限解除後に設定。|

## UI との連携
- `OrdersDispatchTable` / `OrdersDispatchPanel` がラインアイテム選択と発送登録（追跡番号・配送会社入力、確認モーダル、Toast）を担う。
- `ShipmentHistoryTable` は `sync_status`, `sync_error`, `shipped_at` を表示（エラー時は Tooltip で詳細予定）。
- 手動再同期・取消ボタンは今後追加予定（バックログ参照）。

## 今後の耐障害強化
- `sync_pending_until <= NOW()` の Shipment をバッチ再送するワーカー。
- Shopify API レスポンスログを `shipments_sync_logs` テーブルに保存し、成功/失敗のトレースを容易にする。
- 通知（Slack/メール）で `sync_status='error'` を監視。
