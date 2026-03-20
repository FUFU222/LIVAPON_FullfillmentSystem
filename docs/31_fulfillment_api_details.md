# Fulfillment API 詳細

最終更新: 2026-03-15

## OAuth スコープ
- `read_merchant_managed_fulfillment_orders` — `orders/{order_id}/fulfillment_orders.json` と `fulfillment_orders/{id}.json` を読むために必要。
- `write_merchant_managed_fulfillment_orders` — マーチャント管理ロケーションで Fulfillment を作成・追跡更新・取消するために必要。
- `read_orders`, `write_orders` — 注文取得・`note_attributes` 更新に必要。
- （任意）`write_assigned_fulfillment_orders` — 将来的に 3rd party ロケーションへ対応する場合。

> 現行実装では `shopify_connections.scopes` は「最後に Shopify が実際に付与した権限の記録」として保存し、実行時は不足権限の警告にだけ使う。API 呼び出しの可否そのものは Shopify 側が access token に対して判定する。

## REST Admin API エンドポイント
| 処理 | メソッド | パス | 備考 |
| ---- | -------- | ---- | ---- |
| FO 取得 | `GET` | `/admin/api/{ver}/orders/{order_id}/fulfillment_orders.json` | 最初の FO を使用。未生成の場合はリトライ対象。|
| Fulfillment 作成 | `POST` | `/admin/api/{ver}/fulfillments.json` | `line_items_by_fulfillment_order` と `tracking_info` を指定。|
| 追跡情報更新 | `POST` | `/admin/api/{ver}/fulfillments/{fulfillment_id}/update_tracking.json` | 追跡番号変更に利用。|
| Fulfillment 取消 | `POST` | `/admin/api/{ver}/fulfillments/{fulfillment_id}/cancel.json` | セラーが発送取消した場合に使用。|
| FO 単体取得 | `GET` | `/admin/api/{ver}/fulfillment_orders/{id}.json` | Webhook から渡される FO ID から order_id を逆引き。|

> API バージョンは `SHOPIFY_ADMIN_API_VERSION`（デフォルト `2025-10`）。

## リクエスト例
```json
POST /admin/api/2025-10/fulfillments.json
{
  "fulfillment": {
    "notify_customer": false,
    "tracking_info": {
      "number": "YT123456789JP",
      "company": "Yamato (JA)",
      "url": "https://track.example.com/YT123456789JP"
    },
    "line_items_by_fulfillment_order": [
      {
        "fulfillment_order_id": 1046000818,
        "fulfillment_order_line_items": [
          { "id": 1072503286, "quantity": 2 }
        ]
      }
    ]
  }
}
```

## キャリアマッピング
| 内部コード | Shopify 表記 |
| ---------- | ------------ |
| `yamato` | `Yamato (JA)` |
| `sagawa` | `Sagawa (JA)` |
| `japanpost` | `Japan Post (JA)` |
| `dhl` | `DHL Express` |
| `fedex` | `FedEx` |
| その他 | 受け取った文字列をそのまま `company` に設定 |

未サポートのキャリアは `tracking_info.url` を併記してユーザーが参照できるようにする。

## エラーハンドリング
- 401/403: トークン失効またはスコープ不足。`shopify_connections` のトークンを再取得。
- 404: FO / Fulfillment ID が存在しない。多数発生する場合は店舗設定を確認。
- 422: 数量超過・キャリア名称不整合。`sync_error` に詳細を残し、セラー UI で Alert。
- 429: レート制限。指数バックオフを掛け、`sync_pending_until` を未来時刻に設定。

## 関連 webhook
- `fulfillment_orders/order_routing_complete`
- `fulfillment_orders/hold_released`
- `fulfillment_orders/cancellation_request_accepted`

上記 3 つは同じ FO webhook 経路で受け、`fulfillment_order.order_id` または `fulfillment_order.id` から Shopify order を特定し、`triggerShipmentResyncForShopifyOrder` で FO メタデータ再同期と pending/error shipment の再送を促す。

## GraphQL 検討事項
- `fulfillmentCreate` や `fulfillmentTrackingInfoUpdate` を使うと複数追跡番号や部分通知が柔軟になる。
- GraphQL 化時は `fulfillmentLineItem` ID を取得する必要があるため、`shipment_line_items.fulfillment_order_line_item_id` との整合を確認。

## セキュリティ
- API 呼び出しは常に HTTPS。`X-Shopify-Access-Token` を必須ヘッダーとして付与。
- Webhook 検証は `lib/shopify/hmac.ts` にまとめており、全エンドポイントで使い回す。
