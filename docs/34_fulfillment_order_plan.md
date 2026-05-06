# Fulfillment Order Integration Plan

最終更新: 2026-05-06

## 1. 現状まとめ
- Shopify OAuth 済み。`shopify_connections` にアクセストークン・スコープ・インストール時刻を保存。
- 注文取り込み (`orders/create`, `orders/updated`) と FO 完了 Webhook（`order_routing_complete`, `hold_released`）が稼働。
- `/api/shopify/orders/shipments` → `registerShipmentsFromSelections` で LIVAPON 側の発送レコードを即時作成し、Shopify 共有は `resyncPendingShipments` / `syncShipmentWithShopify` がバックグラウンドで処理する。
- FO 未生成時は `sync_pending_until` にリトライ時刻を保存し、GitHub Actions worker が再同期する。
- `20260504120000_async_shipment_registration.sql` までの配送即時受付関連マイグレーション反映済み。

## 2. 目的
1. FO 未生成ケースでも数分以内に追跡番号を Shopify に同期。
2. 管理者・セラー双方が同期状態を把握し、必要に応じて再送・取消。
3. 店舗設定・ロケーション周りのベストプラクティスを文書化。

## 3. Codex エンジニアリングタスク
| フェーズ | 内容 | 状態 |
| -------- | ---- | ---- |
| FO リトライワーカー | `sync_pending_until` が過去の Shipment を GitHub Actions + `/api/internal/shipments/resync` で再同期。 | 完了 |
| Webhook Resync | FO 関連 Webhook を受信後に保留 Shipment を処理。 | 完了 |
| Shipment Queue API | `/api/shopify/orders/shipments` をセラーツールから利用可能に。 | 完了 |
| FO メタ同期 | 注文Webhook / FO Webhook / バックフィルで `syncFulfillmentOrderMetadata` を実行。 | 完了 |
| Admin Recovery Flow | 同期失敗 shipment の再同期、Fulfillment ID 紐付け、手動対応済み化。 | 完了 |
| Cancel Flow | セラーセルフサービスの取消は提供しない。修正申請 + 管理者対応に集約。 | 方針確定 |
| FO ドキュメント | FO 生成条件・店舗設定チェックリストを整備。 | 進行中 |

## 4. オペレーター（店舗側）の責務
- 商品に `requires_shipping = true`、ロケーションを正しく割当、在庫を >0 に維持。
- Shopify Admin で Webhook を有効化・監視。エラー率が高い場合は Codex team へ共有。
- スコープ変更時はアプリ再認証。`shopify_connections.updated_at` をウォッチ。
- テスト注文で FO が生成されるか定期的に確認（非生成例はログとして保管）。

## 5. チェックリスト（2026-05-06 時点）
- [x] `shipments` リトライ関連カラム追加
- [x] FO Webhook → Resync 実装
- [x] Shopify Bulk Shipment API（セラー向け）
- [x] 配送登録即時受付化
- [x] GitHub Actions で自動再同期
- [x] 管理者の同期失敗対応 UI
- [ ] FO 生成条件ドキュメント作成
- [ ] FO 自動生成の要否評価（GraphQL or REST）

## 6. 未解決の論点
- Shopify が FO を生成しない条件と、どのタイミングで補助 API を打つのが最適か。
- GitHub Actions 再同期の実行間隔と失敗時通知の最適値。
- `notify_customer` を店舗設定で切替可能にするか、固定で false のままにするか。
- 複数ロケーションを扱う店舗でセラー別 FO をどう振り分けるか。

## 7. SKU / FO 連携の強化ポイント
- ✅ ラインアイテム単位で数量調整しながら Fulfillment 作成。
- ✅ FO ID と残量を Supabase にキャッシュ。
- ☐ 複数追跡番号（SKU ごとに異なる追跡番号）のサポート。
- ☐ Shopify 側の部分出荷ステータスを UI に反映するレポート機能。
