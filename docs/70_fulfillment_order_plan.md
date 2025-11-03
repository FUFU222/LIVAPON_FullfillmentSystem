# Fulfillment Order Integration Plan

最終更新: 2025-11-02

## 1. 現状まとめ
- Shopify OAuth 済み。`shopify_connections` にアクセストークン・スコープ・インストール時刻を保存。
- 注文取り込み (`orders/create`, `orders/updated`) と FO 完了 Webhook（`order_routing_complete`, `hold_released`）が稼働。
- `upsertShipment` → `syncShipmentWithShopify` で FO 情報を取得し、Fulfillment を新規作成/更新。FO 未生成時は `sync_pending_until` にリトライ時刻を保存。
- `20251102165153_add_line_items_variant_title.sql` までマイグレーション反映済み。

## 2. 目的
1. FO 未生成ケースでも数分以内に追跡番号を Shopify に同期。
2. 管理者・ベンダー双方が同期状態を把握し、必要に応じて再送・取消。
3. 店舗設定・ロケーション周りのベストプラクティスを文書化。

## 3. Codex エンジニアリングタスク
| フェーズ | 内容 | 状態 |
| -------- | ---- | ---- |
| FO リトライワーカー | `sync_pending_until` が過去の Shipment を Cron / Edge Functions で再同期。 | 未着手 |
| Webhook Resync | FO 関連 Webhook を受信後に保留 Shipment を処理。 | 完了 |
| Shipment Queue API | `/api/shopify/orders/shipments` をベンダーツールから利用可能に。 | 完了 |
| FO メタ同期 | 注文Webhook / FO Webhook / バックフィルで `syncFulfillmentOrderMetadata` を実行。 | 完了 |
| Cancel Flow | `cancelShipment` 呼び出しを UI から行い Shopify 取消。 | 部分完了（API 準備済み、UI 未実装） |
| FO ドキュメント | FO 生成条件・店舗設定チェックリストを整備。 | 進行中 |

## 4. オペレーター（店舗側）の責務
- 商品に `requires_shipping = true`、ロケーションを正しく割当、在庫を >0 に維持。
- Shopify Admin で Webhook を有効化・監視。エラー率が高い場合は Codex team へ共有。
- スコープ変更時はアプリ再認証。`shopify_connections.updated_at` をウォッチ。
- テスト注文で FO が生成されるか定期的に確認（非生成例はログとして保管）。

## 5. チェックリスト（2025-11-02 時点）
- [x] `shipments` リトライ関連カラム追加
- [x] FO Webhook → Resync 実装
- [x] Shopify Bulk Shipment API（ベンダー向け）
- [ ] FO 生成条件ドキュメント作成
- [ ] Cancel Flow UI
- [ ] Cron/Edge Functions で自動再同期
- [ ] FO 自動生成の要否評価（GraphQL or REST）

## 6. 未解決の論点
- Shopify が FO を生成しない条件と、どのタイミングで補助 API を打つのが最適か。
- Cron / Edge Functions の実行間隔（5 分?, 10 分?）と失敗時の通知方法。
- `notify_customer` を店舗設定で切替可能にするか、固定で false のままにするか。
- 複数ロケーションを扱う店舗でベンダー別 FO をどう振り分けるか。

## 7. SKU / FO 連携の強化ポイント
- ✅ ラインアイテム単位で数量調整しながら Fulfillment 作成。
- ✅ FO ID と残量を Supabase にキャッシュ。
- ☐ 複数追跡番号（SKU ごとに異なる追跡番号）のサポート。
- ☐ Shopify 側の部分出荷ステータスを UI に反映するレポート機能。
