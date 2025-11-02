# 70 Fulfillment Order Integration Plan (Production Phase)

## 1. Current Context

- OAuth flow between Shopify and LIVAPON is operational; `shopify_connections` stores the Admin API access token and scopes (`read_/write_` for orders, fulfillments, inventory, shipping, products).
- Orders and line items are imported via `orders/create` and `orders/updated` webhooks into Supabase (`orders`, `line_items`).
- Shipment syncing (`upsertShipment` → `syncShipmentWithShopify`) expects a Shopify Fulfillment Order (FO) to exist; when FO is missing, the flow fails with `No fulfillment order found for Shopify order` and `shopify_fulfillment_order_id` remains `null`.
- 現時点でも Shopify 側で Fulfillment Order (FO) が生成されない注文が発生しており、在庫・配送設定が揃っていても内部割当が完了しないケースが確認されている。→ **FO をこちら側で補助生成するアプローチを検討中。**

## 2. Objective

Stabilise the end-to-end workflow:
1. **Order intake** → 2. **FO confirmed/created** → 3. **Vendor registers shipment** → 4. **Tracking data syncs back to Shopify**, even when FO creation is delayed.

## 3. Codex engineering tasks

### 3.1 FO missing retry / queue（実装済み）
- `shipments` に `sync_retry_count`・`last_retry_at`・`sync_pending_until` を追加済み。`upsertShipment` は FO 不在時に指数バックオフで自動再試行をスケジュールし、UI には自動再試行メッセージを返す。
- `syncShipmentWithShopify` 成功時にはリトライ情報をリセット。
- **残タスク**: `sync_pending_until` が到来したレコードを処理する Cron / Edge Function ワーカー実装。

### 3.2 Webhook-triggered resync
- Webhook実装を拡張し、`fulfillment_orders/order_routing_complete` / `fulfillment_orders/hold_released` を受信した時点で `triggerShipmentResyncForShopifyOrder` を呼び出し、対象注文の保留中 Shipment を即時再同期。
- ストア側でも同トピックを登録しておく必要あり（操作者タスク）。

### 3.3 Shipment queue & tracking upload（進行中）
- `shipments` には必要情報を保持済み。FO 取得後に確実に `fulfillmentCreate` へ流すワーカー／ジョブ設計を詰める。
- 部分発送（SKU 単位）への対応を前提に、ラインアイテム単位の数量を持たせる API 拡張が必要。

### 3.4 Documentation & tooling
- FO が生成されるストア設定テンプレートをドキュメント化（WIP）。
- FO 生成／非生成パターンの記録と差分分析を継続。
- Backlog: `orders/cancelled` / `orders/delete` Webhook 連携で Supabase レコードを自動削除。

## 4. Operator (store admin) responsibilities

- Maintain Shopify product settings fulfilling FO prerequisites:
  - `requires_shipping = true` on products.
  - Inventory tracking enabled; location inventory (`available_inventory > 0`).
  - Product assigned to correct shipping profile / location.
- For test environments, verify at least one real checkout path produces FO; temporarily, create + cancel a fulfillment to force FO if needed.
- Reinstall / re-authorise the Shopify app when scopes change.
- Share examples of FO-generated vs FO-missing orders for Codex to analyse.

## 5. Backlog checklist（2025-10-31 時点）

- [x] Implement retry fields & logic for FO polling（ワーカー実装のみ未着手）
- [x] Add webhook subscriptions for FO state changes and wire to resync
- [ ] Document Shopify store setup for FO generation in Notion（着手中）
- [ ] Analyse order samples (FOあり vs FOなし) and report findings
- [ ] Implement cancellation webhook handling
- [ ] Cron / worker for `sync_pending_until`
- [ ] FO self-provisioning via Shopify API（要設計）

## 6. Open questions

- Shopify が FO を自動生成しない場合、どのタイミングでこちらが補助生成するか（注文直後 vs リトライ中）。
- FO 作成 API を利用する場合に必要な追加スコープ・ロケーション割当ルール。
- Cron / Edge Functions の実行間隔および SLA（再試行の最大許容時間）。

## 7. SKU-level fulfillment enhancements（2025-10-31）

- ✅ 注文一覧で SKU を展開表示し、ラインアイテム単位での選択・数量編集・発送登録を実装。
- ✅ `/api/shopify/orders/shipments` と `upsertShipment` をラインアイテム単位／数量指定対応に拡張。
- ☐ 追跡番号を SKU 単位で複数入力する UI（現在は共通番号を適用）
- ☐ SKU ごとの在庫ステータス／未割当状態の可視化（`line_items` 状態管理フィールド追加）
- ☐ Shopify 側の部分出荷結果を UI にフィードバックするレポート機能
