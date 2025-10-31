# 70 Fulfillment Order Integration Plan

## 1. Current Context

- OAuth flow between Shopify and LIVAPON is operational; `shopify_connections` stores the Admin API access token and scopes (`read_/write_` for orders, fulfillments, inventory, shipping, products).
- Orders and line items are imported via `orders/create` and `orders/updated` webhooks into Supabase (`orders`, `line_items`).
- Shipment syncing (`upsertShipment` → `syncShipmentWithShopify`) expects a Shopify Fulfillment Order (FO) to exist; when FO is missing, the flow fails with `No fulfillment order found for Shopify order` and `shopify_fulfillment_order_id` remains `null`.
- Shopify test orders currently do not generate FO despite inventory tracking and location assignments being configured; FO generation conditions need to be formalised or supplemented.

## 2. Objective

Stabilise the end-to-end workflow:
1. **Order intake** → 2. **FO confirmed/created** → 3. **Vendor registers shipment** → 4. **Tracking data syncs back to Shopify**, even when FO creation is delayed.

## 3. Codex engineering tasks

### 3.1 FO missing retry / queue
- **実装状況**: `shipments` テーブルに `sync_retry_count`, `last_retry_at`, `sync_pending_until` を追加。`upsertShipment` で FO 未生成エラーが発生した場合、指数バックオフ（初回 5 分、最大 60 分）で再試行スケジュールを設定し、ユーザーには自動再試行メッセージを返す。`syncShipmentWithShopify` 成功時には再試行カウンタをリセット。
- 残タスク: `sync_status = 'pending'` かつ `sync_pending_until <= now` のレコードを処理するバッチ／ワーカー実装（Supabase cron など）

### 3.2 Webhook-triggered resync
- Webhook実装を拡張し、`fulfillment_orders/order_routing_complete` / `fulfillment_orders/hold_released` を受信した時点で `triggerShipmentResyncForShopifyOrder` を呼び出し、対象注文の保留中 Shipment を即時再同期。
- ストア側でも同トピックを登録しておく必要あり（操作者タスク）。

### 3.3 Shipment queue & tracking upload
- Ensure `shipments` keeps `tracking_number`, `carrier`, `synced_at` so they can be replayed once FO is ready.
- When FO becomes available, push tracking via Shopify Fulfillment API (`fulfillmentCreate`), supporting partial shipments.

### 3.4 Documentation & tooling
- Record Shopify store configuration template for FO-ready orders in docs.
- Provide scripts/tests to contrast FO-generated vs FO-missing orders.
- Backlog item: handle `orders/cancelled` / `orders/delete` webhooks to cascade delete Supabase records.

## 4. Operator (store admin) responsibilities

- Maintain Shopify product settings fulfilling FO prerequisites:
  - `requires_shipping = true` on products.
  - Inventory tracking enabled; location inventory (`available_inventory > 0`).
  - Product assigned to correct shipping profile / location.
- For test environments, verify at least one real checkout path produces FO; temporarily, create + cancel a fulfillment to force FO if needed.
- Reinstall / re-authorise the Shopify app when scopes change.
- Share examples of FO-generated vs FO-missing orders for Codex to analyse.

## 5. Backlog checklist

- [ ] Implement retry fields & logic for FO polling.
- [ ] Add webhook subscriptions for FO state changes and wire to resync.
- [ ] Document Shopify store setup for FO generation in Notion.
- [ ] Analyse order samples (FOあり vs FOなし) and report findings.
- [ ] Implement cancellation webhook handling (future).

## 6. Open questions

- Should FO creation be attempted via API when Shopify does not assign automatically? (Would require additional scopes and logic.)
- How frequently should the retry worker run, and what is the SLA for FO availability in production stores?
