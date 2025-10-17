# 61 Fulfillment API 詳細

## 必要な OAuth スコープ
- `write_merchant_managed_fulfillment_orders`：マーチャント管理ロケーションの FO を操作するために必須。
- 将来的に外部フルフィルメントサービスを扱う場合は `write_third_party_fulfillment_orders` も検討。
- これまで通り `read_orders` / `write_orders` は保持し、Webhook 利用時などに `read_fulfillments` も必要なら付与する。

## REST エンドポイント（2025-10 時点）
- **FO 一覧取得**：`GET /admin/api/{version}/orders/{order_id}/fulfillment_orders.json`
- **Fulfillment 作成**：`POST /admin/api/{version}/fulfillments.json`
- **Fulfillment 取消（未発送に戻す）**：`POST /admin/api/{version}/fulfillments/{fulfillment_id}/cancel.json`
- **追跡情報更新**：`POST /admin/api/{version}/fulfillments/{fulfillment_id}/update_tracking.json`

### リクエスト例（REST）
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
- 配送会社は Shopify の公式名称を使用（例：`Sagawa (JA)`、`Yamato (JA)`、`Japan Post (JA)`）。
- 未サポートの運送会社では `tracking_info.url` に追跡ページ URL を指定。

## GraphQL Admin API について
- `fulfillmentCreate` ミューテーションで複数追跡番号を一度に登録可能。
- 旧 REST の制約（追跡番号 1 件まで）を避けられるので、中長期的には移行を検討。
- どちらの API でも共通するロジック（FO ID の取得・数量指定など）はサービス層で抽象化しておく。

