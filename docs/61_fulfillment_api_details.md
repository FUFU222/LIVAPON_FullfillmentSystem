# 61 Fulfillment API Details

## Required OAuth Scopes
- `write_merchant_managed_fulfillment_orders` — mandatory for merchant-managed locations.
- Optional: `write_third_party_fulfillment_orders` if we ever act on third-party fulfillment services.
- Still request `read_orders` / `write_orders` for compatibility; add `read_fulfillments` if webhooks or lookups require it.

## REST Endpoints (2025-10)
- **List FO for an order**: `GET /admin/api/{version}/orders/{order_id}/fulfillment_orders.json`.
- **Create a fulfillment**: `POST /admin/api/{version}/fulfillments.json` with `line_items_by_fulfillment_order` payload.
- **Cancel (revert to unfulfilled)**: `POST /admin/api/{version}/fulfillments/{fulfillment_id}/cancel.json`.
- **Update tracking**: `POST /admin/api/{version}/fulfillments/{fulfillment_id}/update_tracking.json` (for late edits).

### Example payload
```json
POST /admin/api/2025-10/fulfillments.json
{
  "fulfillment": {
    "line_items_by_fulfillment_order": [
      {
        "fulfillment_order_id": 1046000818,
        "fulfillment_order_line_items": [
          { "id": 1072503286, "quantity": 1 }
        ]
      }
    ],
    "tracking_info": {
      "number": "SG123456789JP",
      "company": "Sagawa (JA)"
    },
    "notify_customer": true
  }
}
```
- Use Shopify’s canonical carrier strings (`"Sagawa (JA)"`, `"Yamato (JA)"`, `"Japan Post (JA)"`).
- If the carrier is unsupported, populate `tracking_info.url` manually.

## Notes on GraphQL Admin API
- `fulfillmentCreate` mutation handles multiple tracking numbers in one call.
- REST still limits one tracking number per fulfillment; repeated `update_tracking` calls needed otherwise.
- Keep API abstraction such that switching to GraphQL later only affects the service layer.

