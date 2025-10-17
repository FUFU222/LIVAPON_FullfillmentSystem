# 63 Fulfillment Sync Implementation Backlog

## Immediate Tasks
- Build a service to fetch Fulfillment Orders by Shopify order ID and cache FO/FO line item IDs in Supabase.
- Implement fulfillment creation + cancellation calls with robust error handling and logging.
- Extend Supabase schema (if必要) に「同期状態」「最終同期日時」などのフィールドを追加。
- Update UI to display “未同期”ステータスと再送ボタン。

## Operational Considerations
- Decide on location strategy (単一ロケーション vs ベンダーごとのロケーション)。上限を超えないか確認。
- Register OAuth scopes (`write_merchant_managed_fulfillment_orders` 等) and update app onboarding docs.
- Define carrier string map (Shopify公式リストをサポート)。
- Instrument logging/alerting for 401/403/422/429 responses。

## Future Enhancements
- Evaluate GraphQL `fulfillmentCreate` for multi-tracking shipments。
- Automate queue-based retries (Supabase triggers + Edge Functions) when order volume grows。
- Consider customer notification settings (`notify_customer`)と店舗ポリシーのすり合わせ。
- Monitor API rate usage; if CSV一括同期が増える場合はバックグラウンド処理に移行。

