# 60 Fulfillment Sync Overview

## Purpose
- Define how LIVAPON Fulfillment System pushes vendor shipments from Supabase into Shopify as of October 2025.
- Capture the recommended API surface now that Shopify has fully moved toward Fulfillment Orders.

## Recommended Architecture (2025-10)
- **Fulfillment Orders API is mandatory**: every order automatically generates Fulfillment Orders (FO) per location. Our backend must read FO records and create Fulfillments against them.
- **Partial shipments and multi-location support** are native to FO. Shopify keeps order status in sync (Unfulfilled → Partially Fulfilled → Fulfilled) as we post multiple Fulfillments.
- **Legacy Fulfillment API is deprecated**: Shopify has urged migration off `/orders/{id}/fulfillments.json`; new public apps must use the GraphQL Admin API from April 2025 onward. We can prototype with REST `fulfillments.json` for readability, but expect to move to the GraphQL mutation long-term.
- **GraphQL advantages**: single mutation can submit multiple tracking numbers, whereas REST still limits one tracking number per fulfillment. Whatever we build should encapsulate REST today but keep the mapping compatible with the GraphQL mutation.
- **Location strategy**: Basic plan limits the number of locations. If each vendor becomes a “location,” stay under the cap. Otherwise run all shipments from one merchant-managed location and rely on internal vendor metadata.

## Key Concepts
- **Fulfillment Order (FO)**: automatically generated shipment instruction per location. Cannot be created manually. Holds line-level fulfillable quantities.
- **FO Line Item**: represents a specific order line (variant) within an FO. Carries `fulfillable_quantity` that decrements as shipments go out.
- **Fulfillment**: actual shipment object posted by our system. Associates FO line items that are being dispatched in this batch, and carries tracking info and notifications.

## Implications for LIVAPON
- Supabase must store Shopify `order_id`, `line_item_id`, and keep a way to cache `fulfillment_order_id` / `fulfillment_order_line_item_id` lookups.
- SKU strings are for internal routing only; Shopify API interactions are keyed by FO IDs and line item IDs.
- We can support partial quantities (e.g., ship 2 of 5) by sending the appropriate quantity on the FO line item.
- Basic UI flow remains unchanged: vendor presses「発送済みにする」 → backend creates fulfillment → Shopify reflects status.

