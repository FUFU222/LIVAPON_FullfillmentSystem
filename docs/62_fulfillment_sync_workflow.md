# 62 Fulfillment Sync Workflow & Resilience

## Data Mapping
- Supabase tables:
  - `shipments`: tracking number, carrier, status.
  - `shipment_line_items`: shipment ↔ order line bridge with quantities.
  - `line_items`: stores Shopify `line_item_id` and vendor info.
- Mapping steps:
  1. Fetch the order’s Fulfillment Orders from Shopify.
  2. Find matching FO line items via `line_item_id` (SKU is not used by Shopify at this stage).
  3. For each shipment, build `line_items_by_fulfillment_order` with quantities from `shipment_line_items`.
  4. Attach tracking info from `shipments`; no vendor metadata is sent to Shopify.

## Synchronous Workflow (current MVP)
1. Vendor hits 「発送済みにする」 and submits tracking info.
2. Backend updates Supabase records (status = `shipped`, store tracking data).
3. Backend calls Shopify Fulfillment API using the mapping above.
4. On success, mark the shipment as “synced” and notify UI. On failure, keep Supabase record flagged as `unsynced` and show an error toast.

### Cancelling a shipment
- Use `POST .../fulfillments/{id}/cancel.json` to revert Shopify to unfulfilled when the operator chooses 「未発送に戻す」 in the UI.

## Error Handling
- Common responses:
  - **401/403**: missing OAuth scopes or token expired.
  - **404**: FO ID or fulfillment ID incorrect.
  - **422**: invalid request (e.g., quantity exceeds `fulfillable_quantity`, carrier string typo).
  - **429**: rate limiting (REST ~40 req/min). Wait ≥1s and retry.
- UI should surface specific guidance (e.g., “権限が不足しています – アプリの再認可をご確認ください”).

## Retry Strategy
- Immediate manual retry button for operators; especially important for CSV/batch imports.
- Optional automatic retry: limited attempts with exponential backoff; if still failing, surface to user for manual follow-up.
- When retries are pending, mark the shipment as “発送済み (未同期)” to avoid confusing status.

## Background / Queue Option (future)
- For high volume or automation, move Shopify calls to a queue/worker (Supabase trigger + Edge Function). Accept some latency but gain centralized retry control.
- Ensure queue progress is visible in UI if deployed.

